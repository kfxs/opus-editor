import { describe, it, expect } from 'vitest'
import { Voice, Formatter, StaveNote, Beam } from 'vexflow'
import { createStaveNotesFromSlots } from './NoteBuilder'
import type { ChordRest } from '@/types/music'
import { fracCreate } from '@/utils/fraction'

// Regression guard for the 3-voice stem bug (docs/multi-voice-plan.md §13).
//
// When three voices collide at one tick, VexFlow's StaveNote.format() REASSIGNS
// stem directions to spread the noteheads — overriding both our voice-parity default
// AND the user's `x` stem override. VexFlowRenderer defeats this by capturing each
// note's intended stem BEFORE format and re-asserting it after. These tests pin both
// halves: that VexFlow really does flip it, and that the re-assert restores it.

function chord(id: string, step: string, octave: number, voice: number): ChordRest {
  return {
    id, type: 'chord', beat: fracCreate(0, 1), duration: '8', measure: 2, voice,
    notes: [{ id: id + '-p', step, alter: 0, octave }],
  } as unknown as ChordRest
}

// A4 (V1/v0), C4 (V2/v1), E5 (V3/v2) all at beat 0 — the reported score's bar 2.
function buildThreeVoices() {
  const v0 = createStaveNotesFromSlots([chord('a', 'A', 4, 0)], 'treble', 1)  // V1 forced up
  const v1 = createStaveNotesFromSlots([chord('c', 'C', 4, 1)], 'treble', -1) // V2 forced down
  const v2 = createStaveNotesFromSlots([chord('e', 'E', 5, 2)], 'treble', 1)  // V3 forced up
  return { v0, v1, v2 }
}

function format(groups: StaveNote[][]) {
  const voices = groups.map(sn => {
    const v = new Voice({ numBeats: 4, beatValue: 4 }).setMode(2)
    v.addTickables(sn)
    return v
  })
  new Formatter().joinVoices(voices).format(voices, 300)
}

describe('multi-voice stem direction', () => {
  it('createStaveNotesFromSlots honours the forced (parity) stem for V3', () => {
    const { v2 } = buildThreeVoices()
    expect(v2[0].getStemDirection()).toBe(1) // up, before any formatting
  })

  it('VexFlow.format flips the V3 stem down (the bug we mitigate)', () => {
    const { v0, v1, v2 } = buildThreeVoices()
    format([v0, v1, v2])
    expect(v2[0].getStemDirection()).toBe(-1) // VexFlow overrode our up stem
  })

  it('re-asserting the captured stem after format restores V3 to up', () => {
    const { v0, v1, v2 } = buildThreeVoices()
    const intended = new Map<StaveNote, number>()
    for (const sn of [...v0, ...v1, ...v2]) intended.set(sn, sn.getStemDirection())

    format([v0, v1, v2])
    for (const sn of [...v0, ...v1, ...v2]) {
      const dir = intended.get(sn)!
      if (sn.getStemDirection() !== dir) sn.setStemDirection(dir)
    }
    expect(v2[0].getStemDirection()).toBe(1)
  })

  // Four voices at one tick (A4/V1, E4/V2, E5/V3, A3/V4): VexFlow X-shifts a colliding
  // notehead sideways. We keep the voices stacked at the shared X.
  function buildFourVoices() {
    return [
      createStaveNotesFromSlots([chord('a4', 'A', 4, 0)], 'treble', 1),
      createStaveNotesFromSlots([chord('e4', 'E', 4, 1)], 'treble', -1),
      createStaveNotesFromSlots([chord('e5', 'E', 5, 2)], 'treble', 1),
      createStaveNotesFromSlots([chord('a3', 'A', 3, 3)], 'treble', -1),
    ]
  }

  it('VexFlow.format X-shifts a colliding voice (the offset we undo)', () => {
    const g = buildFourVoices()
    format(g)
    // At least one voice picked up a non-zero horizontal shift from VexFlow.
    expect(g.some(sn => sn[0].getXShift() !== 0)).toBe(true)
  })

  it('re-asserting the captured X-shift keeps every voice at the shared X', () => {
    const g = buildFourVoices()
    const intended = new Map<StaveNote, number>()
    for (const sn of g) intended.set(sn[0], sn[0].getXShift())

    format(g)
    for (const sn of g) {
      const xs = intended.get(sn[0])!
      if (sn[0].getXShift() !== xs) sn[0].setXShift(xs)
    }
    expect(g.every(sn => sn[0].getXShift() === 0)).toBe(true)
  })
})

/**
 * The re-assert's OTHER edge: it must not fight a beam.
 *
 * A beam group has exactly ONE stem direction — an `x` flip on any member flips the beam, because a
 * beam cannot attach to stems pointing opposite ways. But `intendedStemDir` is captured BEFORE the
 * beams are built, from each note's own override or the voice's forced side, so in a multi-voice bar
 * the flipped note's PARTNERS were still marked with the voice's side. The re-assert then dragged
 * them back, and `StemmableNote.setStemDirection` CLEARS `note.beam` on the way: the partner drew its
 * own stem and a flag while the beam went on drawing a stem for it.
 *
 * These pin the VexFlow behaviour that makes it dangerous, and the rule that defuses it: once a note
 * is beamed, its intended direction IS the beam's.
 */
describe('multi-voice stem direction — a beam owns its group', () => {
  it('setStemDirection clears the note beam (why a stale re-assert is destructive)', () => {
    const notes = createStaveNotesFromSlots(
      [chord('a', 'C', 5, 0), chord('b', 'D', 5, 0)], 'treble', 1)
    new Beam(notes)
    expect(notes[0].hasBeam()).toBe(true)

    notes[0].setStemDirection(-1)
    expect(notes[0].hasBeam(), 'the beam is gone — the note will draw its own stem AND a flag')
      .toBe(false)
  })

  it('a beamed note re-asserts the BEAM direction, not the one it was built with', () => {
    // V1 forced up; the second note carries an `x` flip, so the group's direction is DOWN.
    const notes = createStaveNotesFromSlots(
      [chord('a', 'C', 5, 0), chord('b', 'D', 5, 0)], 'treble', 1)
    const intended = new Map<StaveNote, number>()
    for (const sn of notes) intended.set(sn, sn.getStemDirection()) // captured BEFORE the beam

    for (const sn of notes) sn.setStemDirection(-1) // what buildBeams does to the whole group
    new Beam(notes)
    // The refresh under test: a beamed note's intention is whatever the beam decided.
    for (const sn of notes) if (intended.has(sn) && sn.hasBeam()) intended.set(sn, sn.getStemDirection())

    format([notes])
    for (const sn of notes) {
      const dir = intended.get(sn)!
      if (sn.getStemDirection() !== dir) sn.setStemDirection(dir)
    }

    expect(notes.every(sn => sn.getStemDirection() === -1), 'one group, one direction').toBe(true)
    expect(notes.every(sn => sn.hasBeam()), 'and nothing lost its beam').toBe(true)
  })
})
