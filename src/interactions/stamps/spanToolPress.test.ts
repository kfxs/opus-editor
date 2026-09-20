/**
 * {@link pressSpanTool} — what one press of a span tool MEANS, against a fake host. The per-row
 * chapters (`PaletteController.ottava/.pedal/.hairpin.test.ts`, `lineTools.test.ts`) still drive
 * it through the palette; pinned here is the routing every row is owed, and the one place the
 * rows differ on purpose.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { MusicEngine } from '../../engine/MusicEngine'
import { createEditorState, type EditorState, type MarkingTool } from '../state/EditorState'
import { pressSpanTool, SPAN_TOOL_PRESSES, type SpanToolHost } from './spanToolPress'

function makeHost(state: EditorState, engine: MusicEngine | null) {
  const host = {
    state,
    getEngine: () => engine,
    arm: vi.fn((tool: MarkingTool) => { state.selectedMarkingTool = tool }),
    disarm: vi.fn(() => { state.selectedMarkingTool = null }),
    render: vi.fn(),
  }
  return host satisfies SpanToolHost
}

function fakeEngine() {
  const created = { id: 'made' }
  return {
    slur: { createSlur: vi.fn(() => created) },
    trill: { createTrill: vi.fn(() => created) },
    pedal: { createPedal: vi.fn(() => created) },
    ottava: { createOttava: vi.fn(() => created) },
    hairpin: { createHairpin: vi.fn(() => null) },
  }
}

const select = (state: EditorState, ...ids: string[]) => {
  state.selectedItems = new Map(ids.map(id => [id, { kind: 'note' as const, id }]))
}

describe('pressSpanTool', () => {
  let state: EditorState
  let engine: ReturnType<typeof fakeEngine>
  let host: ReturnType<typeof makeHost>

  beforeEach(() => {
    state = createEditorState()
    engine = fakeEngine()
    host = makeHost(state, engine as unknown as MusicEngine)
  })

  it('(2) nothing selected → arms the row\'s tool, and creates nothing', () => {
    pressSpanTool(host, SPAN_TOOL_PRESSES.pedal())
    expect(host.arm).toHaveBeenCalledWith({ kind: 'pedal' })
    expect(engine.pedal.createPedal).not.toHaveBeenCalled()
    expect(host.render).not.toHaveBeenCalled()
  })

  it('(0) a re-press of the armed tool disarms', () => {
    state.selectedMarkingTool = { kind: 'trill' }
    pressSpanTool(host, SPAN_TOOL_PRESSES.trill())
    expect(host.disarm).toHaveBeenCalledTimes(1)
    expect(host.arm).not.toHaveBeenCalled()
  })

  it('⭐ a re-press matches the PAYLOAD: the other ottava row swaps the tool, it does not disarm', () => {
    state.selectedMarkingTool = { kind: 'ottava', shift: 1 }
    pressSpanTool(host, SPAN_TOOL_PRESSES.ottava(-1))
    expect(host.disarm).not.toHaveBeenCalled()
    expect(host.arm).toHaveBeenCalledWith({ kind: 'ottava', shift: -1 })
  })

  it('⭐ …and so does the other hairpin', () => {
    state.selectedMarkingTool = { kind: 'hairpin', type: 'cresc' }
    pressSpanTool(host, SPAN_TOOL_PRESSES.hairpin('dim'))
    expect(host.arm).toHaveBeenCalledWith({ kind: 'hairpin', type: 'dim' })
  })

  it('(1) notes selected → creates over THEM, renders, and arms nothing', () => {
    select(state, 'a', 'b')
    pressSpanTool(host, SPAN_TOOL_PRESSES.ottava(2))
    expect(engine.ottava.createOttava).toHaveBeenCalledWith(['a', 'b'], 2)
    expect(host.render).toHaveBeenCalledTimes(1)
    expect(host.arm).not.toHaveBeenCalled()
  })

  it('renders even when the model refuses the span', () => {
    select(state, 'a')
    pressSpanTool(host, SPAN_TOOL_PRESSES.hairpin('cresc'))
    expect(engine.hairpin.createHairpin).toHaveBeenCalledWith(['a'], 'cresc')
    expect(host.render).toHaveBeenCalledTimes(1)
  })

  it('the scalar anchor counts only in ENTRY mode, where it is the cursor note', () => {
    state.selectedNoteId = 'cursor'
    state.selectedTool = 'selection'
    pressSpanTool(host, SPAN_TOOL_PRESSES.slur())
    expect(engine.slur.createSlur).not.toHaveBeenCalled()
    expect(host.arm).toHaveBeenCalledWith({ kind: 'slur' })

    state.selectedMarkingTool = null
    state.selectedTool = 'entry'
    pressSpanTool(host, SPAN_TOOL_PRESSES.slur())
    expect(engine.slur.createSlur).toHaveBeenCalledWith(['cursor'])
  })

  describe('without an engine — ⚠️ the rows differ, kept as found', () => {
    beforeEach(() => { host = makeHost(state, null) })

    it('the pedal, the ottava and the hairpins still arm: arming touches no score', () => {
      pressSpanTool(host, SPAN_TOOL_PRESSES.pedal())
      pressSpanTool(host, SPAN_TOOL_PRESSES.ottava(1))
      pressSpanTool(host, SPAN_TOOL_PRESSES.hairpin('dim'))
      expect(host.arm).toHaveBeenCalledTimes(3)
    })

    it('the slur and the trill do NOTHING — they ask for the engine first', () => {
      pressSpanTool(host, SPAN_TOOL_PRESSES.slur())
      pressSpanTool(host, SPAN_TOOL_PRESSES.trill())
      state.selectedMarkingTool = { kind: 'slur' }
      pressSpanTool(host, SPAN_TOOL_PRESSES.slur())
      expect(host.arm).not.toHaveBeenCalled()
      expect(host.disarm).not.toHaveBeenCalled()
    })
  })
})
