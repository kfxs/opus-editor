/**
 * The TRILL's commands — what the module adds over `trillOps`: which seam an edit records through,
 * the SCREEN delta its limits are asked in, and that a refusal writes and records nothing. Built on
 * {@link fakeCommandContext}: a real `ScoreModel`, no engine.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { fracCreate as frac } from '@/utils/fraction'
import { trillOffsetOverrideOf } from '../models/engravingOverrides'
import { fakeCommandContext, type FakeCommandContext } from './fakeCommandContext'
import { trillCommands, type TrillCommands } from './trillCommands'

describe('trillCommands', () => {
  let ctx: FakeCommandContext
  let trill: TrillCommands
  let notes: string[]
  let id: string

  beforeEach(() => {
    ctx = fakeCommandContext()
    trill = trillCommands(ctx)
    notes = [0, 1, 2].map(i =>
      ctx.score.addNote({ step: 'C', alter: 0, octave: 5, duration: 'q', measure: 1, beat: frac(i, 1) }).id)
    id = trill.createTrill([notes[0], notes[1]])!.id
    ctx.log.length = 0
  })

  const offset = () => trillOffsetOverrideOf(ctx.score.getScore(), id)

  describe('one edit is ONE undo entry', () => {
    it('create and remove each record one, named for what they did', () => {
      expect(trill.removeTrill(id)).toBe(true)
      expect(trill.createTrill([notes[2]])).not.toBeNull()
      expect(ctx.log).toEqual(['mutate:Remove trill', 'mutate:Add trill'])
    })

    it('an ink nudge records one entry per press', () => {
      expect(trill.nudgeTrill(id, 1, 0.5)).toBe(true)
      expect(trill.nudgeTrillEndpoint(id, 'end', 0.25, 0)).toBe(true)
      expect(ctx.log).toEqual(['mutate:Nudge trill', 'mutate:Nudge trill'])
    })

    it('⭐ an edit that changed NOTHING records nothing — a reset with no nudge to drop', () => {
      expect(trill.resetTrillOffset(id)).toBe(false)
      expect(ctx.log).toEqual([])
    })

    it('⭐ a PASTE is one entry however many facts it sets', () => {
      // `createTrillOverSpan` writes the trill and up to three ways it reads inside ONE batch; the
      // fake runs the batch inline, so what is pinned is that it asks through `runBatch` at all.
      let batches = 0
      const run = ctx.runBatch
      ctx.runBatch = (d, fn) => { batches++; return run(d, fn) }
      expect(trill.createTrillOverSpan(notes[2], frac(0, 1), { placement: 'below' })).not.toBeNull()
      expect(batches).toBe(1)
    })
  })

  describe('a DRAG records per drop, never per frame', () => {
    it('every preview frame dirties the model and records NO undo entry', () => {
      expect(trill.previewTrillOffset(id, 0.5, 0)).toBe(true)
      expect(trill.previewTrillEndpointOffset(id, 'start', 0.25, 0)).toBe(true)
      expect(trill.previewTrillPlacement(id, 'below')).toBe(true)
      expect(ctx.undoEntries()).toBe(0)
      expect(ctx.log).toEqual(['dirty', 'dirty', 'dirty'])
    })

    it('…and the drop records exactly one, named for the end that moved', () => {
      trill.previewTrillEndpointOffset(id, 'end', 0.25, 0)
      trill.commitTrillDrag('end')
      expect(ctx.log).toEqual(['dirty', 'previewed:Move trill end'])
    })
  })

  describe('the limits', () => {
    it('⭐⭐ `outward` reaches the page limit as a SCREEN delta — UP for a trill above the staff', () => {
      trill.nudgeTrill(id, 0, 1)
      expect(ctx.asked).toEqual([{ limit: 'page', dx: 0, dy: -1 }])
    })

    it('…and DOWN once the trill is below: the stored number is not a screen y', () => {
      ctx.score.setTrillPlacement(id, 'below')
      trill.nudgeTrill(id, 0, 1)
      expect(ctx.asked).toEqual([{ limit: 'page', dx: 0, dy: 1 }])
    })

    it('⛔ a REFUSED nudge writes nothing and records nothing — keyboard and drag alike', () => {
      ctx.allow.page = false
      expect(trill.nudgeTrill(id, 1, 1)).toBe(false)
      expect(trill.previewTrillOffset(id, 1, 1)).toBe(false)
      expect(offset()).toBeUndefined()
      expect(ctx.log).toEqual([])
    })

    it('an END’s horizontal is judged by the span-end rule, its vertical by the page', () => {
      trill.nudgeTrillEndpoint(id, 'end', 0.5, 1)
      expect(ctx.asked.map(a => a.limit)).toEqual(['spanEnd', 'page'])
      ctx.asked.length = 0
      trill.nudgeTrillEndpoint(id, 'end', 0.5, 0)
      expect(ctx.asked.map(a => a.limit), 'no vertical, no page question').toEqual(['spanEnd'])
    })

    it('⛔ a RE-BASE is never judged — it pays back a move the anchor made, so no ink moves', () => {
      ctx.allow.page = ctx.allow.spanEnd = false
      expect(trill.previewTrillEndpointRebase(id, 'start', 2)).toBe(true)
      expect(ctx.asked).toEqual([])
    })
  })
})
