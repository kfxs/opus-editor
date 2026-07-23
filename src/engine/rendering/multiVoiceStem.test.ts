import { describe, it, expect } from 'vitest'
import { Voice, Formatter, StaveNote } from 'vexflow'
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
})
