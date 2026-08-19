import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MusicEngine } from '../engine/MusicEngine'
import { anchorOfElement, pasteAnchorFor } from './pasteAnchor'
import { createEditorState, type EditorState } from './EditorState'
import { fracCreate as frac, fracToNumber } from '../utils/fraction'
import { levelToGlyphString } from '../utils/dynamics'

/**
 * WHERE A PASTE LANDS, given what is selected.
 *
 * Subject: {@link pasteAnchor}, sitting beside this file. The `MusicEngine` is real — every answer
 * here is a MODEL fact, which is the module's own claim — and only the renderer/playback seams are
 * stubbed, since jsdom draws nothing.
 */
const fakeRegistry = {
  clear: vi.fn(), register: vi.fn(), getAll: vi.fn(() => []),
  findAt: vi.fn(() => null), getByNoteId: vi.fn(() => null),
  registerStaffGeometry: vi.fn(), getStaffGeometry: vi.fn(() => null),
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

describe('pasteAnchor', () => {
  let engine: MusicEngine
  let state: EditorState
  let ids: string[]

  /** `measure@beat` — the shape every case below asserts against. */
  const at = (a: { measure: number; beat: { num: number; den: number } } | null) =>
    a ? `${a.measure}@${fracToNumber(a.beat)}` : 'none'

  beforeEach(() => {
    engine = new MusicEngine({ container: {} as unknown as HTMLElement, width: 800, height: 400 })
    engine.addMeasure() // bar 2, so a barline has somewhere to point
    state = createEditorState()
    // Four quarters in bar 1: C4 D4 E4 F4.
    ids = (['C', 'D', 'E', 'F'] as const).map((step, i) =>
      engine.addNoteAtBeat({ step, octave: 4, duration: 'q', measure: 1, beat: frac(i, 1) })!.id)
  })

  it('anchors to a SELECTED NOTE exactly — its bar, its beat, its lane', () => {
    state.selectedItems = new Map([['note:' + ids[2], { kind: 'note', id: ids[2] }]])
    const anchor = pasteAnchorFor(engine, state)
    expect(at(anchor)).toBe('1@2')
    expect(anchor?.voice).toBe(0)
    expect(anchor?.staff).toBe(0)
  })

  it('anchors to the EARLIEST of several selected notes', () => {
    state.selectedItems = new Map([
      ['note:' + ids[3], { kind: 'note', id: ids[3] }],
      ['note:' + ids[1], { kind: 'note', id: ids[1] }],
    ])
    expect(at(pasteAnchorFor(engine, state))).toBe('1@1')
  })

  it('⭐ a BARLINE points at the NEXT bar’s downbeat — never at the line itself', () => {
    expect(at(anchorOfElement(engine, { kind: 'barline', measure: 1 }))).toBe('2@0')
  })

  it('the LAST barline, with no next bar, falls back to the last slot it closes', () => {
    // Filled deliberately: an empty bar's single rest sits at beat 0, so the fallback would agree
    // with the downbeat by luck of the fixture and prove nothing.
    const filling = ['G', 'A', 'B', 'C'] as const
    filling.forEach((step, i) =>
      engine.addNoteAtBeat({ step, octave: 4, duration: 'q', measure: 2, beat: frac(i, 1) }))
    expect(at(anchorOfElement(engine, { kind: 'barline', measure: 2 }))).toBe('2@3')
  })

  it('a MEASURE-level kind (the meter) points at its own downbeat', () => {
    expect(at(anchorOfElement(engine, { kind: 'timeSignature', measure: 2 }))).toBe('2@0')
  })

  it('a selected DYNAMIC points at its own anchor', () => {
    const id = engine.addDynamic(1, { beat: frac(2, 1), text: levelToGlyphString('f'), voice: 0 })!.id
    const anchor = anchorOfElement(engine, { kind: 'dynamic', id })
    expect(at(anchor)).toBe('1@2')
    expect(anchor?.voice).toBe(0)
  })

  it('a note SUB-ELEMENT (a dot, an accidental…) IS its note, positionally', () => {
    expect(at(anchorOfElement(engine, { kind: 'dot', noteId: ids[1] }))).toBe('1@1')
    expect(at(anchorOfElement(engine, { kind: 'stem', noteId: ids[3] }))).toBe('1@3')
  })

  it('⭐ answers NULL with nothing selected — the caller arms the click rather than guessing a bar', () => {
    expect(pasteAnchorFor(engine, state)).toBeNull()
    expect(anchorOfElement(engine, null)).toBeNull()
  })

  it('answers NULL for an element whose model object is gone (a stale selection)', () => {
    expect(anchorOfElement(engine, { kind: 'dynamic', id: 'no-such-mark' })).toBeNull()
    expect(anchorOfElement(engine, { kind: 'dot', noteId: 'no-such-note' })).toBeNull()
  })
})
