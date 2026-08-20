import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MusicEngine } from '../engine/MusicEngine'
import { createEditorState, type EditorState } from './EditorState'
import { nextTrillAnchorStop, reanchorArmedTrillEndpoint } from './trillReanchor'
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
  })

  it('⭐⭐ ONE STEP PAST THE COLLAPSE IS THE BARE `tr` — his ask, 2026-08-18', () => {
    // *"there are cases where the user wants to have `tr` without the line … if I'm re-anchoring the
    // last endpoint I can go more to the left than the default."* ⭐ It fills a step that used to
    // DECLINE — this case previously asserted `false` here, which is what made the hole visible.
    arm('end')
    step(-1)                                       // → the one-note trill
    expect(trill().extension).toBeUndefined()
    expect(step(-1)).toBe(true)
    expect(trill().extension, 'no wavy line at all').toBe('none')
    expect(trill().endNoteId, 'and still no end — the two contradict').toBeUndefined()
    // ⚠️ …and THAT is the floor: there is nothing further left than a bare sign.
    expect(step(-1), 'nothing past a bare tr').toBe(false)
  })

  it('⭐ and `→` puts the line back on the same note — reversible, one axis', () => {
    arm('end')
    step(-1); step(-1)
    expect(trill().extension).toBe('none')
    expect(step(1)).toBe(true)
    expect(trill().extension, 'the line is back').toBeUndefined()
    expect(idx(trill().startNoteId), 'and the trill has not moved').toBe(1)
    expect(trill().endNoteId, 'still the one-note trill, ⛔ not re-extended in the same press')
      .toBeUndefined()
    // …one more `→` then extends it again, which is the ordinary walk resuming.
    expect(step(1)).toBe(true)
    expect(idx(trill().endNoteId)).toBe(2)
  })

  it('⛔ an explicit END and "no line" cannot both be held — re-anchoring restores the line', () => {
    arm('end')
    step(-1); step(-1)
    expect(trill().extension).toBe('none')
    // The line is what tells the reader how long to keep trilling, so giving the trill an extent
    // gives it back its line — `setTrillEnd`'s half of the invariant.
    engine.setTrillAnchor(trillId, 'end', ids[2])
    expect(trill().extension).toBeUndefined()
    expect(idx(trill().endNoteId)).toBe(2)
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

  it('🚨🚨 THE START STEPS OVER A NOTE THAT ALREADY TRILLS — his report, 2026-08-20', () => {
    // *"it never gets the next target (it seems like the second trill is interfering, but after the
    // second trill are other notes that have no trill)"*. The op is right to refuse a second
    // ornament on one notehead; offering that note as the step and letting it say no left the key
    // DEAD against it. A note the model would refuse is not a stop — so the walk skips it, exactly
    // as it has always skipped a rest.
    engine.setTrillAnchor(trillId, 'end', null)   // a one-note trill on D4, free to travel
    engine.createTrill([ids[2]])                  // …and E4 now carries its own
    arm('start')
    expect(step(1)).toBe(true)
    expect(idx(trill().startNoteId), 'over E4, onto F4').toBe(3)
  })

  it('⭐ …but an END may land there — spans overlap, and only the START is single-valued', () => {
    engine.createTrill([ids[3]])                  // F4 carries its own trill
    arm('end')
    expect(step(1)).toBe(true)
    expect(idx(trill().endNoteId), 'E4 → F4, under the other trill\'s sign').toBe(3)
  })

  it('🚨🚨 THE CLAMP ASKS WHERE THE OTHER END IS, ⛔ not where it sits in the STOPS list', () => {
    // His report, 2026-08-20: a dragged start refused on every frame — *"the start would pass the
    // end"*, over and over. The far end was a note carrying ANOTHER trill, so the candidate filter
    // had dropped it from the list; `findIndex` answered −1, the guard read that as "there is no end
    // to cross", and the walk offered a note far beyond it for the model to refuse for ever.
    engine.setTrillAnchor(trillId, 'end', ids[2])     // D4 → E4
    engine.createTrill([ids[2]])                      // …and E4 now carries a trill of its own
    arm('start')
    // 🚨 The CANDIDATE is the thing under test: with the index clamp it offers F4 — PAST the end —
    // and only the model's refusal hides it, which is what made the drag retry for ever.
    expect(nextTrillAnchorStop(engine, trillId, 'start', 1),
      'nothing is offered past the end, occupied or not').toBeNull()
    expect(step(1), 'so the key declines and nothing is written').toBe(false)
    expect(idx(trill().startNoteId)).toBe(1)
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
    //
    // ⭐ Carrying a trill's line over EMPTY BARS is not this key's job either — that is the INK's
    // (his rule, 2026-08-20: *"no anchor to a note but offset in the next system"*).
    engine.convertToRest(ids[2])
    arm('end')
    expect(step(1)).toBe(true)
    expect(idx(trill().endNoteId), 'over the rest, onto F4').toBe(3)
  })
})
