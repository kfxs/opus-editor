import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createEditorState, type EditorState, type MarkingTool } from '../state/EditorState'
import { enclosureLit, pressEnclosure } from './enclosureTool'
import type { SpanToolHost } from './spanToolPress'
import { makeEngine } from '@/testing/makeEngine'
import { itemKey, type SelectionItem } from '../state/selection'
import { fracCreate as frac } from '@/utils/fraction'
import type { MusicEngine } from '@/engine/MusicEngine'

vi.mock('../../engine/rendering/ScoreRenderer', async () => (await import('@/testing/engineStubs')).scoreRendererStub())
vi.mock('../../engine/audio/PlaybackEngine', async () => (await import('@/testing/engineStubs')).playbackEngineStub())

/**
 * Subject: `./enclosureTool` — what a press of `paren.` MEANS, by context (parenthesised-note-plan P1,
 * P4b, his rules 2026-09-23): notes selected → toggle; nothing selected → ARM the stamp; note entry →
 * the next notes are born in brackets; the stamp armed → a re-press disarms.
 */
describe('pressEnclosure', () => {
  let state: EditorState
  let engine: MusicEngine
  let host: SpanToolHost
  beforeEach(() => {
    state = createEditorState()
    engine = makeEngine()
    host = {
      state,
      getEngine: () => engine,
      arm: vi.fn((tool: MarkingTool) => { state.selectedMarkingTool = tool; state.selectedTool = 'entry' }),
      disarm: vi.fn(() => { state.selectedMarkingTool = null; state.selectedTool = 'selection' }),
      disarmToEntry: vi.fn(() => { state.selectedMarkingTool = null }),
      render: vi.fn(),
    }
  })
  const select = (...ids: string[]) => {
    state.selectedItems = new Map(ids.map((id): [string, SelectionItem] => [itemKey({ kind: 'note', id }), { kind: 'note', id }]))
  }

  it('⭐ NOTES selected → toggles theirs, and lights', () => {
    state.selectedTool = 'selection'
    const n = engine.addNoteAtBeat({ step: 'C', octave: 5, duration: 'q', measure: 1, beat: frac(0, 1) })!
    select(n.id)
    pressEnclosure(host)
    expect(engine.enclosure.of(n.id)).toBe('round')
    expect(enclosureLit(state, engine)).toBe(true)
    pressEnclosure(host)
    expect(engine.enclosure.of(n.id)).toBeUndefined()
  })

  it('⭐ NOTHING selected, nothing armed → ARMS the stamp; a re-press disarms it', () => {
    state.selectedTool = 'selection'
    pressEnclosure(host)
    expect(state.selectedMarkingTool).toEqual({ kind: 'headEnclosure', shape: 'round' })
    expect(enclosureLit(state, engine)).toBe(true)
    pressEnclosure(host)
    expect(state.selectedMarkingTool).toBeNull()
  })

  it('⭐ NOTE ENTRY → the next notes are born in brackets (and a re-press ends it); nothing else changes', () => {
    state.selectedTool = 'entry'
    state.selectedAccidental = '#'
    pressEnclosure(host)
    expect(state.selectedEnclosure).toBe('round')
    expect(state.selectedAccidental).toBe('#') // "with parenthesis and other things armed"
    expect(state.selectedMarkingTool).toBeNull()
    expect(enclosureLit(state, engine)).toBe(true)
    pressEnclosure(host)
    expect(state.selectedEnclosure).toBeNull()
  })

  it('another tool armed → this stamp replaces it', () => {
    state.selectedMarkingTool = { kind: 'dot', count: 1 }
    state.selectedTool = 'entry'
    pressEnclosure(host)
    expect(state.selectedMarkingTool).toEqual({ kind: 'headEnclosure', shape: 'round' })
  })

  it('the BRACKETS selected → a press takes them off', () => {
    const n = engine.addNoteAtBeat({ step: 'C', octave: 5, duration: 'q', measure: 1, beat: frac(0, 1) })!
    engine.enclosure.set([n.id], 'round')
    state.selectedElement = { kind: 'headEnclosure', noteId: n.id }
    pressEnclosure(host)
    expect(engine.enclosure.of(n.id)).toBeUndefined()
    expect(state.selectedElement).toBeNull()
  })
})
