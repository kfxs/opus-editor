import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createEditorState, type EditorState, type MarkingTool } from '../state/EditorState'
import { dotsLit, pressDots, type DotKeyHost } from './dotCountTool'
import { makeEngine } from '@/testing/makeEngine'
import { itemKey, type SelectionItem } from '../state/selection'
import { fracCreate as frac } from '@/utils/fraction'
import type { MusicEngine } from '@/engine/MusicEngine'

vi.mock('../../engine/rendering/ScoreRenderer', async () => (await import('@/testing/engineStubs')).scoreRendererStub())
vi.mock('../../engine/audio/PlaybackEngine', async () => (await import('@/testing/engineStubs')).playbackEngineStub())

/**
 * Subject: `./dotCountTool` — one press of the dot key with a COUNT (docs/plans/multiple-dots-plan.md P2):
 * the Keypad key's branches (D5), and the counts as a RADIO (D6).
 */
describe('pressDots', () => {
  let state: EditorState
  let engine: MusicEngine
  let host: DotKeyHost
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
      repaintGhost: vi.fn(),
      selectNote: vi.fn(),
    }
  })
  const quarter = (beat = 0) => engine.addNoteAtBeat({ step: 'C', octave: 5, duration: 'q', measure: 1, beat: frac(beat, 1) })!
  const select = (id: string) => {
    state.selectedTool = 'selection'
    state.selectedNoteId = id
    state.selectedItems = new Map([[itemKey({ kind: 'note', id }), { kind: 'note', id } as SelectionItem]])
  }

  it('⭐ a NOTE selected: each count SWITCHES it; only the count it has turns the dots off (D6)', () => {
    const n = quarter()
    select(n.id)
    pressDots(host, 2)
    expect(engine.getNote(n.id)?.dots).toBe(2)
    expect(dotsLit(state, engine, 2)).toBe(true)
    pressDots(host, 1) // `.` on a double-dotted note → ONE dot, ⛔ not none
    expect(engine.getNote(n.id)?.dots).toBe(1)
    pressDots(host, 3)
    expect(engine.getNote(n.id)?.dots).toBe(3)
    pressDots(host, 3)
    expect(engine.getNote(n.id)?.dots ?? 0).toBe(0)
  })

  it('a count the note cannot take is refused, and the keys light what was WRITTEN', () => {
    const n = engine.addNoteAtBeat({ step: 'C', octave: 5, duration: '8', measure: 1, beat: frac(0, 1) })!
    select(n.id)
    pressDots(host, 3)
    expect(engine.getNote(n.id)?.dots ?? 0).toBe(0)
    expect(state.selectedDots).toBe(0)
  })

  it('⭐ NOTHING selected → arms the STAMP with n; the same count disarms, another re-arms', () => {
    state.selectedTool = 'selection'
    pressDots(host, 2)
    expect(state.selectedMarkingTool).toEqual({ kind: 'dot', count: 2 })
    expect(dotsLit(state, engine, 2)).toBe(true)
    expect(dotsLit(state, engine, 1)).toBe(false)
    pressDots(host, 3)
    expect(state.selectedMarkingTool).toEqual({ kind: 'dot', count: 3 })
    pressDots(host, 3)
    expect(state.selectedMarkingTool).toBeNull()
  })

  it('another tool armed → the dot stamp replaces it', () => {
    state.selectedMarkingTool = { kind: 'tie' }
    pressDots(host, 2)
    expect(state.selectedMarkingTool).toEqual({ kind: 'dot', count: 2 })
  })

  it('the DOTS selected: their own count removes them; another count switches them', () => {
    const n = quarter()
    engine.updateNote(n.id, { dots: 1 })
    state.selectedElement = { kind: 'dot', noteId: n.id }
    pressDots(host, 2)
    expect(engine.getNote(n.id)?.dots).toBe(2)
    expect(state.selectedElement).toEqual({ kind: 'dot', noteId: n.id })
    pressDots(host, 2)
    expect(engine.getNote(n.id)?.dots ?? 0).toBe(0)
    expect(state.selectedElement).toBeNull()
  })

  it('NOTE ENTRY: arms n for the next note (the ghost repaints); the same count disarms', () => {
    state.selectedTool = 'entry'
    state.selectedDuration = 'q'
    pressDots(host, 3)
    expect(state.selectedDots).toBe(3)
    expect(host.repaintGhost).toHaveBeenCalled()
    pressDots(host, 1)
    expect(state.selectedDots).toBe(1)
    pressDots(host, 1)
    expect(state.selectedDots).toBe(0)
  })

  it('NOTE ENTRY: a count the armed length cannot take is refused (`...` on a 16th)', () => {
    state.selectedTool = 'entry'
    state.selectedDuration = '16'
    pressDots(host, 3)
    expect(state.selectedDots).toBe(0)
    pressDots(host, 1)
    expect(state.selectedDots).toBe(1)
  })

  it('the REST stamp armed (it uses the armed length) → its dots switch, and it stays armed', () => {
    state.selectedMarkingTool = { kind: 'rest' }
    state.selectedDuration = 'h'
    pressDots(host, 2)
    expect(state.selectedDots).toBe(2)
    expect(state.selectedMarkingTool).toEqual({ kind: 'rest' })
  })
})
