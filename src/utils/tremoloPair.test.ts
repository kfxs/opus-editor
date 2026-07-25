import { describe, it, expect } from 'vitest'
import { pairIsValid, pairRoleAt, laneOfSlot } from './tremoloPair'
import { fracCreate as frac } from './fraction'
import type { Chord, ChordRest, NoteDuration, Rest, BeamMode } from '@/types/music'

/**
 * The ONE validity predicate (docs/two-note-tremolo-plan.md §1). These pin the refusal list of §0 —
 * the rule the button, the renderer, the beam grouper and playback all read.
 */

let n = 0
const chord = (beat: number, duration: NoteDuration = 'q', extra: Partial<Chord> = {}): Chord => ({
  id: `c${n++}`, type: 'chord', beat: frac(beat, 1), duration, measure: 1,
  notes: [{ id: `p${n++}`, step: 'C', alter: 0, octave: 4 }],
  ...extra,
})
const rest = (beat: number, duration: NoteDuration = 'q'): Rest =>
  ({ id: `r${n++}`, type: 'rest', beat: frac(beat, 1), duration, measure: 1 })

describe('pairIsValid — a pair is two notes of the same value, side by side', () => {
  it('accepts two plain quarters', () => {
    const slots: ChordRest[] = [chord(0), chord(1)]
    expect(pairIsValid(slots, 0)).toBe(true)
  })

  it('refuses when there is no next slot', () => {
    expect(pairIsValid([chord(0)], 0)).toBe(false)
  })

  it('refuses a REST as the partner — a pair is two SOUNDING notes', () => {
    expect(pairIsValid([chord(0), rest(1)], 0)).toBe(false)
  })

  it('refuses a rest as the first note — you cannot tremolo silence', () => {
    expect(pairIsValid([rest(0), chord(1)], 0)).toBe(false)
  })

  it('refuses a different duration', () => {
    expect(pairIsValid([chord(0, 'q'), chord(1, 'h')], 0)).toBe(false)
  })

  it('refuses a different DOT count — "the same value" includes the dots', () => {
    expect(pairIsValid([chord(0, 'q', { dots: 1 }), chord(1.5, 'q')], 0)).toBe(false)
    expect(pairIsValid([chord(0, 'q', { dots: 1 }), chord(1.5, 'q', { dots: 1 })], 0)).toBe(true)
  })

  it('refuses across TUPLET membership — a triplet eighth is not a plain eighth', () => {
    expect(pairIsValid([chord(0, '8', { tupletId: 't1' }), chord(0.5, '8')], 0)).toBe(false)
    expect(pairIsValid([chord(0, '8', { tupletId: 't1' }), chord(0.5, '8', { tupletId: 't2' })], 0)).toBe(false)
    expect(pairIsValid([chord(0, '8', { tupletId: 't1' }), chord(0.5, '8', { tupletId: 't1' })], 0)).toBe(true)
  })

  it('refuses across voices, staves and bars', () => {
    expect(pairIsValid([chord(0, 'q', { voice: 0 }), chord(1, 'q', { voice: 1 })], 0)).toBe(false)
    expect(pairIsValid([chord(0, 'q', { staffId: 's1' }), chord(1, 'q')], 0)).toBe(false)
    expect(pairIsValid([chord(0), chord(1, 'q', { measure: 2 })], 0)).toBe(false)
  })

  it('refuses two WHOLE notes — the value cannot double', () => {
    expect(pairIsValid([chord(0, 'w'), chord(4, 'w')], 0)).toBe(false)
    // …and everything below the top does double.
    for (const d of ['h', 'q', '8', '16', '32'] as NoteDuration[]) {
      expect(pairIsValid([chord(0, d), chord(1, d)], 0)).toBe(true)
    }
  })

  it('refuses the PENDERECKI sign — unmeasured, so there is no stroke count to place', () => {
    expect(pairIsValid([chord(0, 'q', { tremolo: 'penderecki' }), chord(1)], 0)).toBe(false)
    expect(pairIsValid([chord(0, 'q', { tremolo: 3 }), chord(1)], 0)).toBe(true)
  })

  it('refuses an AUTHORED beam role on either slot — two answers to the same question', () => {
    for (const beam of ['single', 'begin', 'continue', 'end'] as BeamMode[]) {
      expect(pairIsValid([chord(0, '8', { beam }), chord(0.5, '8')], 0)).toBe(false)
      expect(pairIsValid([chord(0, '8'), chord(0.5, '8', { beam })], 0)).toBe(false)
    }
    // 'auto' is nobody's answer, so it does not conflict.
    expect(pairIsValid([chord(0, '8', { beam: 'auto' }), chord(0.5, '8')], 0)).toBe(true)
  })

  it('refuses a CHAIN from both ends — B cannot belong to two marks at once', () => {
    const slots: ChordRest[] = [
      chord(0, 'q', { tremoloPair: true }),
      chord(1, 'q', { tremoloPair: true }),
      chord(2),
    ]
    expect(pairIsValid(slots, 0)).toBe(false) // its partner is a first note
    expect(pairIsValid(slots, 1)).toBe(false) // it is already a second note
    expect(pairRoleAt(slots, 0)).toBeNull()
    expect(pairRoleAt(slots, 1)).toBeNull()
    expect(pairRoleAt(slots, 2)).toBeNull()
  })

  it('refuses the SECOND note of an existing pair as a new first', () => {
    const slots: ChordRest[] = [chord(0, 'q', { tremoloPair: true }), chord(1), chord(2)]
    expect(pairIsValid(slots, 1)).toBe(false)
  })
})

describe('pairRoleAt — which end of a pair a slot is', () => {
  it('names both ends of a valid pair and leaves the rest alone', () => {
    const slots: ChordRest[] = [chord(0, 'q', { tremoloPair: true }), chord(1), chord(2)]
    expect(pairRoleAt(slots, 0)).toBe('first')
    expect(pairRoleAt(slots, 1)).toBe('second')
    expect(pairRoleAt(slots, 2)).toBeNull()
  })

  it('is NULL for a STALE flag — the flag alone is not the notation', () => {
    // The partner became a rest (the rest-fill after a delete): the pair simply stops being one.
    const stale: ChordRest[] = [chord(0, 'q', { tremoloPair: true }), rest(1)]
    expect(pairRoleAt(stale, 0)).toBeNull()
    // …and so does a partner whose duration changed under it.
    const retuned: ChordRest[] = [chord(0, 'q', { tremoloPair: true }), chord(1, '8')]
    expect(pairRoleAt(retuned, 0)).toBeNull()
    expect(pairRoleAt(retuned, 1)).toBeNull()
  })

  it('is NULL without the flag, however pairable the two notes are', () => {
    const slots: ChordRest[] = [chord(0), chord(1)]
    expect(pairIsValid(slots, 0)).toBe(true)   // it COULD be a pair…
    expect(pairRoleAt(slots, 0)).toBeNull()    // …but nobody said it is.
  })
})

describe('laneOfSlot', () => {
  it('takes one voice of one staff, in beat order', () => {
    const target = chord(2, 'q', { voice: 0 })
    const measureSlots: ChordRest[] = [
      target,
      chord(0, 'q', { voice: 0 }),
      chord(1, 'q', { voice: 1 }),
      chord(1, 'q', { voice: 0, staffId: 's2' }),
      chord(1, 'q', { voice: 0 }),
    ]
    const lane = laneOfSlot(measureSlots, target)
    expect(lane.map(s => s.beat.num)).toEqual([0, 1, 2])
    expect(lane.indexOf(target)).toBe(2)
  })
})
