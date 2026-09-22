import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MusicEngine } from '../../engine/MusicEngine'
import type { ElementInfo, ElementRegistry } from '../../engine/ElementRegistry'
import { createEditorState, type EditorState } from '../state/EditorState'
import { stampArticulationAtClick } from './articulationStamp'
import { fracCreate as frac } from '../../utils/fraction'

/** The articulation stamp's click (moved out of `MouseController` unchanged, 2026-09-22). */
vi.mock('../../engine/rendering/ScoreRenderer', async () => (await import('@/testing/engineStubs')).scoreRendererStub())
vi.mock('../../engine/audio/PlaybackEngine', async () => (await import('@/testing/engineStubs')).playbackEngineStub())

describe('stampArticulationAtClick', () => {
  let engine: MusicEngine
  let state: EditorState
  let render: () => void
  let noteId: string
  const hitting = (el: Partial<ElementInfo> | null, hits = true) =>
    ({ findClosestNoteOrRest: () => el, hitsNoteOrRestBody: () => hits }) as unknown as ElementRegistry

  beforeEach(() => {
    engine = new MusicEngine({ container: {} as unknown as HTMLElement, width: 800, height: 400 })
    noteId = engine.addNoteAtBeat({ step: 'E', octave: 5, duration: 'q', measure: 1, beat: frac(0, 1) })!.id
    state = createEditorState()
    render = vi.fn()
  })

  it('does not touch a click when the tool is not armed', () => {
    expect(stampArticulationAtClick(state, engine, hitting({ id: noteId }), 0, 0, render)).toBe(false)
  })

  it('adds the armed articulations the note lacks, and renders', () => {
    state.selectedMarkingTool = { kind: 'articulation', types: ['staccato', 'accent'] }
    expect(stampArticulationAtClick(state, engine, hitting({ id: noteId }), 0, 0, render)).toBe(true)
    expect(engine.getNote(noteId)?.articulations?.sort()).toEqual(['accent', 'staccato'])
    expect(render).toHaveBeenCalled()
  })

  it('a click off every note body is ours and changes nothing', () => {
    state.selectedMarkingTool = { kind: 'articulation', types: ['staccato'] }
    expect(stampArticulationAtClick(state, engine, hitting({ id: noteId }, false), 0, 0, render)).toBe(true)
    expect(engine.getNote(noteId)?.articulations ?? []).toEqual([])
    expect(render).not.toHaveBeenCalled()
  })
})
