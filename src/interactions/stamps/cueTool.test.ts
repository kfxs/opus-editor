import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createEditorState, type EditorState, type MarkingTool } from '../state/EditorState'
import { CUE_STAMP_DURATION, cueLit, pressCue } from './cueTool'
import type { SpanToolHost } from './spanToolPress'
import { makeEngine } from '@/testing/makeEngine'
import { itemKey, type SelectionItem } from '../state/selection'
import { fracCreate as frac } from '@/utils/fraction'
import type { MusicEngine } from '@/engine/MusicEngine'

vi.mock('../../engine/rendering/ScoreRenderer', async () => (await import('@/testing/engineStubs')).scoreRendererStub())
vi.mock('../../engine/audio/PlaybackEngine', async () => (await import('@/testing/engineStubs')).playbackEngineStub())

/**
 * Subject: `./cueTool` — what a press of `cue` does (cue-size-plan P1): the selected notes toggle, one undo
 * entry; ⏭️ in note entry it will ARM cue (his rule, 2026-09-24) — not built, so it changes nothing yet.
 */
describe('pressCue', () => {
  let state: EditorState
  let engine: MusicEngine
  let host: SpanToolHost
  beforeEach(() => {
    state = createEditorState()
    engine = makeEngine()
    host = {
      state,
      getEngine: () => engine,
      arm: vi.fn((tool: MarkingTool) => { state.selectedMarkingTool = tool }),
      disarm: vi.fn(),
      disarmToEntry: vi.fn(),
      render: vi.fn(),
    }
  })
  const select = (...ids: string[]) => {
    state.selectedItems = new Map(ids.map((id): [string, SelectionItem] => [itemKey({ kind: 'note', id }), { kind: 'note', id }]))
  }
  const note = (beat: number) => engine.addNoteAtBeat({ step: 'C', alter: 0, octave: 5, duration: 'q', measure: 1, beat: frac(beat, 1) })!

  it('⭐ notes selected → all cue (lit, repainted); again → all full', () => {
    state.selectedTool = 'selection'
    const a = note(0)
    const b = note(1)
    select(a.id, b.id)
    pressCue(host)
    expect([engine.cue.of(a.id), engine.cue.of(b.id)]).toEqual([true, true])
    expect(cueLit(state, engine)).toBe(true)
    expect(host.render).toHaveBeenCalled()
    pressCue(host)
    expect([engine.cue.of(a.id), engine.cue.of(b.id)]).toEqual([false, false])
    expect(cueLit(state, engine)).toBe(false)
  })

  it('a mixed selection → all cue, and the light waits for all of them', () => {
    state.selectedTool = 'selection'
    const a = note(0)
    const b = note(1)
    engine.cue.set([a.id], true)
    select(a.id, b.id)
    expect(cueLit(state, engine)).toBe(false)
    pressCue(host)
    expect(engine.cue.of(b.id)).toBe(true)
  })

  it('⭐ NOTHING selected, in selection → the CUE STAMP: note entry, a quarter, cue armed (his rule, 2026-09-24)', () => {
    state.selectedTool = 'selection'
    state.selectedDuration = 'h'
    state.selectedAccidental = '#'
    const a = note(0)
    pressCue(host)
    expect(state).toMatchObject({ selectedTool: 'entry', selectedDuration: CUE_STAMP_DURATION, selectedDots: 0, selectedCue: true, selectedAccidental: null })
    expect(engine.cue.of(a.id), 'the score untouched').toBe(false)
    expect(cueLit(state, engine)).toBe(true)
    pressCue(host)
    expect(state.selectedCue, 'a re-press disarms it').toBe(false)
  })

  it('⭐ NOTE ENTRY → the press ARMS cue for the next notes (lit); again → off — ⛔ the score untouched', () => {
    state.selectedTool = 'entry'
    const a = note(0)
    pressCue(host)
    expect(state.selectedCue).toBe(true)
    expect(cueLit(state, engine)).toBe(true)
    expect(engine.cue.of(a.id)).toBe(false)
    pressCue(host)
    expect(state.selectedCue).toBe(false)
    expect(cueLit(state, engine)).toBe(false)
  })
})
