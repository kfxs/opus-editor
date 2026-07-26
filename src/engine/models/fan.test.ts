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
    expect(chord.fan).toMatchObject(FAN)
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
    expect(chordAt(0).fan).toMatchObject(FAN)
    expect('tremolo' in chordAt(0)).toBe(false)
  })

  it('a fan takes a two-note PAIR off, style and all', () => {
    const { a } = twoQuarters()
    model.setTremoloPair(a.id, true)
    model.setTremoloPairStyle(a.id, 'joined')
    model.setFan(a.id, FAN)
    expect(chordAt(0).fan).toMatchObject(FAN)
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
    expect(chordAt(0).fan).toMatchObject(FAN)
  })
})

/**
 * THE MEMBERS (docs/fanned-beam-pitches-plan.md §1) — the one thing inside a fan that is stored,
 * because a pitch cannot be derived. `setFan` is the only door: it runs every mark through
 * `normalizeFan`, which owns the `members.length === count - 1` off-by-one.
 */
describe('setFan — the members', () => {
  let model: ScoreModel
  const fan = (count: number, beams = 3): FanMark => ({ direction: 'accel', count, beams })

  beforeEach(() => { model = new ScoreModel('Fanned beams') })

  const chordAt = (beat: number): Chord => {
    const slot = model.getMeasure(1)!.slots.find(s => fracToNumber(s.beat) === beat)!
    if (slot?.type !== 'chord') throw new Error('expected a chord slot')
    return slot
  }
  const members = () => chordAt(0).fan!.members!
  const blanca = () => model.addNote({ step: 'C', octave: 4, duration: 'h', measure: 1, beat: frac(0, 1) })

  it('⭐ member 0 IS the slot\'s own chord — the list holds the OTHER count-1', () => {
    const note = blanca()
    model.setFan(note.id, fan(6))
    expect(members()).toHaveLength(5)
    expect(chordAt(0).notes).toHaveLength(1)
    expect(chordAt(0).notes[0].id).toBe(note.id) // never copied into the list
  })

  it('materialises every member as the note that was typed — pitches, not ids', () => {
    const note = blanca()
    model.setFan(note.id, fan(4))
    expect(members().map(m => m.map(p => `${p.step}${p.octave}`).join())).toEqual(['C4', 'C4', 'C4'])
    const ids = members().flat().map(p => p.id)
    expect(new Set([...ids, note.id]).size).toBe(ids.length + 1) // every one its own note
  })

  it('a CHORD fans as a chord — each member gets all of its pitches', () => {
    const note = blanca()
    model.addNote({ step: 'E', octave: 4, duration: 'h', measure: 1, beat: frac(0, 1) }) // joins the chord
    model.setFan(note.id, fan(3))
    expect(members()).toHaveLength(2)
    expect(members().every(m => m.length === 2)).toBe(true)
  })

  it('a count of 1 is a fan with no other members, not a broken list', () => {
    const note = blanca()
    model.setFan(note.id, fan(1))
    expect(members()).toEqual([])
  })

  it('growing copies the LAST member — a rising line continues rising', () => {
    const note = blanca()
    model.setFan(note.id, fan(3))
    members()[1][0].step = 'G' // the line has been edited up to G4
    model.setFan(note.id, { ...chordAt(0).fan!, count: 5 })
    expect(members().map(m => m[0].step)).toEqual(['C', 'G', 'G', 'G'])
  })

  it('shrinking drops from the END, and the survivors keep their ids', () => {
    const note = blanca()
    model.setFan(note.id, fan(6))
    const kept = members().slice(0, 2).map(m => m[0].id)
    model.setFan(note.id, { ...chordAt(0).fan!, count: 3 })
    expect(members()).toHaveLength(2)
    expect(members().map(m => m[0].id)).toEqual(kept)
  })

  it('a clamped count still gets the members it says it has', () => {
    const note = blanca()
    model.setFan(note.id, fan(9999))
    expect(members()).toHaveLength(chordAt(0).fan!.count - 1)
  })

  it('⭐ removing the fan leaves exactly the note that was typed', () => {
    const note = blanca()
    model.setFan(note.id, fan(6))
    model.setFan(note.id, null)
    expect(chordAt(0).notes).toHaveLength(1)
    expect(chordAt(0).notes[0].id).toBe(note.id)
    expect(chordAt(0).duration).toBe('h')
  })
})
