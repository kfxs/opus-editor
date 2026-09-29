import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { MusicEngine } from '../../engine/MusicEngine'
import { createEditorState, type EditorState } from '../state/EditorState'
import { SelectionController } from './SelectionController'
import { selectedNoteIds } from '../state/selection'
import { fracCreate as frac } from '@/utils/fraction'
import { makeEngine } from '@/testing/makeEngine'

vi.mock('../../engine/rendering/ScoreRenderer', async () => (await import('@/testing/engineStubs')).scoreRendererStub())
vi.mock('../../engine/audio/PlaybackEngine', async () => (await import('@/testing/engineStubs')).playbackEngineStub())

/**
 * ⭐ Shift+←/→ grows and shrinks the selection one note at a time (his ask, 2026-09-29). Bar 1: C D E F
 * quarters.
 */
describe('SelectionController.extendSelectionStep — a range, text-editor style', () => {
  let engine: MusicEngine
  let state: EditorState
  let selection: SelectionController
  let c: string, d: string, e: string, f: string

  beforeEach(() => {
    engine = makeEngine()
    state = createEditorState()
    state.selectedTool = 'selection'
    selection = new SelectionController(() => engine, state, () => {}, () => {})
    vi.spyOn(selection as unknown as { scrollSelectedNoteIntoView(): void }, 'scrollSelectedNoteIntoView')
      .mockImplementation(() => {})
    const at = (step: 'C' | 'D' | 'E' | 'F', b: number) =>
      engine.addNoteAtBeat({ step, alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(b, 1) })!.id
    c = at('C', 0); d = at('D', 1); e = at('E', 2); f = at('F', 3)
  })

  const selected = () => selectedNoteIds(state.selectedItems.values()).sort()
  const ids = (...xs: string[]) => [...xs].sort()

  it('→ appends at the end, ← takes them back off', () => {
    selection.selectNote(d)
    selection.extendSelectionStep(1)
    expect(selected()).toEqual(ids(d, e))
    selection.extendSelectionStep(1)
    expect(selected()).toEqual(ids(d, e, f))
    expect(state.selectedNoteId).toBe(f)
    selection.extendSelectionStep(-1)
    expect(selected()).toEqual(ids(d, e))
  })

  it('← past the first note grows from the BEGINNING, and → shrinks it back', () => {
    selection.selectNote(d)
    selection.extendSelectionStep(1)          // D E
    selection.extendSelectionStep(-1)         // D
    selection.extendSelectionStep(-1)         // C D
    expect(selected()).toEqual(ids(c, d))
    expect(state.selectedNoteId).toBe(c)
    selection.extendSelectionStep(1)          // D
    expect(selected()).toEqual(ids(d))
  })

  it('off the end of the lane the range stays as it is', () => {
    selection.selectNote(c)
    expect(selection.extendSelectionStep(-1)).toBe(true)
    expect(selected()).toEqual(ids(c))
  })

  it('declines with no note selected, leaving the key free', () => {
    expect(selection.extendSelectionStep(1)).toBe(false)
  })
})
