/**
 * ⭐ **A SELECTED TRILL'S TWO ENDPOINT HANDLES** — one beyond the `tr`, one beyond the end of its
 * wavy line, and how a press or Tab picks one. His ask, 2026-08-18: *"lets do the trill, we need the
 * two square endpoints"* — the fifth span to get the pair, after the slur, the wedge, the bracket
 * and the pedal.
 *
 * ⭐ **`./pedalHandles`' twin in shape** — the same two squares in the same blue at the same size,
 * the same walk, the same registry-is-the-list rule. Five span families with five different-looking
 * answers to "where is my end" would be five things for the hand to learn.
 *
 * ⚠️ **They ARM, and nothing more — yet.** A press or Tab writes `endpoint` into the selection and
 * the square reads as picked; no key or drag acts on it. That is every one of the four before it.
 *
 * ## ⭐⭐ What is different here, and it is about what the squares will MEAN
 *
 * A trill's two anchors are **NOTES** — `startNoteId` and an optional `endNoteId` — where a
 * hairpin's, an ottava's and a pedal's are positions in TIME. So when these squares gain an edit it
 * is the SLUR's (`reanchorArmedSlurEndpoint`, one note at a time, through `setTrillEnd`), ⛔ never
 * the pedal's beat-and-length arithmetic. ⭐ And clearing the end is a real state rather than a
 * degenerate one: `endNoteId` absent means *the start note's own sounding duration, through ties*,
 * which is the ordinary one-note trill.
 *
 * ⭐ **The geometry needs no measured axis field, unlike the bracket's.** `ottavaAxis` exists because
 * an ottava's `points` are the numeral's ink box while its line rides that box's top or foot. A
 * trill's `tr` and its wiggle are drawn on ONE baseline and registered as one band per fragment, so
 * both squares sit on that band's middle and there is nothing to re-derive — `pedalHandles`' case.
 */
import type { ElementInfo, ElementRegistry } from '../../engine/ElementRegistry'
import type { EditorState } from '../EditorState'
import { selectedOf } from '../EditorState'
import { dbg } from '../../utils/debug'

/** Which end a drag is holding, and the note it wants. ⭐ A NOTE, not an address in time — the
 *  trill's anchors are notes, so this is what `setTrillEnd` / `setTrillStart` already take. */
export interface TrillDragWrite {
  at: 'start' | 'end'
  noteId: string
  /** ⭐ The END square dragged LEFT PAST the start: the bare `tr`, no wavy line — the mouse twin of
   *  the keyboard's step past the collapse ({@link Trill.extension}). ⛔ Never set for the start
   *  square: a trill without a sign is not a trill. */
  lineOff?: true
}

/** One drawn handle: a point, and which end of the trill it is. */
export interface TrillHandle {
  which: 'start' | 'end'
  x: number
  y: number
}

/**
 * ⭐ **THE AIR — how far outside the ornament each square sits**, in px.
 *
 * The requirement that arrived with the handles themselves on the ottava (*"we need air … for
 * avoiding collision"*): the start square steps LEFT of the `tr` and the end square RIGHT of the
 * last wiggle, so both step outward along the span and neither is over ink.
 *
 * ⚠️ Its own constant rather than an import of a neighbour's, so the family can be tuned apart. It
 * STARTS at their 10 — the square's half-side, 6, plus a few px — a value his eye has passed three
 * times now.
 *
 * ⚠️ PIXELS, like every other handle in the editor: the squares are drawn on the highlight layer at
 * a constant on-screen size, so one stays the same size to the hand at every zoom.
 */
export const TRILL_HANDLE_GAP_PX = 10

/**
 * The two endpoint handles of `trillId`, from what the last render DREW (the registry is the list —
 * every handle family in the editor follows that rule). Returns an empty array when the ornament is
 * not on screen.
 *
 * ⚠️ **The two ends come from DIFFERENT entries on a split trill**, which is why this is a function
 * rather than two array indexes: `TrillRenderer` registers ONE ENTRY PER FRAGMENT, so a trill cut
 * across a system break has its `tr` in one system's coordinates and its line's end in another's,
 * and reading both off one entry draws the second square in the wrong system. The ottava, the
 * hairpin and `slurHandleCycle` all name the same trap.
 */
export function trillEndpointHandles(
  entries: readonly ElementInfo[],
  trillId: string,
): TrillHandle[] {
  const pieces = entries.filter(el => el.id === trillId)
  if (!pieces.length) return []
  // Registration order IS drawing order, left to right through the systems — so the first piece
  // holds the sign and the last holds the end of the line (one piece holds both).
  const first = pieces[0].bbox
  const last = pieces[pieces.length - 1].bbox
  return [
    { which: 'start', x: first.x - TRILL_HANDLE_GAP_PX, y: first.y + first.height / 2 },
    { which: 'end', x: last.x + last.width + TRILL_HANDLE_GAP_PX, y: last.y + last.height / 2 },
  ]
}

/**
 * ⭐ **A PRESS ON A SQUARE ARMS THAT END** — run as a PRE-STEP in `MouseController`, before the
 * selection is cleared and before the hit chain, exactly where the other four handle presses run.
 *
 * ⚠️ **Before the chain, not a row in it.** A trill sits on the outside-staff ladder with the tempo
 * mark and the octave bracket around it, and both of those run AHEAD of `TRILL_ELEMENT` in
 * {@link ELEMENT_HIT_ORDER} — a square beyond the wiggle's end can land inside either's box. A
 * handle you can SEE has to win the press over whatever it happens to overlap, and no ordering of
 * the marks themselves could promise that.
 *
 * The squares are only in the registry while their trill is selected (the highlight pass puts them
 * there), so no "is this trill selected" guard is needed — nothing else can be hit.
 *
 * @returns true if a square consumed the press (the caller then re-renders and stops).
 */
export function armTrillEndpointAt(
  state: EditorState,
  registry: ElementRegistry,
  x: number,
  y: number,
): boolean {
  const hit = registry.getByType('trill-endpoint').find(el => {
    const b = el.bbox
    return x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height
  })
  if (!hit?.trillId || !hit.endpoint) return false
  // ⚠️ Reassigned whole — the observable Proxy traps the SET, so mutating `.endpoint` in place would
  // change the value and tell nobody.
  state.selectedElement = { kind: 'trill', id: hit.trillId, endpoint: hit.endpoint }
  dbg(`✓ Trill endpoint armed | id:${hit.trillId} end:${hit.endpoint}`)
  return true
}

/*
 * ⛔ **`trillDragTargetAt` LIVED HERE, and it is gone (2026-08-20).** It answered *which note is the
 * cursor nearest*, per end, and the drag re-anchored to it outright — so the ink teleported a whole
 * note at a time and an end could never be parked between two.
 *
 * ⭐ A square drag now runs the very ports the arrow keys do
 * (`interactions/trillWalk.dragTrillEndpoint`): the ink follows the hand and the anchor comes along
 * when the ink reaches a note. Nothing here has to know where a note is drawn any more — that
 * geometry is `interactions/trillLane`'s, shared by both devices, which is the point.
 *
 * ⚠️ The cursor's y is not translated anywhere now either: a walk reads a horizontal DELTA, so the
 * *"the drag's cursor rides the mark's line"* rule ({@link signToMusicOffset}, deleted with it) has
 * nothing left to answer for on this family.
 */

/**
 * ⭐ **TAB WALKS THE TWO SQUARES** — `+1` Tab, `−1` Shift+Tab — the keyboard route to the same
 * selection, and the trill's share of what the other four walks do.
 *
 * The REGISTRY IS THE LIST: the walk visits what the last render actually DREW, so an ornament whose
 * squares are not on screen has none to visit and Tab stays the browser's. With none armed, Tab
 * takes the FIRST and Shift+Tab the LAST, so either key is a way in; the walk WRAPS.
 *
 * ⚠️ DECLINES (false) when no trill is selected or its squares are not drawn — the caller chains
 * rather than repaints on a false.
 */
export function cycleTrillEndpoint(
  state: EditorState,
  registry: ElementRegistry,
  step: 1 | -1,
): boolean {
  const selected = selectedOf(state, 'trill')
  if (!selected) return false
  const order = trillEndpointHandles(registry.getByType('trill'), selected.id)
  if (!order.length) return false

  const at = order.findIndex(h => h.which === selected.endpoint)
  const next = at === -1
    ? (step === 1 ? 0 : order.length - 1)
    : (at + step + order.length) % order.length
  state.selectedElement = { kind: 'trill', id: selected.id, endpoint: order[next].which }
  return true
}
