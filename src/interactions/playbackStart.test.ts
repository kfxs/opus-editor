// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { playbackStartMeasure } from './playbackStart'
import { createEditorState } from './EditorState'
import { itemKey, type SelectionItem } from './selection'
import { MusicEngine } from '../engine/MusicEngine'
import { fracCreate } from '@/utils/fraction'
import type { NoteParams } from '@/types/music'

/**
 * WHERE PLAYBACK STARTS — "at what you are looking at".
 *
 * A real engine rather than a stub: the answer is a fact about the score (which bar holds this
 * note), and the whole risk in the rule is resolving a selection to a bar, not the arithmetic
 * around it. No geometry is asserted, so jsdom's missing layout costs nothing here.
 */
describe('playbackStartMeasure', () => {
  let engine: MusicEngine
  let state: ReturnType<typeof createEditorState>

  beforeEach(() => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    engine = new MusicEngine({ container, width: 900, height: 500 })
    state = createEditorState()
    while (engine.getScore().measures.length < 8) engine.addMeasure()
  })

  /**
   * Select notes the way the app does — through `itemKey`, so the Map is keyed `"note:<id>"`.
   *
   * ⚠️ **The point of this helper.** The first version of this spec built the Map with bare ids as
   * keys, which no code path ever produces; the implementation read the KEYS, every engine lookup
   * missed, and playback started at bar 1 for every note selection while these tests stayed green.
   * A fixture that invents its own data shape tests the fixture.
   */
  const select = (...ids: string[]) => {
    state.selectedItems = new Map(
      ids.map(id => {
        const item: SelectionItem = { kind: 'note', id }
        return [itemKey(item), item]
      }),
    )
    state.selectedNoteId = ids[ids.length - 1] ?? null
  }

  /** One quarter at beat 0 of `measure`; returns its id. */
  const noteIn = (measure: number, beat = 0): string =>
    engine.addNoteAtBeat({
      step: 'C', octave: 4, duration: 'q', measure, beat: fracCreate(beat, 1),
    } as NoteParams)!.id

  it('starts at the top when nothing is selected', () => {
    expect(playbackStartMeasure(state, engine)).toBe(1)
  })

  it('starts at the selected note\'s bar', () => {
    select(noteIn(5))
    expect(playbackStartMeasure(state, engine)).toBe(5)
  })

  it('…and from the anchor alone, when nothing populated the item map', () => {
    // Some paths set only `selectedNoteId` (the entry cursor's note, for one).
    state.selectedNoteId = noteIn(4)
    expect(playbackStartMeasure(state, engine)).toBe(4)
  })

  it('⚠️ ignores the non-note items a passage selection sweeps in', () => {
    const note = noteIn(6)
    const items = new Map<string, SelectionItem>()
    const dyn: SelectionItem = { kind: 'dynamic', id: 'some-dynamic' }
    const n: SelectionItem = { kind: 'note', id: note }
    items.set(itemKey(dyn), dyn)
    items.set(itemKey(n), n)
    state.selectedItems = items
    expect(playbackStartMeasure(state, engine), 'the NOTES say where the music starts').toBe(6)
  })

  it('⭐ starts at the EARLIEST of a group, whichever order it was clicked in', () => {
    const late = noteIn(6)
    const early = noteIn(3)
    // Selected back-to-front, as a shift-click backwards through a phrase would.
    select(late, early)
    expect(playbackStartMeasure(state, engine)).toBe(3)
  })

  it('breaks a same-bar tie by BEAT, not by click order', () => {
    const onFour = noteIn(4, 3)
    const onOne = noteIn(4, 0)
    select(onFour, onOne)
    expect(playbackStartMeasure(state, engine)).toBe(4)
  })

  it('⭐ a BARLINE starts the bar AFTER it — the line ENDS bar N', () => {
    state.selectedElement = { kind: 'barline', measure: 3 }
    expect(playbackStartMeasure(state, engine)).toBe(4)
  })

  it('…and the final barline does not run off the end of the score', () => {
    const last = engine.getScore().measures.length
    state.selectedElement = { kind: 'barline', measure: last }
    expect(playbackStartMeasure(state, engine)).toBe(last)
  })

  it('a clef or a meter starts at its own bar', () => {
    state.selectedElement = { kind: 'clef', measure: 6, beat: 0, staff: 0 }
    expect(playbackStartMeasure(state, engine)).toBe(6)
    state.selectedElement = { kind: 'timeSignature', measure: 2 }
    expect(playbackStartMeasure(state, engine)).toBe(2)
  })

  it('a range of bars starts at its first, whichever end was dragged from', () => {
    state.selectedElement = { kind: 'measureRange', anchor: 7, focus: 4, staff: 0, boxStyle: 'single' }
    expect(playbackStartMeasure(state, engine)).toBe(4)
  })

  it('an id-addressed mark starts at the bar of the note it hangs off', () => {
    const id = noteIn(5)
    for (const el of [
      { kind: 'articulation', noteId: id, type: null },
      { kind: 'accidental', noteId: id, type: null },
      { kind: 'dot', noteId: id },
      { kind: 'stem', noteId: id },
      { kind: 'tremolo', noteId: id },
      { kind: 'tie', fromNoteId: id },
    ] as const) {
      state.selectedElement = el
      expect(playbackStartMeasure(state, engine), `${el.kind} resolves to its note's bar`).toBe(5)
    }
  })

  it('the ELEMENT wins over the note selection — it is the more specific answer', () => {
    select(noteIn(2))
    state.selectedElement = { kind: 'barline', measure: 6 }
    expect(playbackStartMeasure(state, engine)).toBe(7)
  })

  it('falls back to the top rather than guessing when an id cannot be located', () => {
    // A dynamic the renderer never drew: the registry cannot say which bar it is in, and inventing
    // one would be worse than starting at the beginning.
    state.selectedElement = { kind: 'dynamic', id: 'no-such-dynamic' }
    expect(playbackStartMeasure(state, engine)).toBe(1)
  })
})
