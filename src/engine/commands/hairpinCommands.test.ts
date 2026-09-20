/**
 * The HAIRPIN's commands — what the module adds over `hairpinOps`: which seam an edit records
 * through, and the three limits an END is judged by. Built on {@link fakeCommandContext}.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { fracCreate as frac } from '@/utils/fraction'
import type { ElementInfo } from '../ElementRegistry'
import { hairpinEndpointOffsetOverrideOf } from '../models/engravingOverrides'
import { fakeCommandContext, type FakeCommandContext } from './fakeCommandContext'
import { hairpinCommands, type HairpinCommands } from './hairpinCommands'

describe('hairpinCommands', () => {
  let ctx: FakeCommandContext
  let hairpin: HairpinCommands
  let notes: string[]
  let id: string

  beforeEach(() => {
    ctx = fakeCommandContext()
    hairpin = hairpinCommands(ctx)
    notes = [0, 1, 2, 3].map(i =>
      ctx.score.addNote({ step: 'C', alter: 0, octave: 5, duration: 'q', measure: 1, beat: frac(i, 1) }).id)
    id = hairpin.createHairpin([notes[0], notes[1]], 'cresc')!.id
    ctx.log.length = 0
  })

  const ends = () => hairpinEndpointOffsetOverrideOf(ctx.score.getScore(), id)

  describe('one edit is ONE undo entry', () => {
    it('extent, type, ink and mouth: each edit is one entry, whatever it changed', () => {
      expect(hairpin.resizeHairpinBySlot(id, 1)).toBe(true)
      expect(hairpin.toggleHairpinType(id)).toBe('dim')
      expect(hairpin.nudgeHairpin(id, 0.5, 0)).toBe(true)
      expect(hairpin.nudgeHairpinEndpoint(id, 'end', 0.25, 0.25)).toBe(true)
      expect(hairpin.setHairpinAperture(id, 1.75)).toBe(true)
      expect(ctx.log.map(l => l.split(':')[0])).toEqual(['mutate', 'mutate', 'mutate', 'mutate', 'mutate'])
      expect(ctx.undoEntries()).toBe(5)
    })

    it('⭐ an edit that changed nothing records nothing', () => {
      expect(hairpin.resetHairpinOffset(id)).toBe(false)
      expect(hairpin.toggleHairpinType('gone')).toBeNull()
      expect(ctx.log).toEqual([])
    })
  })

  describe('a DRAG records per drop, never per frame', () => {
    it('frames dirty the model and record nothing; each kind of drop records one', () => {
      expect(hairpin.previewHairpinOffset(id, 0.5, 0)).toBe(true)
      expect(hairpin.previewHairpinEndpointOffset(id, 'end', 0.25, 0)).toBe(true)
      expect(ctx.undoEntries()).toBe(0)
      hairpin.commitHairpinOffsetDrag()
      hairpin.commitHairpinDrag('end')
      expect(ctx.log).toEqual(['dirty', 'dirty', 'previewed:Move hairpin', 'previewed:Resize hairpin'])
    })
  })

  describe('the limits', () => {
    it('the WHOLE wedge is judged by the page alone', () => {
      hairpin.nudgeHairpin(id, 1, -0.5)
      expect(ctx.asked).toEqual([{ limit: 'page', dx: 1, dy: -0.5 }])
    })

    it('⭐ an END is judged on TWO axes: its x by the span-end rule, its y by the page', () => {
      hairpin.nudgeHairpinEndpoint(id, 'end', 0.5, 0)
      expect(ctx.asked.map(a => a.limit), 'no vertical, no page question').toEqual(['spanEnd'])
      ctx.asked.length = 0
      hairpin.nudgeHairpinEndpoint(id, 'end', 0.5, 1)
      expect(ctx.asked.map(a => a.limit)).toEqual(['spanEnd', 'page'])
    })

    it('⭐⭐ …and by the BAND once that end is DRAWN — a `y` tilts the wedge into a neighbour’s room', () => {
      // No picture, no band question (above). With the wedge and its end square on the page the
      // third limit is asked, about THAT end's ink, in the lane the wedge was drawn in.
      ctx.drawn = [
        { type: 'hairpin', id, measure: 1, staff: 0, bbox: { x: 100, y: 50, width: 80, height: 10 } },
        { type: 'hairpin-endpoint', hairpinId: id, endpoint: 'end', bbox: { x: 176, y: 46, width: 18, height: 18 } },
      ] as ElementInfo[]
      ctx.allow.band = false
      expect(hairpin.nudgeHairpinEndpoint(id, 'end', 0, 1)).toBe(false)
      expect(ctx.asked.map(a => a.limit)).toEqual(['spanEnd', 'page', 'band'])
      expect(ends()).toBeUndefined()
      expect(ctx.log).toEqual([])
    })

    it('⛔ ANY refusal writes nothing and records nothing — keyboard and drag alike', () => {
      ctx.allow.spanEnd = false
      expect(hairpin.nudgeHairpinEndpoint(id, 'start', -1, 0)).toBe(false)
      expect(hairpin.previewHairpinEndpointOffset(id, 'start', -1, 0)).toBe(false)
      ctx.allow.page = false
      expect(hairpin.nudgeHairpin(id, 0, 3)).toBe(false)
      expect(hairpin.previewHairpinOffset(id, 0, 3)).toBe(false)
      expect(ends()).toBeUndefined()
      expect(ctx.log).toEqual([])
    })

    it('⛔ a RE-BASE is never judged — it pays back a move the anchor made, so no ink moves', () => {
      ctx.allow.page = ctx.allow.spanEnd = ctx.allow.band = false
      expect(hairpin.previewHairpinEndpointRebase(id, 'start', 2)).toBe(true)
      expect(hairpin.previewHairpinOffsetRebase(id, 2)).toBe(true)
      expect(ctx.asked).toEqual([])
    })
  })
})
