/**
 * ⭐ **RE-ANCHOR AN ARMED TRILL SQUARE FROM THE KEYBOARD** — `Ctrl+Shift+←/→` walks the armed end
 * off its note and onto the previous/next one (his ask, 2026-08-18).
 *
 * A module of its own rather than a branch in `shortcutWiring`, per CLAUDE.md's rule and
 * `./slurReanchor`'s precedent: the walk is logic — a lane-scoped beat map, a chord-tolerant lookup
 * by POSITION, and two clamps that are this family's own — not the one-line "read the selection,
 * call the engine" glue the wiring file holds.
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
 * square, the anchor is off the beat map, the walk runs off the end of the lane, the step would
 * reach or cross the other end, or the model refuses the destination (a rest, a fanned member, a
 * note that already trills). Declining is what leaves `Ctrl+Shift+←/→` free for the note offset, so
 * the caller must chain rather than repaint on a false.
 */
import type { MusicEngine } from '../engine/MusicEngine'
import type { EditorState } from './EditorState'
import { selectedOf } from './EditorState'
import { buildBeatMap, type FlatNote } from '../utils/beatMap'
import { fracEq } from '../utils/fraction'
import { staffOf, voiceOf } from '../utils/lanes'
import { dbg } from '../utils/debug'

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
  const start = engine.getNote(trill.startNoteId)
  if (!start) return false

  // ⭐ WHERE THIS END IS *NOW*, which for the end square is not always a stored id: with no
  // `endNoteId` the line stops at the end of the tie chain, and that is the note the walk must step
  // from. `trillSpan` is the one thing that knows, and it is derived every render anyway.
  const span = engine.trillSpan(selected.id)
  const anchor = which === 'start'
    ? start
    : (trill.endNoteId ? engine.getNote(trill.endNoteId) : null)
      ?? (span ? { measure: span.endMeasure, beat: span.endBeat } : null)
  if (!anchor) return false

  // The START note's OWN lane, with no voice fallback — `reanchorArmedSlurEndpoint`'s rule and its
  // reason: a trill that silently jumped voices would be a wrong trill, not a recovered one. ⭐ The
  // lane comes from the START rather than from the armed end, because `Trill.voice` says both
  // anchors share one and the start is the anchor that always exists. Rests are dropped: a trill
  // attaches to a note.
  const stops = buildBeatMap(engine.getScore(), voiceOf(start), staffOf(start))
    .beats.filter(n => !n.isRest)

  // ⚠️ Located by POSITION, not by id: a chord's representative in the beat map is its LOWEST note,
  // so an anchor on any other member would not be found by id at all.
  const at = (n: FlatNote, m: number, beat: FlatNote['beat']) => n.measureNumber === m && fracEq(n.beat, beat)
  const from = stops.findIndex(n => at(n, anchor.measure, anchor.beat))
  if (from === -1) return false

  const dest = stops[from + direction]
  if (!dest) return false // off the end of the lane

  if (which === 'end') {
    // ⭐⭐ Reaching the START clears the end — the one-note trill, not a refusal. Compared by
    // POSITION for the chord reason above.
    if (at(dest, start.measure, start.beat)) {
      if (!engine.setTrillAnchor(selected.id, 'end', null)) return false
      dbg(`Trill end cleared (keyboard) | id:${selected.id} → the one-note trill`)
      return true
    }
    // …and it may never pass the start.
    const startIndex = stops.findIndex(n => at(n, start.measure, start.beat))
    if (startIndex !== -1 && from + direction < startIndex) return false
  } else {
    // ⭐⭐ The start may never PASS an explicit end — but reaching it is allowed, and collapses the
    // trill onto that note (`setTrillStart`, the mirror of the end's clear above). 🚨 `>`, not `>=`:
    // with `>=` a trill whose end is the very next note could not move right AT ALL, which is
    // exactly what he found. Without an explicit end there is nothing to cross — it is the start's
    // own tie chain and travels with it.
    const end = trill.endNoteId ? engine.getNote(trill.endNoteId) : null
    const endIndex = end ? stops.findIndex(n => at(n, end.measure, end.beat)) : -1
    if (endIndex !== -1 && from + direction > endIndex) return false
  }

  // ⚠️ The MODEL may still refuse the destination — a fanned member is on the beat map and is not
  // trillable, and another trill may already own that notehead. The op is the authority; this only
  // repaints on a yes.
  if (!engine.setTrillAnchor(selected.id, which, dest.id)) return false
  dbg(`Trill re-anchored (keyboard) | id:${selected.id} end:${which} → m${dest.measureNumber} beat:${dest.beat.num}/${dest.beat.den}`)
  return true
}
