import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MusicEngine } from '../engine/MusicEngine'
import { ClipboardController } from './ClipboardController'
import type { RenderController } from './RenderController'
import type { SelectionController } from './SelectionController'
import { createEditorState, type EditorState } from './EditorState'
import { fracCreate as frac, fracToNumber } from '../utils/fraction'

/**
 * THE DISPATCH: one clipboard, two things it can hold (the music, or one element), and the paste
 * that has to pick without asking. Subject: {@link ClipboardController}, sitting beside this file —
 * WHAT travels is `./elementClipboard`'s spec and WHERE it lands is `./pasteAnchor`'s.
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

describe('ClipboardController — copying one element', () => {
  let engine: MusicEngine
  let state: EditorState
  let clipboard: ClipboardController
  let ids: string[]
  let dynamicId: string

  const dynamics = () => engine.getScore().measures.flatMap(m =>
    (m.dynamics ?? []).map(d => `${m.number}@${fracToNumber(d.beat)}:${d.text}`))

  beforeEach(() => {
    engine = new MusicEngine({ container: {} as unknown as HTMLElement, width: 800, height: 400 })
    engine.addMeasure()
    state = createEditorState()
    ids = (['C', 'D', 'E', 'F'] as const).map((step, i) =>
      engine.addNoteAtBeat({ step, octave: 4, duration: 'q', measure: 1, beat: frac(i, 1) })!.id)
    dynamicId = engine.addDynamic(1, { beat: frac(0, 1), text: 'dolce', voice: 0, placement: 'below' })!.id
    const selection = { selectNote: vi.fn(), selectNotes: vi.fn() } as unknown as SelectionController
    const render = { renderScore: vi.fn() } as unknown as RenderController
    clipboard = new ClipboardController(() => engine, state, selection, render)
  })

  /** Copy the expression, then select `element` and paste. ⚠️ Clears the note selection with it —
   *  selecting an element IS clearing (`elementDeps.pick`), and a stale note would out-rank it. */
  const copyThenPasteOn = (element: EditorState['selectedElement']) => {
    state.selectedElement = { kind: 'dynamic', id: dynamicId }
    clipboard.copy()
    state.selectedItems = new Map()
    state.selectedElement = element
    clipboard.paste()
  }

  it('pastes the copied expression onto a SELECTED NOTE', () => {
    state.selectedElement = { kind: 'dynamic', id: dynamicId }
    clipboard.copy()
    state.selectedElement = null
    state.selectedItems = new Map([['note:' + ids[2], { kind: 'note', id: ids[2] }]])
    clipboard.paste()
    expect(dynamics()).toEqual(['1@0:dolce', '1@2:dolce'])
    expect(state.selectedElement).toEqual({ kind: 'dynamic', id: expect.any(String) })
  })

  it('⭐ pastes at the NEAREST point when what is selected is a barline', () => {
    copyThenPasteOn({ kind: 'barline', measure: 1 })
    expect(dynamics()).toEqual(['1@0:dolce', '2@0:dolce'])
  })

  it('⭐ arms click-to-place when NOTHING is selected', () => {
    state.selectedElement = { kind: 'dynamic', id: dynamicId }
    clipboard.copy()
    state.selectedElement = null
    clipboard.paste()
    expect(state.pastePlacementArmed).toBe(true)
    expect(dynamics()).toEqual(['1@0:dolce'])

    // …and the click commits it where it landed.
    clipboard.pasteAt(2, frac(1, 1), 0)
    expect(state.pastePlacementArmed).toBe(false)
    expect(dynamics()).toEqual(['1@0:dolce', '2@1:dolce'])
  })

  it('⭐⭐ the clip carries the SELECTED marks, not everything the note window encloses', () => {
    // His report: three notes and a slur Ctrl-picked, and the dynamic under them pasted anyway.
    // ⚠️ The notes must ENCLOSE the dynamic (it sits on beat 0), or the window would leave it out
    // by itself and the case would prove nothing — the next one is the same selection plus it.
    const notes = [ids[0], ids[1]]
    state.selectedItems = new Map(notes.map(id => [`note:${id}`, { kind: 'note', id }]))
    clipboard.copy()
    clipboard.pasteAt(2, frac(0, 1), 0)
    expect(dynamics(), 'the unselected dynamic stayed behind').toEqual(['1@0:dolce'])
  })

  it('…and carries it when it IS selected', () => {
    const notes = [ids[0], ids[1]]
    state.selectedItems = new Map<string, { kind: 'note' | 'dynamic'; id: string }>([
      ...notes.map(id => [`note:${id}`, { kind: 'note' as const, id }] as const),
      ['dynamic:' + dynamicId, { kind: 'dynamic', id: dynamicId }],
    ])
    clipboard.copy()
    clipboard.pasteAt(2, frac(0, 1), 0)
    expect(dynamics()).toEqual(['1@0:dolce', '2@0:dolce'])
  })

  it('⭐ a selected TEMPO mark travels with the clip and lands at the paste', () => {
    const tempoId = engine.addTempoMark(1, { beat: frac(0, 1), text: 'Allegro' })!.id
    const notes = [ids[0], ids[1]]
    state.selectedItems = new Map<string, { kind: 'note' | 'tempo'; id: string }>([
      ...notes.map(id => [`note:${id}`, { kind: 'note' as const, id }] as const),
      ['tempo:' + tempoId, { kind: 'tempo', id: tempoId }],
    ])
    clipboard.copy()
    clipboard.pasteAt(2, frac(0, 1), 0)
    const pasted = engine.getScore().measures[1].tempos ?? []
    expect(pasted.map(t => t.text)).toEqual(['Allegro'])
    expect(pasted[0].id, 'a paste mints a new mark').not.toBe(tempoId)
  })

  it('…and stays behind when it is NOT selected', () => {
    engine.addTempoMark(1, { beat: frac(0, 1), text: 'Allegro' })
    const notes = [ids[0], ids[1]]
    state.selectedItems = new Map(notes.map(id => [`note:${id}`, { kind: 'note', id }]))
    clipboard.copy()
    clipboard.pasteAt(2, frac(0, 1), 0)
    expect(engine.getScore().measures[1].tempos ?? []).toEqual([])
  })

  it('⭐ copies a GROUP OF RESTS and selects the silence it pasted', () => {
    // His report: a note copies and pastes, a rest does not. The clip carries no EVENTS (a rest is
    // a gap the relay regenerates), so the paste reports no created notes — and the selection has
    // to come from the window, or a successful paste looks like nothing happened.
    engine.convertToRest(ids[1])
    engine.convertToRest(ids[2])
    const rests = engine.getScore().measures[0].slots
      .filter(sl => sl.type === 'rest').map(sl => sl.id)
    expect(rests).toHaveLength(2)
    state.selectedItems = new Map(rests.map(id => [`note:${id}`, { kind: 'note', id }]))
    clipboard.copy()
    expect(clipboard.hasContent(), 'the copy is not refused').toBe(true)

    // ⚠️ Bar 2 is FILLED first: an empty bar is already a rest, so pasting silence into it would
    // agree with the fixture and prove nothing.
    const filling = ['G', 'A', 'B', 'C'] as const
    filling.forEach((step, i) =>
      engine.addNoteAtBeat({ step, octave: 4, duration: 'q', measure: 2, beat: frac(i, 1) }))
    clipboard.pasteAt(2, frac(0, 1), 0)

    const bar2 = engine.getScore().measures[1].slots
      .slice().sort((a, b) => fracToNumber(a.beat) - fracToNumber(b.beat))
    expect(bar2.map(sl => `${sl.type}@${fracToNumber(sl.beat)}`))
      .toEqual(['rest@0', 'rest@1', 'chord@2', 'chord@3']) // the two rests, as themselves
    expect(state.selectedItems.size, 'the pasted silence is selected').toBeGreaterThan(0)
  })

  it('holds ONE thing: copying notes drops the element, and copying an element drops the notes', () => {
    state.selectedItems = new Map([['note:' + ids[0], { kind: 'note', id: ids[0] }]])
    clipboard.copy()
    expect(clipboard.hasContent()).toBe(true)

    // The element copy replaces it, so this paste writes a mark and no notes.
    copyThenPasteOn({ kind: 'barline', measure: 1 })
    expect(dynamics()).toEqual(['1@0:dolce', '2@0:dolce'])
    expect(engine.getScore().measures[1].slots.filter(s => s.type === 'chord')).toHaveLength(0)
  })
})
