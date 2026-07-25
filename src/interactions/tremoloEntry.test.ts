// @vitest-environment jsdom
/**
 * WHAT A TREMOLO-PALETTE PRESS DOES — the four gestures on one button (docs/tremolo-plan.md §10/§11).
 *
 * Pick a duration and press one: every note you write is born wearing the mark, and it PERSISTS —
 * writing five tremolo notes must be five clicks, not five clicks and five re-arms. Select notes and
 * press one: the selection is marked, changed, or (on a re-press) cleared. Select the MARK itself and
 * press one: that mark changes or goes. With nothing to apply to, the press arms the stamp, which is
 * where the mark started.
 *
 * The ROUTING is what these tests pin — which of the four a press means, and the order the checks run
 * in. The engine half (a `tremolo` in `NoteParams` reaching the slot, and reaching every piece of a
 * cross-barline split) is pinned in `tremoloTravel.test.ts`.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createEditorState, type EditorState } from './EditorState'
import { PaletteController } from './PaletteController'
import { MusicEngine } from '../engine/MusicEngine'
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

describe('note entry armed with a tremolo', () => {
  let state: EditorState
  let palette: PaletteController
  let renderArmedGhost: ReturnType<typeof vi.fn<(coords: { x: number; y: number }) => void>>

  beforeEach(() => {
    state = createEditorState()
    renderArmedGhost = vi.fn<(coords: { x: number; y: number }) => void>()
    palette = new PaletteController(
      () => null,                 // no engine: nothing here touches the score
      state,
      vi.fn(),                    // renderScore
      renderArmedGhost,
      () => ({ x: 100, y: 100 }), // last mouse position — the ghost redraws on the keypress
      vi.fn(),                    // selectNote
      vi.fn(),                    // deselectAll
    )
  })

  describe('entry mode — the press arms the mark for what is COMING', () => {
    beforeEach(() => { state.selectedTool = 'entry' })

    it('arms the entry tremolo, and NOT the stamp tool', () => {
      palette.pressTremolo(3)
      expect(state.selectedTremolo).toBe(3)
      expect(state.selectedMarkingTool).toBeNull()
    })

    it('redraws the ghost on the KEYPRESS — the armed mark and what you see must agree', () => {
      palette.pressTremolo(3)
      expect(renderArmedGhost).toHaveBeenCalledWith({ x: 100, y: 100 })
    })

    it('a different mark SWAPS; a re-press of the same one CLEARS (single-valued, like the accidental)', () => {
      palette.pressTremolo(3)
      palette.pressTremolo(5)
      expect(state.selectedTremolo).toBe(5)
      palette.pressTremolo(5)
      expect(state.selectedTremolo).toBeNull()
    })

    it('the Penderecki sign arms like any other mark', () => {
      palette.pressTremolo('penderecki')
      expect(state.selectedTremolo).toBe('penderecki')
    })

    it('⭐ PERSISTS through a duration press — a length change is not a change of mark', () => {
      palette.pressTremolo(2)
      palette.setDuration('8')
      expect(state.selectedTremolo).toBe(2)
      expect(state.selectedDuration).toBe('8')
    })

    it('⚠️ but Esc drops it, with the rest of the arm-for-next-note values', () => {
      palette.pressTremolo(2)
      state.accent = true
      palette.clearArmedArticulations()
      expect(state.selectedTremolo).toBeNull()
      expect(state.accent).toBe(false)
    })

    it('another armed TOOL wins the press — under a clef tool no note is coming', () => {
      state.selectedMarkingTool = { kind: 'clef', clef: 'bass' }
      palette.pressTremolo(4)
      expect(state.selectedTremolo).toBeNull()
      expect(state.selectedMarkingTool).toEqual({ kind: 'tremolo', tremolo: 4 })
    })
  })

  describe('selection mode with NOTHING to apply to — the press arms the STAMP', () => {
    beforeEach(() => { state.selectedTool = 'selection' })

    it('arms the stamp tool, and leaves note entry unarmed', () => {
      palette.pressTremolo(3)
      expect(state.selectedMarkingTool).toEqual({ kind: 'tremolo', tremolo: 3 })
      expect(state.selectedTremolo).toBeNull()
    })

    it('a re-press disarms, a different mark swaps', () => {
      palette.pressTremolo(3)
      palette.pressTremolo(3)
      expect(state.selectedMarkingTool).toBeNull()
      palette.pressTremolo(3)
      palette.pressTremolo(1)
      expect(state.selectedMarkingTool).toEqual({ kind: 'tremolo', tremolo: 1 })
    })

    it('⭐ picking a DURATION promotes the armed stamp into note entry — "mark, then length"', () => {
      // The reverse order of the entry flow above, arriving at the same place: the stamp ends and
      // its mark becomes what the notes you are about to write will wear.
      palette.pressTremolo(4)
      palette.setDuration('q')
      expect(state.selectedMarkingTool).toBeNull()
      expect(state.selectedTremolo).toBe(4)
    })
  })
})

/**
 * Editing what is SELECTED — the gesture the stamp could not give you: a note (or a passage) that
 * already exists, marked / changed / cleared from the same buttons.
 *
 * A real engine here rather than the stubs above, because the whole question is what lands on the
 * slots, and the toggle direction is decided across the selection as a whole.
 */
describe('a tremolo press over a SELECTION', () => {
  let engine: MusicEngine
  let state: EditorState
  let palette: PaletteController

  /** The marks on measure 1's chords, beat order — what the press actually did to the passage. */
  const marks = () => engine.getScore().measures[0].slots
    .filter(s => s.type === 'chord')
    .map(s => (s.type === 'chord' ? s.tremolo : undefined))

  const select = (...ids: string[]) => {
    state.selectedItems.clear()
    for (const id of ids) state.selectedItems.set(`note:${id}`, { kind: 'note', id })
    state.selectedNoteId = ids[ids.length - 1] ?? null
  }

  let ids: string[]

  beforeEach(() => {
    engine = new MusicEngine({ container: {} as unknown as HTMLElement, width: 800, height: 400 })
    engine.addMeasure()
    ids = (['C', 'D', 'E', 'F'] as const).map((step, i) =>
      engine.addNoteAtBeat({ step, octave: 4, duration: 'q', measure: 1, beat: frac(i, 1) })!.id)

    state = createEditorState()
    state.selectedTool = 'selection'
    palette = new PaletteController(
      () => engine, state, vi.fn(),
      vi.fn<(coords: { x: number; y: number }) => void>(),
      () => null, vi.fn(), vi.fn(),
    )
  })

  it('ADDS the mark to every selected note', () => {
    select(ids[0], ids[1])
    palette.pressTremolo(3)
    expect(marks()).toEqual([3, 3, undefined, undefined])
  })

  it('CHANGES them when they already carry a different mark', () => {
    select(ids[0], ids[1])
    palette.pressTremolo(3)
    palette.pressTremolo(5)
    expect(marks()).toEqual([5, 5, undefined, undefined])
  })

  it('⭐ REMOVES on a re-press — the direction is decided for the selection AS A WHOLE', () => {
    select(ids[0], ids[1])
    palette.pressTremolo(3)
    palette.pressTremolo(3)
    expect(marks()).toEqual([undefined, undefined, undefined, undefined])
  })

  it('⚠️ a MIXED selection is levelled UP, not toggled off — not every note has it yet', () => {
    select(ids[0])
    palette.pressTremolo(3)
    select(ids[0], ids[1])
    palette.pressTremolo(3)  // one has it, one does not → set on both
    expect(marks()).toEqual([3, 3, undefined, undefined])
  })

  it('is ONE undo step for the whole passage', () => {
    select(ids[0], ids[1], ids[2])
    palette.pressTremolo(2)
    engine.undo()
    expect(marks()).toEqual([undefined, undefined, undefined, undefined])
  })

  it('does NOT arm the stamp — a selection is edited in place', () => {
    select(ids[0])
    palette.pressTremolo(3)
    expect(state.selectedMarkingTool).toBeNull()
    expect(state.selectedTremolo).toBeNull()
  })

  it('skips RESTS rather than refusing the passage — you meant the notes in it', () => {
    const rest = engine.addNoteAtBeat({ duration: 'q', measure: 2, beat: frac(0, 1), isRest: true })!
    select(ids[0], rest.id)
    palette.pressTremolo(3)
    expect(marks()[0]).toBe(3)
  })

  it('⭐ the selected MARK itself: a different press changes it, the same press removes it', () => {
    engine.setTremolo(ids[0], 3)
    state.selectedItems.clear()
    state.selectedNoteId = null
    state.selectedTremoloNoteId = ids[0]
    palette.pressTremolo(5)
    expect(marks()[0]).toBe(5)
    palette.pressTremolo(5)
    expect(marks()[0]).toBeUndefined()
    expect(state.selectedTremoloNoteId).toBeNull() // nothing left to select
  })
})
