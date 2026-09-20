// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { MusicEngine } from '../engine/MusicEngine'
import { wireShortcuts } from './shortcutWiring'
import { createEditorState, type EditorState } from './EditorState'
import { fracCreate as frac } from '@/utils/fraction'
import { measureSelectableNotes } from '@/utils/musicUtils'
import { staffOf } from '@/utils/lanes'

/**
 * Subject: `./shortcutWiring` — what **Delete** takes when the selection is the SINGLE measure box.
 *
 * 🚨 **HIS REPORT, 2026-08-30** (console log, the Prelude open, two staves): a bar selected on both
 * staves — `✓ Passage extended | measures:1–1 staves:0–1 (multi-staff)` — cleared only staff 0. The
 * box is a PASSAGE (`./measurePassage`: bars × staves) and Delete read its ANCHOR CELL, so it took
 * strictly less than the highlight had promised.
 *
 * ⭐ The rule under test is the one the passage work turned on: **the highlight promises the copy**
 * — whatever the box encloses is what Delete clears. So the assertions are about the RECTANGLE, on
 * both axes, and the single-cell case is just a rectangle of one.
 */
vi.mock('../engine/rendering/ScoreRenderer', () => ({
  ScoreRenderer: class {
    initialize = vi.fn(); renderScore = vi.fn()
    getElementRegistry = vi.fn(() => ({
      clear: vi.fn(), register: vi.fn(), getAll: vi.fn(() => []),
      findAt: vi.fn(() => null), getById: vi.fn(() => null),
      registerStaffGeometry: vi.fn(), getStaffGeometry: vi.fn(() => null),
      getByMeasure: vi.fn(() => []),
    }))
  },
}))
vi.mock('../engine/audio/PlaybackEngine', async () => (await import('@/testing/engineStubs')).playbackEngineStub())

describe('Delete on the single measure box clears the whole passage', () => {
  let state: EditorState
  let engine: MusicEngine
  let teardown: () => void

  /**
   * Notes (not the filler rests) left on `staff` in `measure` — what a clear is supposed to empty.
   *
   * ⚠️ Through the FLAT projection, not `measure.slots`: a slot addresses its staff by `staffId`
   * (absent for the first), so filtering raw slots with `staffOf` reads a field that is not there
   * and files every staff under 0.
   */
  const notesIn = (measure: number, staff: number): unknown[] => {
    const score = engine.getScore()
    const bar = score.measures.find(m => m.number === measure)
    if (!bar) return []
    return measureSelectableNotes(bar, score).filter(n => !n.isRest && staffOf(n) === staff)
  }

  beforeEach(() => {
    engine = new MusicEngine({ container: {} as unknown as HTMLElement, width: 800, height: 400 })
    engine.addMeasure()
    engine.addMeasure()
    engine.addStaffBelow(0)
    // A note in every cell of a 2 bars × 2 staves grid, so any cell left uncleared is visible.
    for (const measure of [1, 2]) {
      for (const staff of [0, 1]) {
        engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'q', measure, beat: frac(0, 1), staff })
      }
    }
    state = createEditorState()
    state.selectedTool = 'selection'

    const wiring = wireShortcuts(
      state,
      () => engine,
      { selectNote: vi.fn(), deselectAll: vi.fn() } as never,
      { clearArmedArticulations: vi.fn() } as never,
      {} as never,
      { renderScore: vi.fn(), previewMarks: vi.fn() } as never,
      {} as never,
      { model: { getViewportSize: () => ({ w: 800, h: 400 }) } } as never,
      () => null, () => {}, () => {}, () => false,
      vi.fn(),
    )
    wiring.enable()
    teardown = wiring.disable
  })

  afterEach(() => { teardown() })

  const pressDelete = () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }))

  const selectBox = (anchor: number, focus: number, staff: number, focusStaff: number) => {
    state.selectedElement = { kind: 'measureRange', anchor, focus, staff, focusStaff, boxStyle: 'single' }
  }

  it('🚨 clears BOTH staves of a bar selected across the grand staff — his report', () => {
    selectBox(1, 1, 0, 1)
    pressDelete()
    expect(notesIn(1, 0)).toHaveLength(0)
    expect(notesIn(1, 1)).toHaveLength(0)
  })

  it('clears every bar in the span, not only the anchor bar', () => {
    selectBox(1, 2, 0, 0)
    pressDelete()
    expect(notesIn(1, 0)).toHaveLength(0)
    expect(notesIn(2, 0)).toHaveLength(0)
  })

  it('leaves everything OUTSIDE the box alone — the box is a rectangle, not a row', () => {
    selectBox(1, 1, 0, 0)
    pressDelete()
    expect(notesIn(1, 0)).toHaveLength(0)
    expect(notesIn(1, 1)).toHaveLength(1)
    expect(notesIn(2, 0)).toHaveLength(1)
  })

  it('takes a box drawn UPWARD/leftward the same way — the anchor may be the high end', () => {
    selectBox(2, 1, 1, 0)
    pressDelete()
    expect(notesIn(1, 0)).toHaveLength(0)
    expect(notesIn(2, 1)).toHaveLength(0)
  })

  it('is ONE undo step for the whole rectangle, however many cells it holds', () => {
    selectBox(1, 2, 0, 1)
    pressDelete()
    expect(notesIn(2, 1)).toHaveLength(0)
    engine.undo()
    // Every cell comes back on the single undo — not just the last one cleared.
    expect(notesIn(1, 0)).toHaveLength(1)
    expect(notesIn(2, 1)).toHaveLength(1)
  })
})
