import { describe, expect, it } from 'vitest'
import { ScoreModel } from '@/engine/models/ScoreModel'
import { staffMeasureView } from '@/engine/models/staffContent'
import { fracToNumber } from '@/utils/fraction'
import { getMeterInfo } from '@/utils/meter'
import type { PitchStep } from '@/types/music'
import { createStaveNotesFromSlots } from '../engraved/NoteBuilder'
import { noteRuler } from '../engraved/noteRuler'
import { PLACEHOLDER_BEAM, buildBeams } from './beamGroups'

/**
 * The module the page and the bent staff both ask *"what is one beam?"* — moved out of `ScoreRenderer`
 * on 2026-09-21 unchanged. What the page DRAWS from it is the browser suite's; here: which notes it
 * groups, that a group has ONE stem direction, and that an unbeamed note is left alone.
 */
function lane(notes: { step: PitchStep; octave: number; halfBeat: number }[]) {
  const model = new ScoreModel('beams')
  for (const n of notes) {
    model.addNote({ step: n.step, octave: n.octave, duration: '8', measure: 1, beat: { num: n.halfBeat, den: 2 }, staff: 0 })
  }
  const score = model.getScore()
  const measure = score.measures[0]
  const slots = [...staffMeasureView(measure, undefined, score).slots]
    .sort((a, b) => fracToNumber(a.beat) - fracToNumber(b.beat))
  const staveNotes = createStaveNotesFromSlots(slots, 'treble', undefined, 0, undefined)
  return { slots, staveNotes, meter: getMeterInfo(measure.timeSignature) }
}

describe('buildBeams', () => {
  it('four eighths in 4/4 are two beams of two — and every member wears its beam', () => {
    const { slots, staveNotes, meter } = lane([0, 1, 2, 3].map(halfBeat => ({ step: 'C', octave: 5, halfBeat })))
    const { beams, fanJoins } = buildBeams(staveNotes, slots, meter, () => 'treble')
    expect(beams.map(beam => beam.notes.length)).toEqual([2, 2])
    expect(fanJoins).toEqual([])
    expect(beams.flatMap(beam => [...beam.notes]).every(note => note.hasBeam())).toBe(true)
  })

  it('⭐ a group has ONE stem direction, whatever each note would choose alone', () => {
    // A low note and a high one: alone they would point opposite ways.
    const { slots, staveNotes, meter } = lane([{ step: 'D', octave: 4, halfBeat: 0 }, { step: 'G', octave: 5, halfBeat: 1 }])
    const { beams } = buildBeams(staveNotes, slots, meter, () => 'treble')
    expect(beams).toHaveLength(1)
    const directions = beams[0].notes.map(note => noteRuler(note).stemDirection)
    expect(new Set(directions).size).toBe(1)
  })

  it('a forced direction (a second voice) is the group’s', () => {
    const { slots, staveNotes, meter } = lane([0, 1].map(halfBeat => ({ step: 'C', octave: 5, halfBeat })))
    const { beams } = buildBeams(staveNotes, slots, meter, () => 'treble', 1)
    expect(beams[0].notes.map(note => noteRuler(note).stemDirection)).toEqual([1, 1])
  })

  it('a lone eighth gets no beam', () => {
    const { slots, staveNotes, meter } = lane([{ step: 'C', octave: 5, halfBeat: 1 }])
    expect(buildBeams(staveNotes, slots, meter, () => 'treble').beams).toEqual([])
  })

  it('the placeholder is a beam only in name — it formats nothing', () => {
    expect(() => PLACEHOLDER_BEAM.postFormat()).not.toThrow()
  })
})
