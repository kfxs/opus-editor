import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MusicEngine } from '../engine/MusicEngine'
import { repeatSelectedPassage } from './repeatPassage'
import { createEditorState, type EditorState } from './EditorState'
import type { SelectionController } from './SelectionController'
import { fracCreate as frac, fracToNumber } from '../utils/fraction'
import { getMeasureNotes } from '../utils/musicUtils'
import { formatPitch } from '../utils/pitchSpelling'

/**
 * `R` — the selected bar(s) copied over the bars that FOLLOW. Subject: {@link repeatSelectedPassage},
 * sitting beside this file. ⛔ What TRAVELS in the clip is `./clipboard`'s spec and how it lands is
 * `rebarOps.pasteEvents`'s — what is asserted here is the repeat's own three answers: which passage,
 * which destination bar, and that nothing was inserted.
 */
vi.mock('../engine/rendering/ScoreRenderer', () => ({
  ScoreRenderer: class {
    initialize = vi.fn(); renderScore = vi.fn()
    getElementRegistry = vi.fn(() => ({
      clear: vi.fn(), register: vi.fn(), getAll: vi.fn(() => []),
      findAt: vi.fn(() => null), getByNoteId: vi.fn(() => null),
      registerStaffGeometry: vi.fn(), getStaffGeometry: vi.fn(() => null),
    }))
  },
}))
vi.mock('../engine/audio/PlaybackEngine', () => ({
  PlaybackEngine: class {
    setScore = vi.fn(); play = vi.fn(); pause = vi.fn(); stop = vi.fn(); setVolume = vi.fn(); onStateChange = vi.fn()
  },
}))

describe('repeatSelectedPassage — R copies the selected bars forward', () => {
  let engine: MusicEngine
  let state: EditorState
  let selection: SelectionController

  /** Every bar's content as `pitch@beat` strings, so a repeat can be compared bar to bar. */
  const barContent = (n: number) =>
    getMeasureNotes(engine.getScore().measures.find(m => m.number === n)!)
      .map(note => `${note.isRest ? 'r' : formatPitch(note)}@${fracToNumber(note.beat)}`)

  const box = (anchor: number, focus: number, staff = 0, focusStaff = staff) => {
    state.selectedElement = { kind: 'measureRange', anchor, focus, staff, focusStaff, boxStyle: 'single' }
  }

  beforeEach(() => {
    engine = new MusicEngine({ container: {} as unknown as HTMLElement, width: 800, height: 400 })
    for (let i = 0; i < 4; i++) engine.addMeasure() // bars 1–5
    state = createEditorState()
    selection = { selectMeasureContents: vi.fn() } as unknown as SelectionController
    // Bar 1: C D E F. Bar 2: G A B C.
    ;(['C', 'D', 'E', 'F'] as const).forEach((step, i) =>
      engine.addNoteAtBeat({ step, octave: 4, duration: 'q', measure: 1, beat: frac(i, 1) }))
    ;(['G', 'A', 'B'] as const).forEach((step, i) =>
      engine.addNoteAtBeat({ step, octave: 4, duration: 'q', measure: 2, beat: frac(i, 1) }))
    engine.addNoteAtBeat({ step: 'C', octave: 5, duration: 'q', measure: 2, beat: frac(3, 1) })
  })

  it('reproduces ONE selected bar in the bar after it', () => {
    box(1, 1)
    expect(repeatSelectedPassage(engine, state, selection)).toBe(true)
    expect(barContent(2)).toEqual(barContent(1))
  })

  it('reproduces a GROUP of bars in the bars after them, in order', () => {
    box(1, 2)
    expect(repeatSelectedPassage(engine, state, selection)).toBe(true)
    expect(barContent(3)).toEqual(barContent(1))
    expect(barContent(4)).toEqual(barContent(2))
  })

  it('⛔ INSERTS NOTHING — the bar count is unchanged and the bars after the copy are untouched', () => {
    const before = engine.getScore().measures.length
    const bar5 = barContent(5)
    box(1, 1)
    repeatSelectedPassage(engine, state, selection)
    expect(engine.getScore().measures.length).toBe(before)
    expect(barContent(5)).toEqual(bar5)
  })

  it('OVERWRITES what the destination held — the repeat replaces, it does not merge', () => {
    box(2, 2)
    repeatSelectedPassage(engine, state, selection)
    expect(barContent(3)).toEqual(barContent(2))
    expect(barContent(3)).not.toContain('r@0')
  })

  it('moves the BOX to the copy, so a second R fills forward again', () => {
    box(1, 1)
    repeatSelectedPassage(engine, state, selection)
    expect(state.selectedElement).toMatchObject({ kind: 'measureRange', anchor: 2, focus: 2 })
    repeatSelectedPassage(engine, state, selection)
    expect(barContent(3)).toEqual(barContent(1))
  })

  it('APPENDS a bar when the selection is the last one — the only growth it may cause', () => {
    const last = engine.getScore().measures.length
    box(last, last)
    expect(repeatSelectedPassage(engine, state, selection)).toBe(true)
    expect(engine.getScore().measures.length).toBe(last + 1)
    expect(barContent(last + 1)).toEqual(barContent(last))
  })

  it('carries the enclosed MARKS with the music', () => {
    engine.dynamic.addDynamic(1, { beat: frac(0, 1), text: 'mp', voice: 0, placement: 'below' })
    box(1, 1)
    repeatSelectedPassage(engine, state, selection)
    const bar2 = engine.getScore().measures.find(m => m.number === 2)!
    expect((bar2.dynamics ?? []).map(d => d.text)).toEqual(['mp'])
  })

  it('is ONE undo entry — the repeat undoes as a whole', () => {
    const bar2 = barContent(2)
    box(1, 1)
    repeatSelectedPassage(engine, state, selection)
    engine.undo()
    expect(barContent(2)).toEqual(bar2)
  })

  it('DECLINES with no measure box selected, changing nothing', () => {
    state.selectedElement = null
    expect(repeatSelectedPassage(engine, state, selection)).toBe(false)
  })
})
