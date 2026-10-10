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
import type { NoteParams, PitchAlter, PitchStep } from '@/types/music'

describe('ScoreRenderer — a head is filed by its staff position', () => {
  let engine: MusicEngine

  beforeEach(() => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    engine = new MusicEngine({ container, width: 900, height: 500 })
  })

  const headAt = (beat: number) =>
    engine.getElementRegistry().getByMeasure(1).find(e => e.type === 'note' && e.beat === beat)!

  it.each<[PitchStep, PitchAlter, number]>([
    ['D', -1, 29],
    ['C', -1, 28],
    ['E', 1, 30],
    ['B', 1, 34],
  ])('%s with alter %d stands on its own letter\'s line (%d)', (step, alter, position) => {
    engine.addNoteAtBeat({ step, alter, octave: 4, duration: 'q', measure: 1, beat: fracCreate(0, 1) } as NoteParams)
    engine.addNoteAtBeat({ step, alter: 0, octave: 4, duration: 'q', measure: 1, beat: fracCreate(1, 1) } as NoteParams)
    engine.renderScore()

    const altered = headAt(0)
    const plain = headAt(1)
    expect(altered.staffPosition).toBe(position)
    const registry = engine.getElementRegistry()
    expect(registry.staffPositionToPixelY(altered.staffPosition!, 1))
      .toBe(registry.staffPositionToPixelY(plain.staffPosition!, 1))
  })
})
