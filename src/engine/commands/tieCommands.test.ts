import { describe, it, expect, beforeEach } from 'vitest'
import { tieCommands, type TieCommands } from './tieCommands'
import { fakeCommandContext, type FakeCommandContext } from './fakeCommandContext'
import { tieOffsetOverrideOf } from '../models/engravingOverrides'
import { fracCreate as frac } from '@/utils/fraction'
import type { ElementInfo } from '../ElementRegistry'

describe('tieCommands', () => {
  let ctx: FakeCommandContext
  let tie: TieCommands
  let from: string
  let untied: string

  const offset = () => tieOffsetOverrideOf(ctx.score.getScore(), from)?.y

  beforeEach(() => {
    ctx = fakeCommandContext()
    const a = ctx.score.addNote({ step: 'C', alter: 0, octave: 5, duration: 'q', measure: 1, beat: frac(0, 1) })
    const b = ctx.score.addNote({ step: 'C', alter: 0, octave: 5, duration: 'q', measure: 1, beat: frac(1, 1) })
    ctx.score.updateNote(a.id, { tiedTo: b.id })
    ctx.score.updateNote(b.id, { tiedFrom: a.id })
    from = a.id
    untied = b.id
    tie = tieCommands(ctx)
  })

  describe('nudgeTie — his ask, 2026-09-21: the arrows on a selected tie', () => {
    it('⭐ accumulates a vertical offset, one undo entry per press', () => {
      expect(tie.nudgeTie(from, -0.25)).toBe(true)
      expect(tie.nudgeTie(from, -0.25)).toBe(true)
      expect(offset()).toBe(-0.5)
      expect(ctx.log).toEqual(['mutate:Nudge tie', 'mutate:Nudge tie'])
    })

    it('a net zero DELETES the entry — absent means the engraver’s place', () => {
      tie.nudgeTie(from, 1)
      tie.nudgeTie(from, -1)
      expect(ctx.score.getScore().engravingOverrides?.[from]).toBeUndefined()
    })

    it('⛔ refuses a note that owns no tie, and a zero press — nothing written, nothing recorded', () => {
      expect(tie.nudgeTie(untied, 1)).toBe(false)
      expect(tie.nudgeTie('nobody', 1)).toBe(false)
      expect(tie.nudgeTie(from, 0)).toBe(false)
      expect(ctx.log).toEqual([])
    })

    it('⛔ the BAND limit refuses the write, judged on the drawn arc', () => {
      ctx.drawn = [{ type: 'tie', fromNoteId: from, bbox: { x: 10, y: 20, width: 30, height: 6 } } as ElementInfo]
      ctx.allow.band = false
      expect(tie.nudgeTie(from, 1)).toBe(false)
      expect(offset()).toBeUndefined()
      expect(ctx.log).toEqual([])
      expect(ctx.asked).toEqual([{ limit: 'band', dx: 0, dy: 1 }])
    })
  })

  describe('resetTieOffset', () => {
    it('drops the nudge; DECLINES when there was none', () => {
      expect(tie.resetTieOffset(from)).toBe(false)
      tie.nudgeTie(from, 0.5)
      expect(tie.resetTieOffset(from)).toBe(true)
      expect(offset()).toBeUndefined()
      expect(ctx.log).toEqual(['mutate:Nudge tie', 'mutate:Reset tie position'])
    })
  })

  describe('flipTie — moved here from MusicEngine, unchanged', () => {
    it('auto → the opposite of the side last DRAWN → back to auto', () => {
      ctx.drawn = [{ type: 'tie', fromNoteId: from, tieDirection: -1, bbox: { x: 0, y: 0, width: 1, height: 1 } } as ElementInfo]
      expect(tie.flipTie(from)).toBe(true)
      expect(ctx.score.getNotePitch(from)!.tieDirection).toBe(1)
      expect(tie.flipTie(from)).toBe(true)
      expect(ctx.score.getNotePitch(from)!.tieDirection).toBeUndefined()
      expect(ctx.log).toEqual(['mutate:Flip tie', 'mutate:Reset tie to auto'])
    })

    it('a note that owns no tie has nothing to flip', () => {
      expect(tie.flipTie(untied)).toBe(false)
      expect(tie.flipTie('nobody')).toBe(false)
    })
  })
})
