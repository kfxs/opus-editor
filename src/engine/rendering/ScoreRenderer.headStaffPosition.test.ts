// @vitest-environment jsdom
/**
 * A drawn head is filed in the registry with WHERE IT STANDS on the staff — its line, read off the
 * letter and the octave. It used to be filed as a MIDI number, and the registry worked the line back
 * out of it by treating every black key as the white key below: a D♭ was hit-tested on C's line,
 * a C♭ on B's, an E♯ on F's (docs/plans/alteration-signs-plan.md, M0).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { MusicEngine } from '../MusicEngine'
import { fracCreate } from '@/utils/fraction'
import type { Alteration, NoteParams, PitchStep } from '@/types/music'

describe('ScoreRenderer — a head is filed by its staff position', () => {
  let engine: MusicEngine

  beforeEach(() => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    engine = new MusicEngine({ container, width: 900, height: 500 })
  })

  const headAt = (beat: number) =>
    engine.getElementRegistry().getByMeasure(1).find(e => e.type === 'note' && e.beat === beat)!

  it.each<[PitchStep, Alteration, number]>([
    ['D', ['flat'], 29],
    ['C', ['flat'], 28],
    ['E', ['sharp'], 30],
    ['B', ['sharp'], 34],
  ])('%s %j stands on its own letter\'s line (%d)', (step, alteration, position) => {
    engine.addNoteAtBeat({ step, alteration, octave: 4, duration: 'q', measure: 1, beat: fracCreate(0, 1) } as NoteParams)
    engine.addNoteAtBeat({ step, octave: 4, duration: 'q', measure: 1, beat: fracCreate(1, 1) } as NoteParams)
    engine.renderScore()

    const altered = headAt(0)
    const plain = headAt(1)
    expect(altered.staffPosition).toBe(position)
    const registry = engine.getElementRegistry()
    expect(registry.staffPositionToPixelY(altered.staffPosition!, 1))
      .toBe(registry.staffPositionToPixelY(plain.staffPosition!, 1))
  })
})
