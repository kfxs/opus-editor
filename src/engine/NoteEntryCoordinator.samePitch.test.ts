// @vitest-environment jsdom
/**
 * ⭐ M1 (docs/plans/alteration-signs-plan.md): a click enters a pitch the chord does not already HAVE
 * — the same letter, signs and octave (`utils/pitchOrder.samePitch`). C♯ and D♭ are two pitches, so a
 * D♭ clicked on a C♯'s column joins it as a chord. It used to REPLACE the C♯ — the click lands on the
 * head's own beat, so `entryOverwriteOps` takes "the same pitch" out first, and the two were compared
 * as one piano key. (A click BETWEEN elements asks the coordinator's own collision check — the same
 * `samePitch`.)
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { MusicEngine } from './MusicEngine'
import { fracCreate } from '@/utils/fraction'
import type { NoteParams } from '@/types/music'
import { staffPosition } from '@/utils/pitchOrder'

describe('NoteEntryCoordinator — the same pitch is the same WRITTEN pitch', () => {
  let engine: MusicEngine

  beforeEach(() => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    engine = new MusicEngine({ container, width: 900, height: 500 })
  })

  /** Click on beat 0's head column, on the line of `step` 4, with an accidental armed. */
  const clickOnLine = (step: 'C' | 'D', accidental: '#' | 'b') => {
    engine.renderScore()
    const registry = engine.getElementRegistry()
    const head = registry.getByMeasure(1).find(e => e.type === 'note' && e.beat === 0)!
    const y = registry.staffPositionToPixelY(staffPosition({ step, octave: 4 }), 1)!
    return engine.addNoteAtPosition({ x: head.headX!, y }, 'q', accidental)
  }

  const pitchesAtBeat0 = () => engine.getScore().measures[0].slots
    .flatMap(s => (s.type === 'chord' && s.beat.num === 0 ? s.notes : []))
    .map(p => `${p.step}${p.alteration ?? ''}${p.octave}`)

  it('⭐ a D♭ clicked beside a C♯ joins it — two pitches, one chord', () => {
    engine.addNoteAtBeat({ step: 'C', alteration: ['sharp'], octave: 4, duration: 'q', measure: 1, beat: fracCreate(0, 1) } as NoteParams)

    expect(clickOnLine('D', 'b')).not.toBeNull()
    expect(pitchesAtBeat0().sort()).toEqual(['Csharp4', 'Dflat4'])
  })

  it('⛔ the C♯ itself, clicked again, adds nothing', () => {
    engine.addNoteAtBeat({ step: 'C', alteration: ['sharp'], octave: 4, duration: 'q', measure: 1, beat: fracCreate(0, 1) } as NoteParams)

    clickOnLine('C', '#')
    expect(pitchesAtBeat0()).toEqual(['Csharp4'])
  })
})
