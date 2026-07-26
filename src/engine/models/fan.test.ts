import { describe, it, expect, beforeEach } from 'vitest'
import { ScoreModel } from './ScoreModel'
import { fracCreate as frac, fracToNumber } from '@/utils/fraction'
import { DEFAULT_FAN_COUNT, DEFAULT_FAN_BEAMS } from '@/utils/fannedBeam'
import type { Chord, FanMark } from '@/types/music'

/**
 * The FAN MODEL — one field on the slot (docs/fanned-beams-plan.md §0), and the refusals that ARE
 * the notation: you cannot accelerate silence, a ramp inside a tuplet's ratio is a second
 * normalization of one span, and a slot cannot carry two answers to "how many attacks?".
 *
 * Nothing here is about how the fan is DRAWN — jsdom cannot measure glyphs, so a geometry assertion
 * would pass vacuously (reference_jsdom_cannot_measure_glyphs).
 */
describe('setFan (model)', () => {
  let model: ScoreModel
  const FAN: FanMark = { direction: 'accel', count: DEFAULT_FAN_COUNT, beams: DEFAULT_FAN_BEAMS }

  beforeEach(() => { model = new ScoreModel('Fanned beams') })

  const chordAt = (measure: number, beat: number): Chord => {
    const slot = model.getMeasure(measure)!.slots.find(s => fracToNumber(s.beat) === beat)!
    if (slot?.type !== 'chord') throw new Error('expected a chord slot')
    return slot
  }

  /** One blanca filling half of bar 1 — the note the feature is designed around. */
  const blanca = () => model.addNote({ step: 'C', octave: 4, duration: 'h', measure: 1, beat: frac(0, 1) })

  it('marks the slot, and leaves the duration and the beat alone', () => {
    const note = blanca()
    expect(model.setFan(note.id, FAN)).not.toBeNull()
    const chord = chordAt(1, 0)
    expect(chord.fan).toEqual(FAN)
    // The whole point: the model still holds ONE half note where the user typed one.
    expect(chord.duration).toBe('h')
    expect(fracToNumber(chord.beat)).toBe(0)
    expect(chord.notes).toHaveLength(1)
  })

  it('removing it puts the note back exactly as typed', () => {
    const note = blanca()
    model.setFan(note.id, FAN)
    expect(model.setFan(note.id, null)).not.toBeNull()
    expect('fan' in chordAt(1, 0)).toBe(false)
    expect(chordAt(1, 0).duration).toBe('h')
  })

  it('reports null when there is nothing to remove — not an edit, so not an undo entry', () => {
    const note = blanca()
    expect(model.setFan(note.id, null)).toBeNull()
  })

  it('refuses a REST — you cannot accelerate silence', () => {
    const rest = model.getMeasure(1)!.slots.find(s => s.type === 'rest')!
    expect(model.setFan(rest.id, FAN)).toBeNull()
  })

  it('refuses a TUPLET member — a ramp inside a ratio is a second normalization', () => {
    const tuplet = model.createTuplet(1, frac(0, 1), '8', 3, 2)
    const a = model.addNote({
      step: 'C', octave: 4, duration: '8', measure: 1, beat: frac(0, 1), tupletId: tuplet.id,
    })
    expect(chordAt(1, 0).tupletId).toBe(tuplet.id)
    expect(model.setFan(a.id, FAN)).toBeNull()
    expect('fan' in chordAt(1, 0)).toBe(false)
  })

  it('refuses an id that is not a note at all', () => {
    expect(model.setFan('no-such-id', FAN)).toBeNull()
  })
})

describe('setFan — one slot, ONE expansion', () => {
  let model: ScoreModel
  const FAN: FanMark = { direction: 'rit', count: 4, beams: 2 }

  beforeEach(() => { model = new ScoreModel('Fanned beams') })

  const chordAt = (beat: number): Chord => {
    const slot = model.getMeasure(1)!.slots.find(s => fracToNumber(s.beat) === beat)!
    if (slot?.type !== 'chord') throw new Error('expected a chord slot')
    return slot
  }

  const twoQuarters = () => ({
    a: model.addNote({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) }),
    b: model.addNote({ step: 'E', octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) }),
  })

  it('a fan takes the tremolo off', () => {
    const { a } = twoQuarters()
    model.setTremolo(a.id, 3)
    model.setFan(a.id, FAN)
    expect(chordAt(0).fan).toEqual(FAN)
    expect('tremolo' in chordAt(0)).toBe(false)
  })

  it('a fan takes a two-note PAIR off, style and all', () => {
    const { a } = twoQuarters()
    model.setTremoloPair(a.id, true)
    model.setTremoloPairStyle(a.id, 'joined')
    model.setFan(a.id, FAN)
    expect(chordAt(0).fan).toEqual(FAN)
    expect('tremoloPair' in chordAt(0)).toBe(false)
    expect('tremoloPairStyle' in chordAt(0)).toBe(false)
    expect('tremolo' in chordAt(0)).toBe(false)
  })

  it('and the other way round — setting a tremolo takes the fan off', () => {
    const { a } = twoQuarters()
    model.setFan(a.id, FAN)
    model.setTremolo(a.id, 3)
    expect('fan' in chordAt(0)).toBe(false)
    expect(chordAt(0).tremolo).toBe(3)
  })

  it('pairing takes the fan off too', () => {
    const { a } = twoQuarters()
    model.setFan(a.id, FAN)
    model.setTremoloPair(a.id, true)
    expect('fan' in chordAt(0)).toBe(false)
    expect(chordAt(0).tremoloPair).toBe(true)
  })

  it('REMOVING a tremolo says nothing about the fan — the rule is the SET, not the delete', () => {
    const { a } = twoQuarters()
    model.setFan(a.id, FAN)
    model.setTremolo(a.id, null)
    expect(chordAt(0).fan).toEqual(FAN)
  })
})
