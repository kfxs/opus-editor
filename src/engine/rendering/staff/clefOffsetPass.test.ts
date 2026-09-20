/**
 * WHERE a hand-nudged inline clef ends up: {@link applyClefOffsets} turns the stored staff-space
 * offset into the glyph's own shift (`EngravedClefChange.glyphShift`), in the staff's pixels.
 *
 * Subject: {@link applyClefOffsets}. ⚠️ jsdom draws nothing, so this asserts the ARITHMETIC and the
 * addressing — which glyph is shifted, by how much, and on whose staff. That the shift then moves the
 * hit box and the clef segment is the browser suite's, since both are read off the drawn geometry.
 */
import { describe, it, expect } from 'vitest'
import { applyClefOffsets } from './clefOffsetPass'
import { setEngravingOverride } from '@/engine/models/overrideOps'
import type { Measure, Score } from '@/types/music'
import type { EngravedStave } from '../engraved/EngravedStave'
import { EngravedClefChange } from '../engraved/EngravedClefChange'

const frac = (num: number, den = 1) => ({ num, den })
/** A staff whose lines are 10 px apart — so one staff-space is 10 px. */
const stave = {
  getYForLine: (line: number) => line * 10,
  getSpacingBetweenLines: () => 10,
  getNumLines: () => 5,
} as unknown as EngravedStave
/**
 * An inline clef change, already shifted by `initial` — ⭐ the shift is the GLYPH's (`glyphShift`), not
 * the note's `getXShift()`, which a clef change answers 0 to and never draws, as `ClefNote` did.
 */
function glyph(initial = 0): EngravedClefChange {
  const change = new EngravedClefChange('bass')
  change.glyphShift = initial
  return change
}

function fixture(staffId?: string): { measure: Measure; score: Score } {
  const measure = {
    id: 'm2', number: 2, slots: [], timeSignature: { numerator: 4, denominator: 4 }, tuplets: [],
    clefs: [{ id: 'c1', beat: frac(2), clef: 'bass', ...(staffId ? { staffId } : {}) }],
  } as unknown as Measure
  return { measure, score: { id: 's', title: '', measures: [measure] } as unknown as Score }
}

describe('applying an inline clef’s offset', () => {
  it('shifts the glyph by the offset, in the staff’s own pixels', () => {
    const { measure, score } = fixture()
    setEngravingOverride(score, 'c1', { kind: 'clefOffset', x: 1.5 } as never)
    const clefNote = glyph()
    applyClefOffsets(measure, undefined, [{ beat: frac(2), clefNote }], score, stave)
    expect(clefNote.glyphShift).toBe(15) // 1.5 staff-spaces × 10 px
  })

  it('⭐ ADDS to the glyph’s existing shift — a second writer must not be clobbered', () => {
    const { measure, score } = fixture()
    setEngravingOverride(score, 'c1', { kind: 'clefOffset', x: 1 } as never)
    const clefNote = glyph(4)
    applyClefOffsets(measure, undefined, [{ beat: frac(2), clefNote }], score, stave)
    expect(clefNote.glyphShift).toBe(14)
  })

  it('leaves a clef with no offset exactly where the engraver put it', () => {
    const { measure, score } = fixture()
    const clefNote = glyph()
    applyClefOffsets(measure, undefined, [{ beat: frac(2), clefNote }], score, stave)
    expect(clefNote.glyphShift).toBe(0)
  })

  it('⚠️ matches on the STAFF too — a clef is per-staff, and staff 0 stores an ABSENT id', () => {
    // The trap this guards: `staffIdAtIndex` hands back staff 0's REAL id, which matches no clef.
    const { measure, score } = fixture()
    setEngravingOverride(score, 'c1', { kind: 'clefOffset', x: 2 } as never)
    const clefNote = glyph()
    applyClefOffsets(measure, 'staff-1-id', [{ beat: frac(2), clefNote }], score, stave)
    expect(clefNote.glyphShift, 'another staff’s clef is not this one').toBe(0)
  })

  it('matches on the BEAT — two clefs in one bar move independently', () => {
    const { measure, score } = fixture()
    measure.clefs!.push({ id: 'c2', beat: frac(3), clef: 'treble' })
    setEngravingOverride(score, 'c2', { kind: 'clefOffset', x: -0.5 } as never)
    const first = glyph()
    const second = glyph()
    applyClefOffsets(
      measure, undefined,
      [{ beat: frac(2), clefNote: first }, { beat: frac(3), clefNote: second }], score, stave)
    expect([first.glyphShift, second.glyphShift]).toEqual([0, -5])
  })
})
