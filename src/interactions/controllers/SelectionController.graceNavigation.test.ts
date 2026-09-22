import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { MusicEngine } from '../../engine/MusicEngine'
import { createEditorState, type EditorState } from '../state/EditorState'
import { SelectionController } from './SelectionController'
import { fracCreate as frac } from '@/utils/fraction'
import { makeEngine } from '@/testing/makeEngine'

vi.mock('../../engine/rendering/ScoreRenderer', async () => (await import('@/testing/engineStubs')).scoreRendererStub())
vi.mock('../../engine/audio/PlaybackEngine', async () => (await import('@/testing/engineStubs')).playbackEngineStub())

/**
 * ⭐ ←/→ walk THROUGH the graces (his report, 2026-09-22: *"when the selection is in a note and navigate
 * it ignores the grace; when the selection is in the grace the navigation does not land in the next
 * note"*). Bar 1: C D E F quarters, two graces before E.
 */
describe('SelectionController.navigateSelection — graces are stops', () => {
  let engine: MusicEngine
  let state: EditorState
  let selection: SelectionController
  let d: string, e: string, f: string, g1: string, g2: string

  beforeEach(() => {
    engine = makeEngine()
    state = createEditorState()
    state.selectedTool = 'selection'
    selection = new SelectionController(() => engine, state, () => {}, () => {})
    // Scrolling into view reads the drawn page — not what is under test here.
    vi.spyOn(selection as unknown as { scrollSelectedNoteIntoView(): void }, 'scrollSelectedNoteIntoView')
      .mockImplementation(() => {})
    const at = (step: 'C' | 'D' | 'E' | 'F', b: number) =>
      engine.addNoteAtBeat({ step, alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(b, 1) })!.id
    at('C', 0); d = at('D', 1); e = at('E', 2); f = at('F', 3)
    g1 = engine.grace.addGrace(e, 'before', { step: 'G', alter: 0, octave: 4 }, 'appoggiatura', { duration: '8' })!.pitches[0].id
    g2 = engine.grace.addGrace(e, 'before', { step: 'A', alter: 0, octave: 4 }, 'appoggiatura', { duration: '8' })!.pitches[0].id
  })

  const walk = (from: string, direction: number, steps: number): (string | null)[] => {
    selection.selectNote(from)
    const out: (string | null)[] = []
    for (let i = 0; i < steps; i++) {
      selection.navigateSelection(direction)
      out.push(state.selectedNoteId)
    }
    return out
  }

  it('→ from the note before lands on each grace, then on its MAIN note, then on', () => {
    expect(walk(d, 1, 4)).toEqual([g1, g2, e, f])
  })

  it('← from the next note lands on the main note, then its graces in reverse, then before', () => {
    expect(walk(f, -1, 4)).toEqual([e, g2, g1, d])
  })

  it('🚨 from a GRACE, → lands on the next grace / its own main note — not past it', () => {
    expect(walk(g2, 1, 1)).toEqual([e])
    expect(walk(g1, 1, 1)).toEqual([g2])
    expect(walk(g1, -1, 1)).toEqual([d])
  })
})
