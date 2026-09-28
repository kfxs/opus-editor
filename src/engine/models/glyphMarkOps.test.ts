/**
 * {@link glyphMarkOps} — the user's SYMBOLS as score operations (docs/plans/symbol-plan.md P0).
 * A `ScoreModel` is the fixture; what is under test is the free functions.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { ScoreModel } from './ScoreModel'
import {
  addGlyphMark,
  addGlyphMarkToEvent,
  removeGlyphMark,
  getGlyphMarkById,
  glyphMarkMeasure,
  measureGlyphMarks,
} from './glyphMarkOps'
import { setEngravingOverride } from './overrideOps'
import { fracCreate as frac } from '@/utils/fraction'
import type { EngravingOverride, Score } from '@/types/music'

describe('glyphMarkOps', () => {
  let model: ScoreModel
  let score: Score
  beforeEach(() => {
    model = new ScoreModel()
    model.addMeasure()
    score = model.getScore()
  })

  it('adds a mark at a beat, with a fresh id', () => {
    const g = addGlyphMark(score, 1, { glyph: 'pictGlsp', beat: frac(1, 1) })!
    expect(g.id).toBeTruthy()
    expect(getGlyphMarkById(score, g.id)).toBe(g)
    expect(glyphMarkMeasure(score, g.id)!.number).toBe(1)
    expect(measureGlyphMarks(score.measures[0])).toEqual([g])
  })

  it('never replaces: any number share an address, the same glyph twice included, in the order added', () => {
    const a = addGlyphMark(score, 1, { glyph: 'pictGlsp', beat: frac(2, 1) })!
    const b = addGlyphMark(score, 1, { glyph: 'pictGlsp', beat: frac(2, 1) })!
    const c = addGlyphMark(score, 1, { glyph: 'pictXyl', beat: frac(2, 1) })!
    expect(measureGlyphMarks(score.measures[0]).map(g => g.id)).toEqual([a.id, b.id, c.id])
  })

  it('keeps the list sorted by beat without disturbing the added order within a beat', () => {
    const late1 = addGlyphMark(score, 1, { glyph: 'pictGlsp', beat: frac(3, 1) })!
    const early = addGlyphMark(score, 1, { glyph: 'pictXyl', beat: frac(0, 1) })!
    const late2 = addGlyphMark(score, 1, { glyph: 'pictVib', beat: frac(3, 1) })!
    expect(measureGlyphMarks(score.measures[0]).map(g => g.id)).toEqual([early.id, late1.id, late2.id])
  })

  it('refuses a mark with no glyph, or in a measure that does not exist', () => {
    expect(addGlyphMark(score, 1, { glyph: '', beat: frac(0, 1) })).toBeNull()
    expect(addGlyphMark(score, 9, { glyph: 'pictGlsp', beat: frac(0, 1) })).toBeNull()
    expect(score.measures[0].glyphMarks).toBeUndefined()
  })

  it('removes by id, deleting the emptied list and the override keyed by the mark', () => {
    const g = addGlyphMark(score, 1, { glyph: 'pictGlsp', beat: frac(0, 1) })!
    setEngravingOverride(score, g.id, { kind: 'test' } as EngravingOverride)
    expect(removeGlyphMark(score, g.id)).toBe(true)
    expect(score.measures[0].glyphMarks).toBeUndefined()
    expect(score.engravingOverrides?.[g.id]).toBeUndefined()
    expect(removeGlyphMark(score, g.id)).toBe(false)
  })

  it('round-trips through JSON in stack order, and an absent list stays absent', () => {
    const a = addGlyphMark(score, 1, { glyph: 'pictGlsp', beat: frac(1, 1), placement: 'below', voice: 1 })!
    const b = addGlyphMark(score, 1, { glyph: 'pictXyl', beat: frac(1, 1) })!
    const loaded = ScoreModel.fromJSON(model.toJSON()).getScore()
    expect(loaded.measures[0].glyphMarks).toEqual([a, b])
    expect(loaded.measures[1].glyphMarks).toBeUndefined()
    expect(model.toJSON()).not.toMatch(/"glyphMarks": \[\]/)
  })

  describe('addGlyphMarkToEvent', () => {
    it("files the mark at the event's own address — any head of a chord names the chord", () => {
      const c = model.addNote({ step: 'C', octave: 4, duration: 'q', measure: 2, beat: frac(1, 1) })
      const e = model.addNote({ step: 'E', octave: 4, duration: 'q', measure: 2, beat: frac(1, 1) })
      const chord = score.measures[1].slots.find(s => s.type === 'chord')
      expect(chord?.type === 'chord' && chord.notes.map(n => n.id)).toEqual([c.id, e.id]) // one chord, two heads
      const a = addGlyphMarkToEvent(score, c.id, 'pictGlsp')!
      const b = addGlyphMarkToEvent(score, e.id, 'pictXyl')!
      expect(glyphMarkMeasure(score, a.id)!.number).toBe(2)
      expect([a.beat, b.beat]).toEqual([frac(1, 1), frac(1, 1)])
      expect(a.voice).toBeUndefined()
      expect(a.staffId).toBeUndefined()
      expect(measureGlyphMarks(score.measures[1]).map(g => g.id)).toEqual([a.id, b.id])
    })

    it('takes a rest by its slot id, and keeps a second voice', () => {
      const n = model.addNote({ step: 'G', octave: 4, duration: 'q', measure: 1, beat: frac(0, 1), voice: 1 })
      const rest = score.measures[0].slots.find(s => s.type === 'rest' && (s.voice ?? 0) === 0)!
      expect(addGlyphMarkToEvent(score, rest.id, 'fermataAbove')!.beat).toEqual(rest.beat)
      expect(addGlyphMarkToEvent(score, n.id, 'fermataBelow')!.voice).toBe(1)
    })

    it('refuses an id that names no event', () => {
      expect(addGlyphMarkToEvent(score, 'nope', 'pictGlsp')).toBeNull()
    })
  })
})
