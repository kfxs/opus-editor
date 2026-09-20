import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MusicEngine } from '../engine/MusicEngine'
import { createEditorState, type EditorState } from './EditorState'
import { applyKeySignature, keyTargetFromSelection, stampKeySignatureAtClick } from './keySignatureStamp'
import { keyFromFifths } from '@/utils/keySignature'

/**
 * The key-signature stamp — P5 of docs/key-signature-plan.md.
 *
 * Subject: {@link keySignatureStamp}, sitting beside this file. The `MusicEngine` is real, because
 * every claim here is one of ITS answers: what got stored, on which staves, and whether the whole
 * gesture is one undo. ⛔ Nothing here is drawn, and nothing asks where a pixel landed — which bar a
 * press falls in is `pixelToMeasure`'s, and where the signs are engraved is the browser suite's.
 */
const fakeRegistry = {
  clear: vi.fn(), register: vi.fn(), getAll: vi.fn(() => []),
  findAt: vi.fn(() => null), getById: vi.fn(() => null),
  registerStaffGeometry: vi.fn(), getStaffGeometry: vi.fn(() => null),
  getByMeasure: vi.fn(() => []),
  staffIndexAtY: vi.fn(() => 1),
}
vi.mock('../engine/rendering/ScoreRenderer', () => ({
  ScoreRenderer: class {
    initialize = vi.fn(); renderScore = vi.fn(); getElementRegistry = vi.fn(() => fakeRegistry)
  },
}))
vi.mock('../engine/audio/PlaybackEngine', async () => (await import('@/testing/engineStubs')).playbackEngineStub())

const G_MAJOR = keyFromFifths(1)
const E_FLAT = keyFromFifths(-3)

describe('keySignatureStamp', () => {
  let engine: MusicEngine
  let state: EditorState
  let render: () => void

  /** The key changes stored on a bar — what every assertion below reads back. */
  const keysOf = (n: number) => engine.getScore().measures.find(m => m.number === n)?.keys

  const click = (measure: number, modifiers: Partial<MouseEvent> = {}) =>
    stampKeySignatureAtClick(
      state, engine, 20, measure, { ctrlKey: false, metaKey: false, ...modifiers } as MouseEvent, render,
    )

  beforeEach(() => {
    engine = new MusicEngine({ container: {} as unknown as HTMLElement, width: 800, height: 400 })
    for (let i = 0; i < 5; i++) engine.addMeasure()
    state = createEditorState()
    render = vi.fn()
  })

  describe('the armed click', () => {
    it('declines when the key tool is not armed — every other stamp gets its turn', () => {
      state.selectedMarkingTool = { kind: 'clef', clef: 'bass' }
      expect(click(3)).toBe(false)
      expect(keysOf(3)).toBeUndefined()
    })

    it('⭐ places the key at the HEAD of the bar the press landed in', () => {
      state.selectedMarkingTool = { kind: 'keySignature', key: G_MAJOR }
      expect(click(3)).toBe(true)
      expect(keysOf(3)?.[0].key.alterations).toEqual(G_MAJOR.alterations)
      expect(keysOf(3)?.[0].beat).toEqual({ num: 0, den: 1 })
      expect(render).toHaveBeenCalled()
    })

    it('stays armed — these are placed in runs, one per section', () => {
      state.selectedMarkingTool = { kind: 'keySignature', key: E_FLAT }
      click(2)
      click(4)
      expect(state.selectedMarkingTool).toEqual({ kind: 'keySignature', key: E_FLAT })
      expect(keysOf(2)).toBeDefined()
      // ⭐ And bar 4 stores NOTHING, which is the write path's normalization showing through the
      //   gesture: bar 2 put E♭ in force, so bar 4 is already in E♭ and there is no change to make.
      //   The click is still consumed — you asked for the key that is there, and it is there.
      expect(keysOf(4)).toBeUndefined()
    })

    it('consumes the click even when nothing changed — the key asked for was already in force', () => {
      state.selectedMarkingTool = { kind: 'keySignature', key: G_MAJOR }
      click(3)
      const before = JSON.stringify(engine.getScore().measures[2])
      expect(click(3)).toBe(true)
      expect(JSON.stringify(engine.getScore().measures[2])).toBe(before)
    })

    it('⭐ `Ctrl` NARROWS to the staff under the pointer — the modifier is the per-staff door', () => {
      // MuseScore's polarity (plan §5.1): plain = all staves, the modifier narrows. The stub answers
      // staff 1, so a narrowed drop must write staff 1's id and no other.
      engine.addStaffBelow(0)
      state.selectedMarkingTool = { kind: 'keySignature', key: G_MAJOR }
      expect(click(3, { ctrlKey: true })).toBe(true)
      const staffIds = keysOf(3)?.map(k => k.staffId)
      expect(staffIds?.length).toBe(1)
      expect(staffIds?.[0]).toBe(engine.staffIdForIndex(1))
    })

    it('⭐ `Cmd` does what `Ctrl` does — one gesture, two platforms', () => {
      engine.addStaffBelow(0)
      state.selectedMarkingTool = { kind: 'keySignature', key: G_MAJOR }
      expect(click(3, { metaKey: true })).toBe(true)
      expect(keysOf(3)?.length).toBe(1)
    })
  })

  describe('applyKeySignature', () => {
    it('⭐ a plain drop writes EVERY staff — the default all four applications share', () => {
      engine.addStaffBelow(0)
      expect(applyKeySignature(engine, E_FLAT, { measure: 2, staff: null })).toBe(true)
      expect(keysOf(2)?.length).toBe(2)
    })

    it('⭐⭐ …and all of it is ONE undo: you placed one signature, not one per staff', () => {
      engine.addStaffBelow(0)
      applyKeySignature(engine, E_FLAT, { measure: 2, staff: null })
      expect(engine.undo()).toBe(true)
      expect(keysOf(2)).toBeUndefined()
    })

    it('answers false when the key is the one already in force — `keyOps` stores nothing', () => {
      // Measure 1 is C major by inheritance, so setting C major there is normalized away.
      expect(applyKeySignature(engine, keyFromFifths(0), { measure: 1, staff: null })).toBe(false)
      expect(keysOf(1)).toBeUndefined()
    })
  })

  describe('keyTargetFromSelection', () => {
    it('a selected SIGNATURE names its own bar and its own staff', () => {
      state.selectedTool = 'selection'
      state.selectedElement = { kind: 'keySignature', measure: 4, staff: 1 }
      expect(keyTargetFromSelection(state)).toEqual({ measure: 4, staff: 1 })
    })

    it('a measure BOX names its first bar, system-wide — a box names bars, not a row of signs', () => {
      state.selectedTool = 'selection'
      state.selectedElement = { kind: 'measureRange', anchor: 5, focus: 3, staff: 0, focusStaff: 0, boxStyle: 'double' }
      expect(keyTargetFromSelection(state)).toEqual({ measure: 3, staff: null })
    })

    it('⭐ a selected BARLINE names the bar it OPENS, system-wide — his report, 2026-08-28', () => {
      // *"i selected barline before measure 3 and clicked D … expected is that we make a D major key
      // change in measure 3."* The line ending bar 2 IS the line before bar 3.
      state.selectedTool = 'selection'
      state.selectedElement = { kind: 'barline', measure: 2 }
      expect(keyTargetFromSelection(state)).toEqual({ measure: 3, staff: null })
    })

    it('⭐ …and a `|:` names its own bar, the same sentence from the other side', () => {
      state.selectedTool = 'selection'
      state.selectedElement = { kind: 'repeatStart', measure: 4 }
      expect(keyTargetFromSelection(state)).toEqual({ measure: 4, staff: null })
    })

    it('a line ending the LAST bar names a bar that is not there — the WRITE refuses, not the target', () => {
      state.selectedTool = 'selection'
      state.selectedElement = { kind: 'barline', measure: 6 } // bars 1–6 exist
      expect(keyTargetFromSelection(state)).toEqual({ measure: 7, staff: null })
      expect(applyKeySignature(engine, G_MAJOR, { measure: 7, staff: null })).toBe(false)
    })

    it('⛔ a NOTE selection names nothing — the press arms instead (the stamp bargain)', () => {
      state.selectedTool = 'selection'
      state.selectedElement = null
      expect(keyTargetFromSelection(state)).toBeNull()
    })

    it('⛔ and neither does anything in ENTRY mode — a selected note there is the caret', () => {
      state.selectedTool = 'entry'
      state.selectedElement = { kind: 'keySignature', measure: 4, staff: 0 }
      expect(keyTargetFromSelection(state)).toBeNull()
    })
  })
})
