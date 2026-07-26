import { describe, it, expect } from 'vitest'
import { prevailingAlterations, prevailingAlterAt, displayedAccidentals, type AccidentalNote } from './accidentalState'
import type { Chord, FanMark, NotePitch, PitchAlter, PitchStep } from '@/types/music'
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

/**
 * The FORWARD walk — the sign each pitch actually displays. Extracted from `NoteBuilder` so a fanned
 * group's members obey the same rule as the notes around them (docs/fanned-beam-pitches-plan.md §2).
 */
describe('displayedAccidentals', () => {
  const pitch = (id: string, step: PitchStep, alter: PitchAlter, extra: Partial<NotePitch> = {}): NotePitch =>
    ({ id, step, alter, octave: 4, ...extra })

  const chord = (id: string, notes: NotePitch[], beat: number, fan?: FanMark): Chord => ({
    id, type: 'chord', beat: frac(beat, 1), duration: 'q', measure: 1, notes, ...(fan ? { fan } : {}),
  })

  it('shows an alteration once and suppresses it while it is in force', () => {
    const signs = displayedAccidentals([
      chord('s1', [pitch('a', 'F', 1)], 0),
      chord('s2', [pitch('b', 'F', 1)], 1),
    ])
    expect(signs.get('a')).toBe('#')
    expect(signs.get('b')).toBeNull()
  })

  it('cancels it with a natural when the plain pitch returns', () => {
    const signs = displayedAccidentals([
      chord('s1', [pitch('a', 'F', 1)], 0),
      chord('s2', [pitch('b', 'F', 0)], 1),
    ])
    expect(signs.get('b')).toBe('n')
  })

  it('never re-states one on a tied continuation', () => {
    const signs = displayedAccidentals([chord('s1', [pitch('a', 'F', 1, { tiedFrom: 'x' })], 0)])
    expect(signs.get('a')).toBeNull()
  })

  it('⭐ decides a fanned MEMBER’s sign too — the drawing reads it, it does not invent one', () => {
    const fan: FanMark = {
      direction: 'accel', count: 3, beams: 3,
      members: [[pitch('m1', 'G', 1)], [pitch('m2', 'G', 1)]],
    }
    const signs = displayedAccidentals([chord('s1', [pitch('a', 'C', 0)], 0, fan)])
    expect(signs.get('m1')).toBe('#') // the first G♯ of the bar shows its sign
    expect(signs.get('m2')).toBeNull() // the second is already in force
  })

  it('⭐ a member’s accidental HOLDS FOR THE REST OF THE BAR', () => {
    // His decision, and the ordinary common-practice rule: a member is a note in the bar. Left out,
    // the plain G after the fan would draw no natural at all.
    const fan: FanMark = {
      direction: 'accel', count: 2, beams: 3, members: [[pitch('m1', 'G', 1)]],
    }
    const signs = displayedAccidentals([
      chord('s1', [pitch('a', 'C', 0)], 0, fan),
      chord('s2', [pitch('b', 'G', 0)], 1),
    ])
    expect(signs.get('b')).toBe('n')
  })

  it('the DEFAULT fan (every member the note you typed) shows exactly one sign', () => {
    const fan: FanMark = {
      direction: 'accel', count: 3, beams: 3,
      members: [[pitch('m1', 'F', 1)], [pitch('m2', 'F', 1)]],
    }
    const signs = displayedAccidentals([chord('s1', [pitch('a', 'F', 1)], 0, fan)])
    expect([signs.get('a'), signs.get('m1'), signs.get('m2')]).toEqual(['#', null, null])
  })
})
