// @vitest-environment jsdom
/**
 * Delete removes a selected TREMOLO (docs/tremolo-plan.md §2 decision 4).
 *
 * The mark shipped stampable but not removable — Ctrl+Z was the only way to take one off — because
 * "Delete removes the selected thing" needs a selected thing, and the mark only became selectable in
 * P5. This is the other half.
 *
 * Driven through the REAL key wiring rather than by calling the handler, because the risk here is
 * not the removal (one engine call) but the BRANCH ORDER: `deleteSelected` is a long if/else chain
 * over every scalar selection, and a new branch is only reached if nothing above it claims the press.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { MusicEngine } from '../engine/MusicEngine'
import { createEditorState, type EditorState } from './EditorState'
import { wireShortcuts } from './shortcutWiring'
import { fracCreate as frac } from '../utils/fraction'

const fakeRegistry = {
  clear: vi.fn(), register: vi.fn(), getAll: vi.fn(() => []),
  findAt: vi.fn(() => null), getByNoteId: vi.fn(() => null),
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

/** The tremolo on the chord at measure 1, beat 0 — read off the model, not off a projection. */
function tremoloAt(engine: MusicEngine): unknown {
  const slot = engine.getScore().measures[0].slots.find(s => s.beat.num === 0)
  return slot?.type === 'chord' ? slot.tremolo : undefined
}

describe('Delete removes a selected tremolo', () => {
  let engine: MusicEngine
  let state: EditorState
  let noteId: string
  let selectNote: ReturnType<typeof vi.fn>
  let teardown: () => void

  beforeEach(() => {
    engine = new MusicEngine({ container: {} as unknown as HTMLElement, width: 800, height: 400 })
    engine.addMeasure()
    noteId = engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })!.id
    engine.setTremolo(noteId, 3)

    state = createEditorState()
    state.selectedTool = 'selection'
    selectNote = vi.fn()

    const wiring = wireShortcuts(
      state,
      () => engine,
      { selectNote, deselectAll: vi.fn() } as never,
      { clearArmedArticulations: vi.fn() } as never,
      {} as never,
      { renderScore: vi.fn() } as never,
      {} as never,
      { model: { getViewportSize: () => ({ w: 800, h: 400 }) } } as never,
      () => null, () => {}, () => {}, () => false,
    )
    wiring.enable()
    teardown = wiring.disable
  })

  afterEach(() => { teardown() })

  const pressDelete = () =>
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }))

  it('takes the mark off the slot', () => {
    state.selectedTremoloNoteId = noteId
    pressDelete()
    expect(tremoloAt(engine)).toBeUndefined()
  })

  it('keeps the NOTE — Delete removes the mark, never what carries it', () => {
    state.selectedTremoloNoteId = noteId
    pressDelete()
    expect(engine.getNote(noteId)).toBeTruthy()
    // …and leaves it selected, like the accidental and the dot: stamping a different mark is the
    // obvious next move.
    expect(selectNote).toHaveBeenCalledWith(noteId)
  })

  it('is ONE undo step — Ctrl+Z puts the same mark back', () => {
    state.selectedTremoloNoteId = noteId
    pressDelete()
    expect(engine.undo()).toBe(true)
    expect(tremoloAt(engine)).toBe(3)
  })

  it('⭐ takes the WHOLE mark, not one stroke — a tremolo is one value on the slot', () => {
    engine.setTremolo(noteId, 5)
    state.selectedTremoloNoteId = noteId
    pressDelete()
    expect(tremoloAt(engine)).toBeUndefined()
  })

  it('the Penderecki sign goes the same way — no per-mark path', () => {
    engine.setTremolo(noteId, 'penderecki')
    state.selectedTremoloNoteId = noteId
    pressDelete()
    expect(tremoloAt(engine)).toBeUndefined()
  })


  it('⭐ a TWO-NOTE pair goes whole — half a mark is not a notation', () => {
    // A partner to pair with, then the pair itself.
    engine.addNoteAtBeat({ step: 'E', octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
    engine.setTremoloPair(noteId, true)
    const slotAt = (beat: number) => {
      const slot = engine.getScore().measures[0].slots.find(s => s.beat.num === beat && s.beat.den === 1)
      return slot?.type === 'chord' ? slot : undefined
    }
    expect(slotAt(0)?.tremoloPair).toBe(true)

    state.selectedTremoloNoteId = noteId
    pressDelete()

    // BOTH fields, and only on the first slot — the second never carried anything.
    expect(slotAt(0)?.tremoloPair).toBeUndefined()
    expect(slotAt(0)?.tremolo).toBeUndefined()
    // …and the two notes are still there. Deleting the mark is not deleting the music.
    expect(engine.getNote(noteId)).toBeTruthy()
    expect(slotAt(1)).toBeTruthy()
  })

  it('with nothing selected the press changes nothing', () => {
    pressDelete()
    expect(tremoloAt(engine)).toBe(3)
  })

  it('⚠️ a selected NOTE still deletes the note — the new branch must not shadow the old ones', () => {
    state.selectedItems.set(`note:${noteId}`, { kind: 'note', id: noteId })
    state.selectedNoteId = noteId
    pressDelete()
    expect(engine.getNote(noteId)).toBeFalsy() // gone: getNote hands back undefined for an id that is not there
  })
})
