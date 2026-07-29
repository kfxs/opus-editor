import { describe, it, expect } from 'vitest'
import { ScoreModel } from './ScoreModel'
import { collapseIntoFan } from './fanCollapse'
import { findSlot } from './slotLookup'
import { fracCreate as frac, fracToNumber } from '@/utils/fraction'
import { slotLength } from '@/utils/durations'
import type { Chord, Note, NoteDuration } from '@/types/music'

/**
 * Subject: `./fanCollapse` — turning a typed passage into ONE fanned gesture.
 *
 * What it has to guarantee is the sentence the feature is: **the group lasts exactly as long as the
 * notes did, has one attack per note, and sounds their pitches.** The first of those is the one with
 * teeth — seven sixteenths span a length no single notehead spells — and it is why the span lives on
 * the mark rather than on the slot, so the assertions below follow it through the derived
 * `actualDuration`, through a JSON round trip (which recomputes every slot's), and back out again
 * when the mark comes off.
 */

/** N notes of one value from beat 0 of bar 1, ascending from C4 — the passage you would have typed. */
function passage(n: number, duration: NoteDuration = '16'): { model: ScoreModel; notes: Note[] } {
  const model = new ScoreModel('Fan collapse')
  const step = duration === '16' ? frac(1, 4) : duration === '8' ? frac(1, 2) : frac(1, 1)
  const notes: Note[] = []
  const steps = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const
  for (let i = 0; i < n; i++) {
    notes.push(model.addNote({
      step: steps[i % 7], octave: 4, duration, measure: 1,
      beat: frac(step.num * i, step.den),
    })!)
  }
  return { model, notes }
}

/** The one chord slot left in bar 1 (there is exactly one after a collapse). */
function onlyChord(model: ScoreModel): Chord {
  const chords = model.getScore().measures[0].slots.filter((s): s is Chord => s.type === 'chord')
  expect(chords).toHaveLength(1)
  return chords[0]
}

describe('collapseIntoFan — the length', () => {
  it('SEVEN sixteenths become one fanned slot lasting 7/16 — a span no notehead spells', () => {
    const { model, notes } = passage(7)
    const survivor = model.collapseIntoFan(notes.map(n => n.id), 'accel')

    expect(survivor).not.toBeNull()
    const chord = onlyChord(model)
    expect(chord.fan?.count).toBe(7)
    // 7 sixteenths = 7/4 quarter beats. WRITTEN as the longest value that fits (a dotted quarter),
    // SOUNDING for the whole span — which is the pair of facts the mark exists to hold apart.
    expect(chord.duration).toBe('q')
    expect(chord.dots).toBe(1)
    expect(fracToNumber(chord.fan!.length!)).toBeCloseTo(1.75)
    expect(fracToNumber(slotLength(chord))).toBeCloseTo(1.75)
    expect(fracToNumber(chord.actualDuration!)).toBeCloseTo(1.75)
  })

  it('SIX sixteenths ARE a dotted quarter, so the mark carries no span at all', () => {
    const { model, notes } = passage(6)
    model.collapseIntoFan(notes.map(n => n.id), 'accel')

    const chord = onlyChord(model)
    expect(chord.duration).toBe('q')
    expect(chord.dots).toBe(1)
    // Absent is the only spelling of "the slot's own duration" — collapsing six is then
    // indistinguishable from marking one dotted quarter, which is the point.
    expect(chord.fan!.length).toBeUndefined()
    expect(fracToNumber(slotLength(chord))).toBeCloseTo(1.5)
  })

  it('FIVE sixteenths — the total that needs a tie to write — collapses like any other', () => {
    const { model, notes } = passage(5)
    model.collapseIntoFan(notes.map(n => n.id), 'rit')

    const chord = onlyChord(model)
    expect(chord.fan?.direction).toBe('rit')
    expect(chord.fan?.count).toBe(5)
    expect(chord.duration).toBe('q') // 5/16 = a quarter, carrying the odd sixteenth on the mark
    expect(chord.dots).toBeUndefined()
    expect(fracToNumber(slotLength(chord))).toBeCloseTo(1.25)
  })

  it('the span survives a JSON round trip — which RECOMPUTES every slot\'s sounding length', () => {
    const { model, notes } = passage(7)
    model.collapseIntoFan(notes.map(n => n.id), 'accel')

    const reloaded = ScoreModel.fromJSON(model.toJSON())
    const chord = onlyChord(reloaded)
    expect(fracToNumber(chord.actualDuration!)).toBeCloseTo(1.75)
    expect(chord.fan?.count).toBe(7)
  })

  it('taking the fan off leaves the WRITTEN value, and the bar closes the difference with a rest', () => {
    const { model, notes } = passage(7)
    model.collapseIntoFan(notes.map(n => n.id), 'accel')
    const chord = onlyChord(model)

    model.setFan(chord.notes[0].id, null)

    const after = onlyChord(model)
    expect(after.fan).toBeUndefined()
    expect(fracToNumber(slotLength(after))).toBeCloseTo(1.5) // the dotted quarter it is written as
    // …and the sixteenth the group gave back is silence now, not a hole in the bar.
    const rests = model.getScore().measures[0].slots.filter(s => s.type === 'rest')
    const filled = rests.reduce((sum, r) => sum + fracToNumber(slotLength(r)), 1.5)
    expect(filled).toBeCloseTo(4)
  })
})

describe('collapseIntoFan — the attacks', () => {
  it('one member per selected slot, at the pitches typed, KEEPING their ids', () => {
    const { model, notes } = passage(4)
    model.collapseIntoFan(notes.map(n => n.id), 'accel')

    const chord = onlyChord(model)
    expect(chord.notes[0].id).toBe(notes[0].id) // member 0 IS the slot's own chord
    expect(chord.fan!.members).toHaveLength(3)
    expect(chord.fan!.members!.map(m => m.pitches[0].id)).toEqual([notes[1].id, notes[2].id, notes[3].id])
    expect(chord.fan!.members!.map(m => m.pitches[0].step)).toEqual(['D', 'E', 'F'])
    // …so an id from the passage still resolves — to the member it became.
    const found = findSlot(model.getScore(), notes[2].id, { fanMembers: true })
    expect(found?.type === 'chord' && found.member?.index).toBe(2)
  })

  it('a member carries the marks its note wore', () => {
    const { model, notes } = passage(3)
    model.updateNote(notes[2].id, { articulations: ['staccato'] })
    model.collapseIntoFan(notes.map(n => n.id), 'accel')

    const chord = onlyChord(model)
    expect(chord.fan!.members![1].articulations).toEqual(['staccato'])
    expect(chord.articulations).toBeUndefined() // …and only that one's
  })

  it('the beams open to what was typed: sixteenths feather to two lines', () => {
    const { model, notes } = passage(4)
    model.collapseIntoFan(notes.map(n => n.id), 'accel')
    expect(onlyChord(model).fan?.beams).toBe(2)

    const eighths = passage(4, '8')
    eighths.model.collapseIntoFan(eighths.notes.map(n => n.id), 'accel')
    // An eighth has one flag of its own, but a fan needs two levels to read as one.
    expect(onlyChord(eighths.model).fan?.beams).toBe(2)
  })

  it('TIES inside the passage are cut — a member has no length to continue into', () => {
    const { model, notes } = passage(3)
    model.updateNote(notes[0].id, { tiedTo: notes[1].id })
    model.updateNote(notes[1].id, { tiedFrom: notes[0].id })

    model.collapseIntoFan(notes.map(n => n.id), 'accel')

    const chord = onlyChord(model)
    expect(chord.notes[0].tiedTo).toBeUndefined()
    expect(chord.fan!.members![0].pitches[0].tiedFrom).toBeUndefined()
  })

  it('a tie INTO the passage survives — the group\'s first note is a real note', () => {
    const model = new ScoreModel('Fan collapse')
    const before = model.addNote({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })!
    const a = model.addNote({ step: 'C', octave: 4, duration: '8', measure: 1, beat: frac(1, 1) })!
    const b = model.addNote({ step: 'D', octave: 4, duration: '8', measure: 1, beat: frac(3, 2) })!
    model.updateNote(before.id, { tiedTo: a.id })
    model.updateNote(a.id, { tiedFrom: before.id })

    model.collapseIntoFan([a.id, b.id], 'accel')

    // Member 0 IS the slot's own chord — a note with a duration, tied into like any other. Only the
    // notes that BECOME members lose their ties, because a member has no length to continue into.
    const chords = model.getScore().measures[0].slots.filter((s): s is Chord => s.type === 'chord')
    expect(chords.find(c => c.notes[0].id === before.id)!.notes[0].tiedTo).toBe(a.id)
    expect(chords.find(c => c.notes[0].id === a.id)!.notes[0].tiedFrom).toBe(before.id)
  })
})

describe('collapseIntoFan — what is not a passage', () => {
  const refuses = (label: string, build: () => { model: ScoreModel; ids: string[] }) => {
    it(label, () => {
      const { model, ids } = build()
      const slotsBefore = JSON.stringify(model.getScore().measures.map(m => m.slots.length))
      expect(collapseIntoFan(model.getScore(), ids, 'accel')).toBeNull()
      expect(JSON.stringify(model.getScore().measures.map(m => m.slots.length))).toBe(slotsBefore)
    })
  }

  refuses('one note is not a passage — that is what setFan is for', () => {
    const { model, notes } = passage(3)
    return { model, ids: [notes[0].id] }
  })

  refuses('a GAP in the selection — the note between them was not chosen', () => {
    const { model, notes } = passage(4)
    return { model, ids: [notes[0].id, notes[1].id, notes[3].id] }
  })

  refuses('a REST inside the run — silence is not an attack', () => {
    const model = new ScoreModel('Fan collapse')
    const a = model.addNote({ step: 'C', octave: 4, duration: '8', measure: 1, beat: frac(0, 1) })!
    const b = model.addNote({ step: 'D', octave: 4, duration: '8', measure: 1, beat: frac(1, 1) })!
    return { model, ids: [a.id, b.id] } // beat 1/2 is a rest
  })

  refuses('two BARS — a fan is one event, and an event is in one measure', () => {
    const model = new ScoreModel('Fan collapse')
    model.addMeasure()
    const a = model.addNote({ step: 'C', octave: 4, duration: 'w', measure: 1, beat: frac(0, 1) })!
    const b = model.addNote({ step: 'D', octave: 4, duration: 'w', measure: 2, beat: frac(0, 1) })!
    return { model, ids: [a.id, b.id] }
  })

  refuses('two VOICES — likewise', () => {
    const model = new ScoreModel('Fan collapse')
    const a = model.addNote({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })!
    const b = model.addNote({ step: 'D', octave: 4, duration: 'q', measure: 1, beat: frac(1, 1), voice: 1 })!
    return { model, ids: [a.id, b.id] }
  })

  refuses('a slot that is already FANNED — its members would go silently', () => {
    const { model, notes } = passage(3)
    model.setFan(notes[1].id, { direction: 'accel', count: 4, beams: 3 })
    return { model, ids: notes.map(n => n.id) }
  })
})
