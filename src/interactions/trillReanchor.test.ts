import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MusicEngine } from '../engine/MusicEngine'
import { createEditorState, type EditorState } from './EditorState'
import { reanchorArmedTrillEndpoint } from './trillReanchor'
import { fracCreate as frac } from '../utils/fraction'

/**
 * Ctrl+Shift+←/→ walks an armed trill square onto the previous/next note.
 *
 * Subject: {@link trillReanchor}, sitting beside this file. The `MusicEngine` is real — which note
 * the walk lands on, and what the model refuses, are its answers — and nothing here needs a
 * renderer: the walk reads the BEAT MAP, not pixels.
 *
 * ⭐⭐ **The claims that are this family's own, and neither exists on the slur:** an absent end is a
 * real state (the one-note trill), so stepping the end back onto the start CLEARS it rather than
 * refusing; and stepping forward from a trill with no end starts from where the LINE stops — the end
 * of the tie chain — not from the start note.
 */
vi.mock('../engine/rendering/VexFlowRenderer', () => ({
  VexFlowRenderer: class {
    initialize = vi.fn(); renderScore = vi.fn()
    getElementRegistry = vi.fn(() => ({
      clear: vi.fn(), register: vi.fn(), getAll: vi.fn(() => []),
      findAt: vi.fn(() => null), getById: vi.fn(() => null),
      registerStaffGeometry: vi.fn(), getStaffGeometry: vi.fn(() => null),
      getByMeasure: vi.fn(() => []),
    }))
  },
}))
vi.mock('../engine/audio/PlaybackEngine', () => ({
  PlaybackEngine: class {
    setScore = vi.fn(); play = vi.fn(); pause = vi.fn(); stop = vi.fn(); setVolume = vi.fn(); onStateChange = vi.fn()
  },
}))

describe('reanchorArmedTrillEndpoint', () => {
  let engine: MusicEngine
  let state: EditorState
  let ids: string[]
  let trillId: string

  /** The live trill, re-read each time (the model is replaced wholesale by undo). */
  const trill = () => engine.getTrillById(trillId)!
  /** Which note index an id is, for readable assertions. */
  const idx = (noteId: string | undefined) => (noteId === undefined ? null : ids.indexOf(noteId))

  const arm = (endpoint: 'start' | 'end') => {
    state.selectedElement = { kind: 'trill', id: trillId, endpoint }
  }
  const step = (direction: 1 | -1) => reanchorArmedTrillEndpoint(state, engine, direction)

  beforeEach(() => {
    engine = new MusicEngine({ container: {} as unknown as HTMLElement, width: 800, height: 400 })
    engine.addMeasure()
    // Four quarters in one bar, one voice: C4 D4 E4 F4.
    ids = (['C', 'D', 'E', 'F'] as const).map((s, i) =>
      engine.addNoteAtBeat({ step: s, octave: 4, duration: 'q', measure: 1, beat: frac(i, 1) })!.id)
    trillId = engine.createTrill([ids[1], ids[2]])!.id // D4 → E4, room to walk either way
    state = createEditorState()
  })

  it('DECLINES with no square armed — the chord must fall through to the note offset', () => {
    expect(step(-1)).toBe(false)
    state.selectedElement = { kind: 'trill', id: trillId } // the trill itself, no square armed
    expect(step(-1)).toBe(false)
  })

  it('⭐ the END square walks the end one note, and the start holds', () => {
    arm('end')
    expect(step(1)).toBe(true)
    expect(idx(trill().endNoteId), 'E4 → F4').toBe(3)
    expect(idx(trill().startNoteId), 'the start held').toBe(1)
  })

  it('⭐ the START square walks the start one note, and the end holds', () => {
    arm('start')
    expect(step(-1)).toBe(true)
    expect(idx(trill().startNoteId), 'D4 → C4').toBe(0)
    expect(idx(trill().endNoteId), 'the end held').toBe(2)
  })

  it('⭐⭐ stepping the END back onto the START CLEARS it — the one-note trill, not a refusal', () => {
    arm('end')
    expect(step(-1)).toBe(true)
    expect(trill().endNoteId, 'absent, ⛔ not equal to the start').toBeUndefined()
    expect(idx(trill().startNoteId)).toBe(1)
    // ⚠️ …and it may not go further back: past the start there is nothing to trill.
    expect(step(-1), 'no end to walk, and the start is the floor').toBe(false)
  })

  it('⭐⭐ stepping FORWARD with no end starts from where the LINE stops, not from the start', () => {
    // A one-note trill on D4 stops on D4 (no ties here), so one step forward reaches E4 — the note
    // the eye would call "one further along the line".
    arm('end')
    step(-1) // clear it first
    expect(trill().endNoteId).toBeUndefined()
    expect(step(1)).toBe(true)
    expect(idx(trill().endNoteId)).toBe(2)
  })

  it('⭐⭐ …and with a TIE, "where the line stops" is the END OF THE CHAIN, not the start note', () => {
    // 🚨 THE BREAK-TEST THE CASE ABOVE CANNOT BE: with no ties, the tie chain's end IS the start
    // note, so reading either one gives the same answer and the whole `trillSpan` lookup could be
    // deleted with the suite green. Tie D4 into E4 and they part company — a one-note trill on D4
    // draws its line to E4, so one step forward must reach F4.
    engine.toggleTie(ids[1])
    arm('end')
    step(-1)                                   // clear the explicit end
    expect(trill().endNoteId).toBeUndefined()
    expect(step(1)).toBe(true)
    expect(idx(trill().endNoteId), 'past the tied E4, onto F4').toBe(3)
  })

  it('⭐⭐ the START stepping ONTO the end COLLAPSES the trill — his report, 2026-08-18', () => {
    // *"i can move the first point (tr) to the left but not to the right"* — on a trill whose end
    // was the very next note, so every rightward step reached it and the clamp refused. Reaching the
    // end is not passing it: the trill becomes the one-note trill ON that note, which is
    // `addTrill`'s own normalisation (*an end equal to the start is spelled by omitting it*).
    arm('start')
    expect(step(1)).toBe(true)
    expect(idx(trill().startNoteId), 'D4 → E4, the note the end was on').toBe(2)
    expect(trill().endNoteId, 'collapsed, ⛔ not left equal to the start').toBeUndefined()
    // …and now that nothing bounds it, it keeps going.
    expect(step(1)).toBe(true)
    expect(idx(trill().startNoteId)).toBe(3)
  })

  it('⛔ …but it may not PASS the end — the span never inverts', () => {
    // Two notes of room: the start at C4 with the end at E4 may reach E4 but not F4 in one press,
    // and the collapse is what makes "reach" legal. 🚨 The break-test for `>` vs `>=` is the case
    // above; this one is for the opposite mistake, dropping the clamp altogether.
    engine.setTrillAnchor(trillId, 'start', ids[0])
    arm('start')
    expect(step(1)).toBe(true)                       // C4 → D4
    expect(step(1)).toBe(true)                       // D4 → E4, collapsing
    expect(idx(trill().startNoteId)).toBe(2)
    expect(trill().endNoteId).toBeUndefined()
  })

  it('declines at the edges of the lane, touching nothing', () => {
    arm('start')
    expect(step(-1)).toBe(true)   // → C4, the first note
    expect(step(-1), 'off the front of the lane').toBe(false)
    expect(idx(trill().startNoteId)).toBe(0)

    arm('end')
    expect(step(1)).toBe(true)    // → F4, the last note
    expect(step(1), 'off the end of the lane').toBe(false)
    expect(idx(trill().endNoteId)).toBe(3)
  })

  it('⛔ declines for a trill the score no longer has', () => {
    arm('end')
    engine.removeTrill(trillId)
    expect(step(1)).toBe(false)
  })

  it('⚠️ A REST IS NOT A STOP — the walk steps over it', () => {
    // Turning the END's note into a rest does two things at once, and both are other modules'
    // stated rules meeting here:
    //  - `trillSpan` DEGRADES a trill whose end no longer resolves to the one-note trill, so "where
    //    this end is now" becomes the start note rather than nothing;
    //  - the beat map is filtered to notes, so the rest is not a stop at all.
    // One step forward therefore reaches F4, skipping the rest — ⭐ which is the answer the eye
    // wants, and the case that would break if either rule were dropped: without the filter the walk
    // would land on the rest and `setTrillEnd` would refuse, leaving the key looking dead.
    engine.convertToRest(ids[2])
    arm('end')
    expect(step(1)).toBe(true)
    expect(idx(trill().endNoteId), 'over the rest, onto F4').toBe(3)
  })
})
