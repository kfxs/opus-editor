import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MusicEngine } from '../../engine/MusicEngine'
import { createEditorState, type EditorState } from '../state/EditorState'
import { tempoInsertStop } from './tempoInsertAnchor'
import { fracCreate as frac, fracToNumber } from '../../utils/fraction'

/**
 * Where `Ctrl+Alt+T` puts the mark, from the SELECTION alone — his ask, 2026-08-31.
 *
 * Subject: {@link tempoInsertAnchor}, beside this file. The `MusicEngine` is real (the score and its
 * onsets are its answers) and nothing here is drawn: the question is an address, ⛔ not a pixel.
 */
vi.mock('../../engine/rendering/ScoreRenderer', () => ({
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
vi.mock('../../engine/audio/PlaybackEngine', async () => (await import('@/testing/engineStubs')).playbackEngineStub())

describe('tempoInsertStop', () => {
  let engine: MusicEngine
  let state: EditorState
  let ids: string[]

  /** The answer as `measure@beat`, or `'none'` — the shape every case below reads. */
  const stop = () => {
    const at = tempoInsertStop(state, engine)
    return at ? `${at.measure}@${fracToNumber(at.beat)}` : 'none'
  }

  beforeEach(() => {
    engine = new MusicEngine({ container: {} as unknown as HTMLElement, width: 800, height: 400 })
    state = createEditorState()
    // Two bars of four quarters — bar 2 exists, so a barline in bar 1 has somewhere to point.
    engine.addMeasure()
    ids = [1, 2].flatMap(measure => (['C', 'D', 'E', 'F'] as const).map((step, i) =>
      engine.addNoteAtBeat({ step, octave: 4, duration: 'q', measure, beat: frac(i, 1) })!.id))
  })

  it('⭐⭐ a BARLINE names the bar AFTER it — the line is a boundary, and the mark says "from here on"', () => {
    state.selectedElement = { kind: 'barline', measure: 1 }
    expect(stop()).toBe('2@0')
  })

  it('⛔ …and the FINAL barline names nothing — ⛔ never the last onset in the score', () => {
    // `tempoOps.tempoAnchorAt` would answer with the last stop it has (its own end-of-score
    // fallback), which is the mark landing a whole bar away from the line that was selected.
    state.selectedElement = { kind: 'barline', measure: 2 }
    expect(stop()).toBe('none')
  })

  it('⭐⭐ a MEASURE selection names its FIRST bar, beat 0', () => {
    state.selectedElement = {
      kind: 'measureRange', anchor: 2, focus: 2, staff: 0, focusStaff: 0, boxStyle: 'single',
    }
    // ⚠️ A single-bar box populates `selectedItems`/`selectedNoteId` too — the element must win, or
    //    the mark lands wherever inside the bar the box-select happened to leave the anchor item.
    state.selectedNoteId = ids[7]
    expect(stop()).toBe('2@0')
  })

  it('⭐ …and a passage dragged BACKWARDS still names its first bar', () => {
    state.selectedElement = {
      kind: 'measureRange', anchor: 2, focus: 1, staff: 0, focusStaff: 0, boxStyle: 'double',
    }
    expect(stop()).toBe('1@0')
  })

  it('a NOTE still names its own beat — the behaviour Ctrl+Alt+T already had', () => {
    state.selectedNoteId = ids[2]
    expect(stop()).toBe('1@2')
  })

  it('nothing selected names nothing — the caller arms the click-to-place tool', () => {
    expect(stop()).toBe('none')
  })

  it('⭐ an emptied bar answers with the stop it HAS — the mark anchors to an onset, ⛔ never a raw beat 0', () => {
    // Bar 2 cleared to one whole rest: beat 0 is still an onset, and that is the one the mark takes.
    engine.clearMeasureStaff(2, 0)
    state.selectedElement = { kind: 'barline', measure: 1 }
    expect(stop()).toBe('2@0')
  })
})
