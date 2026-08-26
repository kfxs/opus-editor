import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MusicEngine } from '../engine/MusicEngine'
import { createEditorState, type EditorState } from './EditorState'
import {
  BARLINE_SIGNS,
  applyBarlineSign,
  barlineTargetFromSelection,
  stampBarlineAtClick,
  type BarlineSign,
} from './barlineStamp'

/**
 * The barline palette's press — P4 of docs/barline-types-plan.md.
 *
 * Subject: {@link barlineStamp}, sitting beside this file. The `MusicEngine` is real (the write, its
 * refusals and its undo entry are all its answers); nothing here is drawn, and nothing here asks
 * where a pixel landed — the click's MEASURE is what the stamp reads, and mapping a pixel to a bar is
 * `CoordinateMapper`'s question with its own tests.
 */
const fakeRegistry = {
  clear: vi.fn(), register: vi.fn(), getAll: vi.fn(() => []),
  findAt: vi.fn(() => null), getById: vi.fn(() => null),
  registerStaffGeometry: vi.fn(), getStaffGeometry: vi.fn(() => null),
  getByMeasure: vi.fn(() => []),
}
vi.mock('../engine/rendering/VexFlowRenderer', () => ({
  VexFlowRenderer: class {
    initialize = vi.fn(); renderScore = vi.fn(); getElementRegistry = vi.fn(() => fakeRegistry)
  },
}))
vi.mock('../engine/audio/PlaybackEngine', () => ({
  PlaybackEngine: class {
    setScore = vi.fn(); play = vi.fn(); pause = vi.fn(); stop = vi.fn(); setVolume = vi.fn(); onStateChange = vi.fn()
  },
}))

describe('barlineStamp', () => {
  let engine: MusicEngine
  let state: EditorState
  let render: () => void

  /** The bar as the model now holds it — what every assertion below reads back. */
  const bar = (n: number) => engine.getScore().measures.find(m => m.number === n)

  const selectBarlineEnding = (measure: number) => {
    state.selectedTool = 'selection'
    state.selectedElement = { kind: 'barline', measure }
  }
  const selectMeasures = (anchor: number, focus: number) => {
    state.selectedTool = 'selection'
    state.selectedElement = { kind: 'measureRange', anchor, focus, staff: 0, boxStyle: 'double' }
  }

  beforeEach(() => {
    engine = new MusicEngine({ container: {} as unknown as HTMLElement, width: 800, height: 400 })
    for (let i = 0; i < 5; i++) engine.addMeasure() // bars 1–5 (plus the score's own opening bar)
    state = createEditorState()
    render = vi.fn()
  })

  describe('⭐ the SIDE of a measure each sign stands on — the whole gesture', () => {
    it('the two closing signs are on the RIGHT, the open repeat on the LEFT', () => {
      // *"an endbar is always on the right, an open is on the left side of the measure"* — his rule,
      // and the table is the only place it is written down.
      expect(BARLINE_SIGNS.final.side).toBe('right')
      expect(BARLINE_SIGNS.repeatEnd.side).toBe('right')
      expect(BARLINE_SIGNS.repeatStart.side).toBe('left')
    })
  })

  describe('barlineTargetFromSelection', () => {
    it('answers null with nothing selected — the palette ARMS instead', () => {
      for (const sign of Object.keys(BARLINE_SIGNS) as BarlineSign[]) {
        expect(barlineTargetFromSelection(state, sign)).toBeNull()
      }
    })

    it('answers null in ENTRY mode, where a selection is the keyboard caret', () => {
      state.selectedElement = { kind: 'barline', measure: 3 }
      state.selectedTool = 'entry'
      expect(barlineTargetFromSelection(state, 'final')).toBeNull()
    })

    it('⭐ reads a selected BARLINE as a boundary: it ends bar N and OPENS bar N+1', () => {
      selectBarlineEnding(3)
      expect(barlineTargetFromSelection(state, 'final')).toBe(3)
      expect(barlineTargetFromSelection(state, 'repeatEnd')).toBe(3)
      expect(barlineTargetFromSelection(state, 'repeatStart')).toBe(4)
    })

    it('⭐ takes a measure range by the SIGN\'S OWN END — last bar for a closing sign, first for an open', () => {
      // Anchor above focus on purpose: the box is dragged in both directions, and the sign's side is
      // what decides, never which end was clicked first.
      selectMeasures(5, 2)
      expect(barlineTargetFromSelection(state, 'final')).toBe(5)
      expect(barlineTargetFromSelection(state, 'repeatEnd')).toBe(5)
      expect(barlineTargetFromSelection(state, 'repeatStart')).toBe(2)
    })

    it('a SINGLE box counts as well as the double one — both name bars out loud', () => {
      state.selectedTool = 'selection'
      state.selectedElement = { kind: 'measureRange', anchor: 2, focus: 3, staff: 0, boxStyle: 'single' }
      expect(barlineTargetFromSelection(state, 'final')).toBe(3)
    })

    it('a NOTE selection names no bar — a press with notes selected arms the stamp', () => {
      state.selectedTool = 'selection'
      state.selectedNoteId = 'note-1'
      expect(barlineTargetFromSelection(state, 'final')).toBeNull()
    })
  })

  describe('applyBarlineSign', () => {
    it('a final barline is a STYLE on the bar it ends', () => {
      expect(applyBarlineSign(engine, 'final', 2)).toBe(true)
      expect(bar(2)?.barline).toEqual({ style: 'final' })
      expect(bar(2)?.repeatEnd).toBeUndefined()
    })

    it('⭐ the two repeats are NOT styles — each is its own field, on its own side', () => {
      applyBarlineSign(engine, 'repeatEnd', 2)
      applyBarlineSign(engine, 'repeatStart', 3)
      expect(bar(2)?.repeatEnd).toEqual({})
      expect(bar(2)?.barline).toBeUndefined()
      expect(bar(3)?.repeatStart).toEqual({})
    })

    it('an initial |: is reachable — bar 1\'s LEFT side is a bar that exists', () => {
      expect(applyBarlineSign(engine, 'repeatStart', 1)).toBe(true)
      expect(bar(1)?.repeatStart).toEqual({})
    })

    it('answers false for a bar that is not there, and changes nothing', () => {
      // What an open repeat asked for on the line ending the LAST bar comes to: that line opens
      // nothing, so there is no bar to store it on.
      expect(applyBarlineSign(engine, 'repeatStart', 99)).toBe(false)
      expect(bar(99)).toBeUndefined()
    })

    it('answers false for a sign that is already there', () => {
      applyBarlineSign(engine, 'final', 2)
      expect(applyBarlineSign(engine, 'final', 2)).toBe(false)
    })

    it('one undo takes the sign back', () => {
      applyBarlineSign(engine, 'final', 2)
      engine.undo()
      expect(bar(2)?.barline).toBeUndefined()
    })
  })

  describe('stampBarlineAtClick', () => {
    it('leaves the click alone when the tool is not armed', () => {
      expect(stampBarlineAtClick(state, engine, 2, render)).toBe(false)
      expect(bar(2)?.barline).toBeUndefined()
      expect(render).not.toHaveBeenCalled()
    })

    it('⭐ puts the sign on the CLICKED bar, on that sign\'s own side', () => {
      state.selectedMarkingTool = { kind: 'barline', sign: 'final' }
      expect(stampBarlineAtClick(state, engine, 3, render)).toBe(true)
      expect(bar(3)?.barline).toEqual({ style: 'final' })
      expect(render).toHaveBeenCalled()
    })

    it('the open repeat lands on the clicked bar itself — the line it OPENS', () => {
      state.selectedMarkingTool = { kind: 'barline', sign: 'repeatStart' }
      stampBarlineAtClick(state, engine, 3, render)
      expect(bar(3)?.repeatStart).toEqual({})
      expect(bar(2)?.repeatStart).toBeUndefined()
    })

    it('stays armed — these are placed in runs', () => {
      state.selectedMarkingTool = { kind: 'barline', sign: 'repeatEnd' }
      stampBarlineAtClick(state, engine, 2, render)
      stampBarlineAtClick(state, engine, 4, render)
      expect(bar(2)?.repeatEnd).toEqual({})
      expect(bar(4)?.repeatEnd).toEqual({})
      expect(state.selectedMarkingTool).toEqual({ kind: 'barline', sign: 'repeatEnd' })
    })
  })
})
