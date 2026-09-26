import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MusicEngine } from '../../engine/MusicEngine'
import type { ElementInfo, ElementRegistry } from '../../engine/ElementRegistry'
import { createEditorState, type EditorState } from '../state/EditorState'
import { stampDotAtClick } from './dotStamp'
import { fracCreate as frac } from '../../utils/fraction'

/** The dot stamp's click, with its COUNT (docs/plans/multiple-dots-plan.md P2, D5). */
vi.mock('../../engine/rendering/ScoreRenderer', async () => (await import('@/testing/engineStubs')).scoreRendererStub())
vi.mock('../../engine/audio/PlaybackEngine', async () => (await import('@/testing/engineStubs')).playbackEngineStub())

describe('stampDotAtClick', () => {
  let engine: MusicEngine
  let state: EditorState
  let render: () => void
  let noteId: string
  const hitting = (el: Partial<ElementInfo> | null, hits = true) =>
    ({ findClosestNoteOrRest: () => el, hitsNoteOrRestBody: () => hits }) as unknown as ElementRegistry
  const stamp = (count: number, hits = true) => {
    state.selectedMarkingTool = { kind: 'dot', count }
    return stampDotAtClick(state, engine, hitting({ id: noteId }, hits), 0, 0, render)
  }

  beforeEach(() => {
    engine = new MusicEngine({ container: {} as unknown as HTMLElement, width: 800, height: 400 })
    noteId = engine.addNoteAtBeat({ step: 'E', octave: 5, duration: 'q', measure: 1, beat: frac(0, 1) })!.id
    state = createEditorState()
    render = vi.fn()
  })

  it('does not touch a click when the tool is not armed', () => {
    expect(stampDotAtClick(state, engine, hitting({ id: noteId }), 0, 0, render)).toBe(false)
  })

  it('gives the note the armed COUNT — 1, 2 or 3 — as one undo step', () => {
    expect(stamp(2)).toBe(true)
    expect(engine.getNote(noteId)?.dots).toBe(2)
    expect(render).toHaveBeenCalled()
    engine.undo()
    expect(engine.getNote(noteId)?.dots ?? 0).toBe(0)
  })

  it('⭐ a RADIO: another count SWITCHES the note to the armed one; the same count is a no-op', () => {
    stamp(2)
    stamp(1)
    expect(engine.getNote(noteId)?.dots).toBe(1)
    stamp(3)
    expect(engine.getNote(noteId)?.dots).toBe(3)
    render = vi.fn()
    stamp(3)
    expect(render).not.toHaveBeenCalled()
  })

  it('more dots than the value takes is REFUSED — nothing written (D1)', () => {
    noteId = engine.addNoteAtBeat({ step: 'E', octave: 5, duration: '128', measure: 1, beat: frac(2, 1) })!.id // two at most
    expect(stamp(3)).toBe(true)
    expect(engine.getNote(noteId)?.dots ?? 0).toBe(0)
  })

  it('a click off every note body is ours and changes nothing', () => {
    expect(stamp(2, false)).toBe(true)
    expect(engine.getNote(noteId)?.dots ?? 0).toBe(0)
    expect(render).not.toHaveBeenCalled()
  })
})
