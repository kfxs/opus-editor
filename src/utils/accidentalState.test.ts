import { describe, it, expect } from 'vitest'
import { prevailingAlterations, prevailingAlterAt, type AccidentalNote } from './accidentalState'
import { fracCreate as frac } from './fraction'
import { spellingDiatonicPos } from './pitchSpelling'

// Pins the ONE running-accidental rule the three consumers share, so they can never drift:
// tied continuations excluded, beat-ordered (last wins), same diatonic position only, and
// strictly BEFORE the target beat (a chord never alters itself).
describe('accidentalState.prevailingAlterations', () => {
  const F4 = spellingDiatonicPos('F', 4)
  const G4 = spellingDiatonicPos('G', 4)

  const at = (beat: number, extra: Partial<AccidentalNote>): AccidentalNote =>
    ({ step: 'F', octave: 4, alter: 0, beat: frac(beat, 1), ...extra })

  it('keeps the LAST preceding alteration at a diatonic position (beat-ordered)', () => {
    const notes = [at(0, { alter: 1 }), at(1, { alter: -1 })]
    expect(prevailingAlterAt(notes, F4, frac(2, 1))).toBe(-1)
  })

  it('keys by diatonic position — a different position does not leak', () => {
    const notes = [at(0, { step: 'F', alter: 1 })]
    expect(prevailingAlterAt(notes, G4, frac(2, 1))).toBe(0) // G untouched by F#
  })

  it('excludes tied continuations (a tied note re-states nothing)', () => {
    const notes = [at(0, { alter: 1, tiedFrom: 'x' })]
    expect(prevailingAlterAt(notes, F4, frac(2, 1))).toBe(0)
  })

  it('excludes rests', () => {
    const notes: AccidentalNote[] = [{ isRest: true, beat: frac(0, 1) }, at(1, { alter: 1 })]
    expect(prevailingAlterAt(notes, F4, frac(2, 1))).toBe(1) // only the F# counts
  })

  it('is strictly before the target beat — a same-beat note does not count', () => {
    const notes = [at(1, { alter: 1 })]
    expect(prevailingAlterAt(notes, F4, frac(1, 1))).toBe(0)
  })

  it('a position never seen is absent from the map (undefined, not 0)', () => {
    const map = prevailingAlterations([at(0, { alter: 1 })], frac(2, 1))
    expect(map.get(F4)).toBe(1)
    expect(map.has(G4)).toBe(false)
  })
})
