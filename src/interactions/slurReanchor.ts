/**
 * ⭐ **RE-ANCHOR AN ARMED SLUR ENDPOINT FROM THE KEYBOARD** — Ctrl+Shift+←/→ walks the armed end
 * off its note and onto the previous/next one, the keyboard twin of dragging the blue square.
 *
 * A module of its own rather than a branch in `shortcutWiring`, per CLAUDE.md's rule: the walk is
 * logic (a lane-scoped beat map, a chord-tolerant lookup by POSITION, two clamps), not the
 * one-line "read the selection, call the engine" glue the wiring file holds for everything else.
 *
 * ## Why Ctrl+Shift+←/→
 *
 * Ctrl+←/→ already nudges *this same point* by a coarse pixel step (`nudgeArmedSlurPoint`), so
 * adding Shift keeps the axis and means "stop nudging, move the anchor" — the largest step on the
 * horizontal, above the ¼-space plain arrows and the 1-space Ctrl pair. The chord's other tenant is
 * the wide note OFFSET, and the two can never both fire: an armed endpoint lives in
 * `selectedElement` and selecting it CLEARS `selectedItems` ("selecting IS clearing"), which the
 * offset branch requires exactly one note in. Same disjoint-branch arrangement Ctrl+←/→ already runs
 * with six tenants.
 *
 * ## What it is NOT
 *
 * ⛔ It does not reproduce the drag. The drag snaps to the nearest NOTEHEAD, so it can land on an
 * inner note of a chord; this walks (measure, beat) stops in one lane, so a chord is one stop and
 * picking a specific member stays a mouse job. That is the same collapse the selection arrows make
 * (`collapseToBeats`), and for the same reason — one press should move one position in time.
 */
import type { MusicEngine } from '../engine/MusicEngine'
import type { EditorState } from './EditorState'
import { selectedOf } from './EditorState'
import { buildBeatMap, type FlatNote } from '../utils/beatMap'
import { fracEq } from '../utils/fraction'
import { staffOf, voiceOf } from '../utils/lanes'
import { dbg } from '../utils/debug'

/**
 * Move the armed slur endpoint one note earlier (`direction` -1) or later (+1) in its own lane.
 *
 * ⚠️ DECLINES — returns false, touching nothing — whenever {@link nextSlurAnchorStop} has no step to
 * offer (see there for the four reasons). Declining is what leaves Ctrl+Shift+←/→ free for the note
 * offset, so the caller must chain rather than repaint on a false.
 *
 * @returns true if the slur re-anchored (the caller then re-renders).
 */
export function reanchorArmedSlurEndpoint(
  state: EditorState,
  engine: MusicEngine,
  direction: 1 | -1,
): boolean {
  const selected = selectedOf(state, 'slur')
  const dest = nextSlurAnchorStop(state, engine, direction)
  if (!selected?.endpoint || !dest) return false

  // The drag's own pair: `preview…` takes the change (and flags the model dirty), `commit…` records
  // exactly one undo entry for it. A press is a whole gesture, so the two run back to back here.
  if (!engine.previewSlurEndpoint(selected.id, selected.endpoint, dest.id)) return false
  engine.commitSlurEndpoint()
  dbg(`Slur re-anchored (keyboard) | id:${selected.id} end:${selected.endpoint} → m${dest.measureNumber} beat:${dest.beat.num}/${dest.beat.den}`)
  return true
}

/** What the candidate lookup needs off the engine — a Pick, so a spec can stand up the three reads
 *  without a renderer (and so the INTERPOLATING walk can pass the same narrow object). */
export type AnchorWalkEngine = Pick<MusicEngine, 'getSlurById' | 'getNote' | 'getScore'>

/**
 * ⭐ **The note one step away from the armed endpoint** — the stop this end would take if it moved
 * `direction` (+1 later, −1 earlier) in its own lane, or null when there is none to take.
 *
 * Shared by the two walks that can move an anchor, deliberately: the Ctrl+Shift+←/→ jump above, and
 * the horizontal nudge that carries the anchor along once its ink arrives (`./slurEndpointWalk`).
 * They differ in WHEN they take the step, never in WHICH note it is — two candidate rules would mean
 * the same key landing on a different note depending on how far you had nudged first.
 *
 * ⚠️ Returns null — touching nothing — for every reason the step is unavailable: no armed TRUE
 * endpoint (an armed open join, the orange square, has no note to anchor to at all), the anchor is
 * off the beat map, the walk runs off the end of the lane, or the step would reach or cross the
 * slur's other end.
 */
export function nextSlurAnchorStop(
  state: EditorState,
  engine: AnchorWalkEngine,
  direction: 1 | -1,
): FlatNote | null {
  const selected = selectedOf(state, 'slur')
  if (!selected?.endpoint) return null
  const slur = engine.getSlurById(selected.id)
  if (!slur) return null

  const which = selected.endpoint
  const anchorId = which === 'start' ? slur.startNoteId : slur.endNoteId
  const otherId = which === 'start' ? slur.endNoteId : slur.startNoteId
  const anchor = engine.getNote(anchorId)
  if (!anchor) return null

  // The anchor's OWN lane, with no voice fallback: `buildVoiceNavBeatMap`'s per-measure drop to
  // voice 0 exists so arrow navigation never loses the selection in a bar that lacks the voice, and
  // there is no selection to lose here — a slur that silently jumped voices would be a wrong slur,
  // not a recovered one. Rests are dropped: a phrase mark ends on a note, and a rest under a slur is
  // something to span, not to land on.
  const stops = buildBeatMap(engine.getScore(), voiceOf(anchor), staffOf(anchor))
    .beats.filter(n => !n.isRest)

  // ⚠️ Located by POSITION, not by id: a chord's representative in the beat map is its LOWEST note,
  // so an endpoint anchored on any other member of the chord would not be found by id at all.
  const at = (n: FlatNote, m: number, beat: FlatNote['beat']) => n.measureNumber === m && fracEq(n.beat, beat)
  const from = stops.findIndex(n => at(n, anchor.measure, anchor.beat))
  if (from === -1) return null

  const dest = stops[from + direction]
  if (!dest) return null // off the end of the lane

  // Clamp at the other end: an endpoint may never reach or pass its partner (the drag says the same
  // thing by excluding that note from its snap). Located by position again, for the chord reason
  // above; a partner in another lane simply is not on this map, and then there is nothing to clamp.
  const other = engine.getNote(otherId)
  const stop = other ? stops.findIndex(n => at(n, other.measure, other.beat)) : -1
  if (stop !== -1) {
    const destIndex = from + direction
    if (which === 'start' ? destIndex >= stop : destIndex <= stop) return null
  }

  return dest
}
