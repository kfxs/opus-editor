/**
 * ⭐ **RE-ANCHOR AN ARMED TRILL SQUARE FROM THE KEYBOARD** — `Ctrl+Shift+←/→` walks the armed end
 * off its note and onto the previous/next one (his ask, 2026-08-18).
 *
 * A module of its own rather than a branch in `shortcutWiring`, per CLAUDE.md's rule and
 * `./slurReanchor`'s precedent: the walk is logic — a lane-scoped beat map, a chord-tolerant lookup
 * by POSITION, and two clamps that are this family's own — not the one-line "read the selection,
 * call the engine" glue the wiring file holds.
 *
 * ⭐⭐ **…and the CANDIDATE RULE is exported**, because the interpolating walk (`./trillWalk`) must
 * land the ink on exactly the notes this key lands the anchor on. Two rules would mean the same
 * square reaching a different note depending on how far it had been nudged — `nextSlurAnchorStop`'s
 * reason, and the family's.
 *
 * ## ⭐⭐ THE TRILL IS THE SLUR'S FAMILY, NOT THE PEDAL'S
 *
 * A trill's anchors are **notes** (`startNoteId`, and an optional `endNoteId`), where a hairpin's,
 * an ottava's and a pedal's are positions in TIME. So the same chord that steps those three by a
 * SLOT steps this one by a NOTE, through `setTrillEnd` / `setTrillStart`. ⛔ Do not reach for
 * `resizePedalBySlot`'s shape here: a beat is not an address a trill can hold.
 *
 * ## ⭐⭐ …and it has a state none of the other four has: NO END AT ALL
 *
 * An absent `endNoteId` means *the start note's own sounding duration, through ties* — the ordinary
 * one-note trill, and a finished ornament rather than a degenerate span ({@link Trill.endNoteId}).
 * That gives the END square two edges instead of one:
 *
 *  - stepping the end BACK onto the start note **clears it**, restoring the one-note trill — ⛔ it
 *    does not refuse, and it does not leave an `endNoteId` equal to the start (the model normalises
 *    that away, so storing it would be a second spelling of the same thing);
 *  - stepping FORWARD from a trill that has no end starts from **where the line actually stops**
 *    (`trillSpan`, i.e. the end of the tie chain), not from the start note — otherwise the first
 *    press would appear to do nothing on a tied note, or worse, shorten the ornament.
 *
 * ⚠️ DECLINES — returns false, touching nothing — whenever the step is not available: no armed
 * square, the anchor is off the beat map, the walk runs off the end of the lane, or the step would
 * reach or cross the other end. ⭐ A destination the model would refuse is not a decline — it is
 * SKIPPED, and the walk offers the next note along. Declining is what leaves `Ctrl+Shift+←/→` free
 * for the note offset, so the caller must chain rather than repaint on a false.
 */
import type { MusicEngine } from '../engine/MusicEngine'
import type { Fraction, Trill } from '../types/music'
import type { EditorState } from './EditorState'
import { selectedOf } from './EditorState'
import { trillMayAnchorOn } from '../engine/models/trillOps'
import { trillLane } from './trillLane'
import type { FlatNote } from '../utils/beatMap'
import { fracCompare, fracEq } from '../utils/fraction'
import { dbg } from '../utils/debug'

/** What resolving a step needs off the engine — a Pick, so a spec can stand it up without a
 *  renderer. */
export type TrillAnchorEngine = Pick<MusicEngine,
  'getScore' | 'getElementRegistry' | 'getTrillById' | 'getNote' | 'trillSpan'>

/** One step of the walk: the note the armed end lands on, and how the model is told. */
export interface TrillAnchorStop {
  /** The destination — a beat-map representative, so a chord answers with its lowest note. */
  note: FlatNote
  /**
   * ⭐⭐ The step lands the END back on the START: the write CLEARS `endNoteId` rather than setting
   * it, which is the one-note trill. ⛔ Not a refusal, and ⛔ not an `endNoteId` equal to the start —
   * the model normalises that away, so storing it would be a second spelling of the same thing.
   */
  clearsEnd?: true
}

/**
 * ⭐ **WHERE THE ARMED END STANDS NOW** — the position its ink hangs off, which for the END square
 * is not always a stored id: with no `endNoteId` the line stops at the end of the tie chain, and
 * that is what both the jump and the walk must measure from. `trillSpan` is the one thing that
 * knows, and it is derived every render anyway.
 */
export function trillAnchorPosition(
  engine: TrillAnchorEngine,
  trill: Trill,
  which: 'start' | 'end',
): { measure: number; beat: Fraction } | null {
  const start = engine.getNote(trill.startNoteId)
  if (!start) return null
  if (which === 'start') return { measure: start.measure, beat: start.beat }
  const end = trill.endNoteId ? engine.getNote(trill.endNoteId) : null
  if (end) return { measure: end.measure, beat: end.beat }
  const span = engine.trillSpan(trill.id)
  return span ? { measure: span.endMeasure, beat: span.endBeat } : null
}

/**
 * ⭐⭐ **THE CANDIDATE RULE, ONCE** — the note one step earlier (`direction` -1) or later (+1) than
 * `which` end's own, with this family's two clamps applied. Null when there is no step: an anchor
 * that is off the beat map, the end of the lane, or a step that would pass the other end.
 *
 * ⭐ It takes the trill and the end EXPLICITLY rather than reading the selection, because three
 * callers need it and only one of them is a key press: the keyboard walk, the mouse DRAG and this
 * file's own jump all have to land on the same notes.
 *
 * 🚨 **It DOES consult the model's refusals — a note the op would say no to is not a stop but a DEAD
 * KEY** (`trillOps.trillMayAnchorOn`, and his report of 2026-08-20 below). The op remains the
 * authority; asking first is what lets the walk step PAST a rest, a fanned member or another trill's
 * notehead instead of jamming against it.
 */
export function nextTrillAnchorStop(
  engine: TrillAnchorEngine,
  id: string,
  which: 'start' | 'end',
  direction: 1 | -1,
): TrillAnchorStop | null {
  const trill = engine.getTrillById(id)
  if (!trill) return null
  const start = engine.getNote(trill.startNoteId)
  if (!start) return null
  const anchor = trillAnchorPosition(engine, trill, which)
  if (!anchor) return null

  // The START note's OWN lane, with no voice fallback — `reanchorArmedSlurEndpoint`'s rule and its
  // reason: a trill that silently jumped voices would be a wrong trill, not a recovered one. ⭐ The
  // lane comes from the START rather than from the armed end, because `Trill.voice` says both
  // anchors share one and the start is the anchor that always exists.
  //
  // 🚨 **A NOTE THE MODEL WOULD REFUSE IS NOT A STOP** — a rest, a fanned member, and (for the START)
  // a note that already carries another trill. Offering one and letting the op say no leaves the key
  // JAMMED against it for ever; dropping it walks the ornament PAST it, which is what the eye expects
  // (his report, 2026-08-20 — see `trillOps.trillMayAnchorOn`).
  //
  // ⭐⭐ **A REST IS STILL NOT AN ANCHOR** — ⛔ and carrying the line over empty bars is not this
  // key's job: that is the INK's, and his rule for it is `./trillWalk`'s system FOLD.
  const stops = trillLane(engine, start)
    .filter(n => !n.isRest && trillMayAnchorOn(engine.getScore(), id, which, n.id))

  const from = stops.findIndex(n => at(n, anchor.measure, anchor.beat))
  if (from === -1) return null

  const dest = stops[from + direction]
  if (!dest) return null // off the end of the lane

  // 🚨🚨 **THE CLAMPS COMPARE POSITIONS, ⛔ NEVER INDEXES IN `stops`.** His report, 2026-08-20: a
  // dragged start refused on every single frame — *"the start would pass the end"*, a hundred times.
  // The far end was a note that carried ANOTHER trill, so the filter above had dropped it from
  // `stops`; `findIndex` answered −1, the guard read that as *"there is no end to cross"* and offered
  // a note far beyond it, which the model then refused for ever. ⭐ A clamp about WHERE THE OTHER END
  // IS must ask where it is, not where it sits in a list that may not contain it.
  if (which === 'end') {
    // ⭐⭐ Reaching the START clears the end — the one-note trill, not a refusal. Compared by
    // POSITION for the chord reason above.
    if (at(dest, start.measure, start.beat)) return { note: dest, clearsEnd: true }
    // …and it may never pass the start.
    if (isBefore(dest, start.measure, start.beat)) return null
  } else {
    // ⭐⭐ The start may never PASS an explicit end — but reaching it is allowed, and collapses the
    // trill onto that note (`setTrillStart`, the mirror of the end's clear above). 🚨 PAST, not AT:
    // a trill whose end is the very next note must still be able to move right, which is exactly
    // what he found. Without an explicit end there is nothing to cross — it is the start's own tie
    // chain and travels with it.
    const end = trill.endNoteId ? engine.getNote(trill.endNoteId) : null
    if (end && !isBefore(dest, end.measure, end.beat) && !at(dest, end.measure, end.beat)) return null
  }
  return { note: dest }
}

/**
 * The model write one {@link TrillAnchorStop} asks for, shared by the jump and the walk so the two
 * keys cannot disagree about what "step onto that note" means.
 *
 * ⚠️ The MODEL may still refuse — a fanned member is on the beat map and is not trillable, and
 * another trill may already own that notehead. The op is the authority; a caller repaints on a yes.
 */
export function applyTrillAnchorStop(
  engine: Pick<MusicEngine, 'setTrillAnchor'>,
  id: string,
  which: 'start' | 'end',
  stop: TrillAnchorStop,
): boolean {
  return engine.setTrillAnchor(id, which, stop.clearsEnd ? null : stop.note.id)
}

/** ⚠️ Located by POSITION, not by id: a chord's representative in the beat map is its LOWEST note,
 *  so an anchor on any other member would not be found by id at all. */
function at(n: FlatNote, measure: number, beat: Fraction): boolean {
  return n.measureNumber === measure && fracEq(n.beat, beat)
}

/** Is `n` strictly EARLIER in the score than (measure, beat)? — the clamps' comparison, ⛔ not an
 *  index into a list that a filter may have thinned. */
function isBefore(n: FlatNote, measure: number, beat: Fraction): boolean {
  return n.measureNumber !== measure ? n.measureNumber < measure : fracCompare(n.beat, beat) < 0
}

/**
 * Move the armed trill square one note earlier (`direction` -1) or later (+1) in its own lane.
 *
 * @returns true if the trill re-anchored (the caller then re-renders).
 */
export function reanchorArmedTrillEndpoint(
  state: EditorState,
  engine: MusicEngine,
  direction: 1 | -1,
): boolean {
  const selected = selectedOf(state, 'trill')
  if (!selected?.endpoint) return false
  const trill = engine.getTrillById(selected.id)
  if (!trill) return false
  const which = selected.endpoint

  // ⭐⭐ **ONE STEP PAST THE COLLAPSE IS THE BARE `tr`** — his ask, 2026-08-18: *"there are cases
  // where the user wants to have `tr` without the line … if I'm re-anchoring the last endpoint I can
  // go more to the left than the default so we don't show the line and just the `tr`"*.
  //
  // ⭐ It fills a step that was DEAD: from a collapsed one-note trill, `←` used to decline, because
  // there was no end left to walk and the start is the floor. The walk now reads, leftward:
  // *end on a later note → … → end on the start (the end CLEARS) → no line at all*, and `→` from
  // there puts the line back on the same note. Reversible, on one axis, with no new gesture.
  //
  // ⚠️ It is taken BEFORE the lane is consulted, because neither step needs a destination note —
  // and the leftward one is reachable exactly when there is nothing further left to reach.
  //
  // ⚠️⚠️ **This is the one place `Ctrl+Shift+arrow` writes something COSMETIC.** The chord otherwise
  // means "move this end through the music" and a plain arrow means "move the ink". It is defensible
  // only because at this end of the walk the trill covers ONE note and there is no musical extent
  // left to change — see docs/trill-plan.md. ⛔ Do not generalise it to the other spans, and ⛔ note
  // that the INTERPOLATING walk (`./trillWalk`) deliberately does NOT reach it: there is no gap to
  // measure to a state, so the ink has nothing to arrive at.
  if (which === 'end') {
    if (direction === 1 && trill.extension === 'none') {
      if (!engine.setTrillExtension(selected.id, undefined)) return false
      dbg(`Trill line restored (keyboard) | id:${selected.id}`)
      return true
    }
    if (direction === -1 && trill.extension !== 'none' && trill.endNoteId === undefined) {
      if (!engine.setTrillExtension(selected.id, 'none')) return false
      dbg(`Trill line off (keyboard) | id:${selected.id} → a bare tr`)
      return true
    }
  }

  const stop = nextTrillAnchorStop(engine, selected.id, which, direction)
  if (!stop) return false
  if (!applyTrillAnchorStop(engine, selected.id, which, stop)) return false
  if (stop.clearsEnd) dbg(`Trill end cleared (keyboard) | id:${selected.id} → the one-note trill`)
  else dbg(`Trill re-anchored (keyboard) | id:${selected.id} end:${which} → m${stop.note.measureNumber} beat:${stop.note.beat.num}/${stop.note.beat.den}`)
  return true
}
