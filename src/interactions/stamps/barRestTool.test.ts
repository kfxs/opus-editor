import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createEditorState, type EditorState, type MarkingTool, type SelectedElement } from '../state/EditorState'
import { barRestLit, pressBarRest } from './barRestTool'
import type { SpanToolHost } from './spanToolPress'
import { itemKey, type SelectionItem } from '../state/selection'
import { makeEngine } from '@/testing/makeEngine'
import type { MusicEngine } from '@/engine/MusicEngine'
import type { ChordRest } from '@/types/music'
import { fracCreate as frac } from '@/utils/fraction'

vi.mock('../../engine/rendering/ScoreRenderer', async () => (await import('@/testing/engineStubs')).scoreRendererStub())
vi.mock('../../engine/audio/PlaybackEngine', async () => (await import('@/testing/engineStubs')).playbackEngineStub())

/**
 * Subject: `./barRestTool` — the full-bar rest button (docs/plans/voice-measure-rest-plan.md P2): selected
 * BARS get one at once; otherwise a press ARMS the stamp and a re-press disarms it. Lit when armed, or
 * when what is selected already is one.
 */
describe('pressBarRest / barRestLit', () => {
  let state: EditorState
  let engine: MusicEngine
  let host: SpanToolHost
  beforeEach(() => {
    state = createEditorState()
    state.selectedTool = 'selection'
    engine = makeEngine()
    engine.addMeasure()
    host = {
      state, getEngine: () => engine, render: vi.fn(), disarmToEntry: vi.fn(),
      arm: vi.fn((tool: MarkingTool) => { state.selectedMarkingTool = tool }),
      disarm: vi.fn(() => { state.selectedMarkingTool = null }),
    }
  })
  const lane = (m: number, voice: number) =>
    engine.getScore().measures[m - 1].slots.filter((s: ChordRest) => (s.voice ?? 0) === voice)
  const selectBars = (from: number, to: number, boxStyle: 'single' | 'double' = 'double') => {
    state.selectedElement = { kind: 'measureRange', anchor: from, focus: to, staff: 0, focusStaff: 0, boxStyle } as SelectedElement
  }
  const selectNotes = (...ids: string[]) => {
    state.selectedItems = new Map(ids.map((id): [string, SelectionItem] => [itemKey({ kind: 'note', id }), { kind: 'note', id }]))
  }

  describe('nothing selected: the stamp', () => {
    it('arms, and the button is lit; pressed again, disarms', () => {
      expect(barRestLit(state, engine)).toBe(false)
      pressBarRest(host)
      expect(state.selectedMarkingTool).toEqual({ kind: 'barRest' })
      expect(barRestLit(state, engine)).toBe(true)
      pressBarRest(host)
      expect(state.selectedMarkingTool).toBeNull()
      expect(barRestLit(state, engine)).toBe(false)
    })

    it('another tool armed: this one replaces it', () => {
      state.selectedMarkingTool = { kind: 'tie' }
      pressBarRest(host)
      expect(state.selectedMarkingTool).toEqual({ kind: 'barRest' })
    })
  })

  describe('BARS selected: applied at once, in the active voice', () => {
    it('every selected bar, ONE undo entry, nothing armed', () => {
      engine.addNoteAtBeat({ step: 'C', octave: 5, duration: 'q', measure: 1, beat: frac(0, 1) })
      state.activeVoice = 2
      selectBars(1, 2)
      pressBarRest(host)
      expect(state.selectedMarkingTool).toBeNull()
      expect(lane(1, 1).map(s => s.type === 'rest' && s.stamped)).toEqual([true])
      expect(lane(2, 1).map(s => s.type === 'rest' && s.stamped)).toEqual([true])
      engine.undo()
      expect(lane(1, 1)).toHaveLength(0)
      expect(lane(2, 1)).toHaveLength(0)
    })

    it('⭐ lit once the selected bars hold one in the active voice — and not for another voice', () => {
      state.activeVoice = 2
      selectBars(1, 2)
      expect(barRestLit(state, engine)).toBe(false)
      pressBarRest(host)
      expect(barRestLit(state, engine)).toBe(true)
      state.activeVoice = 3
      expect(barRestLit(state, engine)).toBe(false)
    })

    it('a SINGLE box: its note half is gathered again — no id the stamp removed is left selected', () => {
      const n = engine.addNoteAtBeat({ step: 'C', octave: 5, duration: 'q', measure: 1, beat: frac(0, 1) })!
      selectNotes(n.id)
      selectBars(1, 1, 'single')
      state.activeVoice = 1
      pressBarRest(host)
      const ids = [...state.selectedItems.values()].map(i => ('id' in i ? i.id : ''))
      expect(ids).not.toContain(n.id)
      expect(ids).toContain(lane(1, 0)[0].id)
    })
  })

  describe('⭐ lit through the selection: the press turns it OFF (his ask)', () => {
    it('the selected stamped rest: deleted — voice 2 leaves the bar; one undo brings it back', () => {
      engine.addNoteAtBeat({ step: 'C', octave: 5, duration: 'q', measure: 1, beat: frac(0, 1) })
      const restId = engine.silentBar.stamp(1, 0, 1)!
      selectNotes(restId)
      pressBarRest(host)
      expect(lane(1, 1)).toHaveLength(0)
      expect(state.selectedItems.size).toBe(0)
      expect(state.selectedMarkingTool).toBeNull()
      engine.undo()
      expect(lane(1, 1).map(s => s.id)).toEqual([restId])
    })

    it('selected bars all stamped in the active voice: each deleted; voice 1 gets its automatic rest', () => {
      state.activeVoice = 1
      selectBars(1, 2)
      pressBarRest(host) // on
      expect(barRestLit(state, engine)).toBe(true)
      pressBarRest(host) // off
      for (const m of [1, 2]) {
        const v1 = lane(m, 0)
        expect(v1).toHaveLength(1)
        expect(v1[0].type === 'rest' && v1[0].isMeasureRest && !v1[0].stamped).toBe(true)
      }
      expect(barRestLit(state, engine)).toBe(false)
    })

    it('only SOME of the selected bars stamped: not lit, so the press stamps the rest of them', () => {
      state.activeVoice = 2
      engine.silentBar.stamp(1, 0, 1)
      selectBars(1, 2)
      expect(barRestLit(state, engine)).toBe(false)
      pressBarRest(host)
      expect(barRestLit(state, engine)).toBe(true)
    })
  })

  describe('⭐ NOTES selected: their bars, in their OWN voice (his report)', () => {
    it('a selected voice-2 note: its bar gets a voice-2 full-bar rest, which becomes the selection', () => {
      engine.addNoteAtBeat({ step: 'C', octave: 5, duration: 'q', measure: 1, beat: frac(0, 1) })
      const n = engine.addNoteAtBeat({ step: 'A', octave: 3, duration: 'q', measure: 1, beat: frac(0, 1), voice: 1 })!
      state.activeVoice = 1 // the NOTE's voice decides, not the active one
      selectNotes(n.id)
      pressBarRest(host)
      expect(state.selectedMarkingTool).toBeNull()
      const v2 = lane(1, 1)
      expect(v2).toHaveLength(1)
      expect(v2[0].type === 'rest' && v2[0].stamped).toBe(true)
      expect(lane(1, 0).some(s => s.type === 'chord')).toBe(true) // voice 1 untouched
      expect(state.selectedNoteId).toBe(v2[0].id)
      expect(barRestLit(state, engine)).toBe(true)
      pressBarRest(host) // …and the second press turns it off
      expect(lane(1, 1)).toHaveLength(0)
    })

    it('notes in two bars: both bars, ONE undo entry', () => {
      const a = engine.addNoteAtBeat({ step: 'C', octave: 5, duration: 'q', measure: 1, beat: frac(0, 1) })!
      const b = engine.addNoteAtBeat({ step: 'D', octave: 5, duration: 'q', measure: 2, beat: frac(0, 1) })!
      selectNotes(a.id, b.id)
      pressBarRest(host)
      expect(lane(1, 0).map(s => s.type === 'rest' && s.stamped)).toEqual([true])
      expect(lane(2, 0).map(s => s.type === 'rest' && s.stamped)).toEqual([true])
      engine.undo()
      expect(engine.getNote(a.id)).toBeTruthy()
      expect(engine.getNote(b.id)).toBeTruthy()
    })
  })

  it('⭐ lit when the SELECTED note is a stamped full-bar rest (his report)', () => {
    const restId = engine.silentBar.stamp(1, 0, 1)!
    selectNotes(restId)
    expect(barRestLit(state, engine)).toBe(true)
    const auto = lane(2, 0)[0].id // bar 2's AUTOMATIC full-bar rest
    selectNotes(auto)
    expect(barRestLit(state, engine)).toBe(false)
  })
})
