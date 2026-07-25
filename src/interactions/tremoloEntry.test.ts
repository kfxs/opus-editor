// @vitest-environment jsdom
/**
 * NOTE ENTRY armed with a tremolo (docs/tremolo-plan.md §10) — the mark's second half.
 *
 * The stamp marks a note that already exists. This is the other flow: pick a duration, pick a mark,
 * and every note you write is born wearing it. Which of the two a palette press means is decided by
 * the MODE, and the armed mark then PERSISTS until you change it — writing five tremolo notes must
 * be five clicks, not five clicks and five re-arms.
 *
 * The palette routing is what these tests pin. The engine half (a `tremolo` in `NoteParams` reaching
 * the slot, and reaching every piece of a cross-barline split) is pinned in `tremoloTravel.test.ts`.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createEditorState, type EditorState } from './EditorState'
import { PaletteController } from './PaletteController'

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
      palette.armTremolo(3)
      expect(state.selectedTremolo).toBe(3)
      expect(state.selectedMarkingTool).toBeNull()
    })

    it('redraws the ghost on the KEYPRESS — the armed mark and what you see must agree', () => {
      palette.armTremolo(3)
      expect(renderArmedGhost).toHaveBeenCalledWith({ x: 100, y: 100 })
    })

    it('a different mark SWAPS; a re-press of the same one CLEARS (single-valued, like the accidental)', () => {
      palette.armTremolo(3)
      palette.armTremolo(5)
      expect(state.selectedTremolo).toBe(5)
      palette.armTremolo(5)
      expect(state.selectedTremolo).toBeNull()
    })

    it('the Penderecki sign arms like any other mark', () => {
      palette.armTremolo('penderecki')
      expect(state.selectedTremolo).toBe('penderecki')
    })

    it('⭐ PERSISTS through a duration press — a length change is not a change of mark', () => {
      palette.armTremolo(2)
      palette.setDuration('8')
      expect(state.selectedTremolo).toBe(2)
      expect(state.selectedDuration).toBe('8')
    })

    it('⚠️ but Esc drops it, with the rest of the arm-for-next-note values', () => {
      palette.armTremolo(2)
      state.accent = true
      palette.clearArmedArticulations()
      expect(state.selectedTremolo).toBeNull()
      expect(state.accent).toBe(false)
    })

    it('another armed TOOL wins the press — under a clef tool no note is coming', () => {
      state.selectedMarkingTool = { kind: 'clef', clef: 'bass' }
      palette.armTremolo(4)
      expect(state.selectedTremolo).toBeNull()
      expect(state.selectedMarkingTool).toEqual({ kind: 'tremolo', tremolo: 4 })
    })
  })

  describe('selection mode — the press arms the STAMP, exactly as before', () => {
    beforeEach(() => { state.selectedTool = 'selection' })

    it('arms the stamp tool, and leaves note entry unarmed', () => {
      palette.armTremolo(3)
      expect(state.selectedMarkingTool).toEqual({ kind: 'tremolo', tremolo: 3 })
      expect(state.selectedTremolo).toBeNull()
    })

    it('a re-press disarms, a different mark swaps', () => {
      palette.armTremolo(3)
      palette.armTremolo(3)
      expect(state.selectedMarkingTool).toBeNull()
      palette.armTremolo(3)
      palette.armTremolo(1)
      expect(state.selectedMarkingTool).toEqual({ kind: 'tremolo', tremolo: 1 })
    })

    it('⭐ picking a DURATION promotes the armed stamp into note entry — "mark, then length"', () => {
      // The reverse order of the entry flow above, arriving at the same place: the stamp ends and
      // its mark becomes what the notes you are about to write will wear.
      palette.armTremolo(4)
      palette.setDuration('q')
      expect(state.selectedMarkingTool).toBeNull()
      expect(state.selectedTremolo).toBe(4)
    })
  })
})
