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
import type { MusicEngine } from '../../engine/MusicEngine'
import type { EditorState } from '../EditorState'
import { selectedOf } from '../EditorState'
import { staffOf, voiceOf } from '../../utils/lanes'
import { dbg } from '../../utils/debug'

/** What finding a drag target needs off the engine — a Pick, so a test can stand one up without a
 *  renderer. */
type DragEngine = Pick<MusicEngine, 'getTrillById' | 'getElementRegistry' | 'getNote'>

/** Which end a drag is holding, and the note it wants. ⭐ A NOTE, not an address in time — the
 *  trill's anchors are notes, so this is what `setTrillEnd` / `setTrillStart` already take. */
export interface TrillDragWrite {
  at: 'start' | 'end'
  noteId: string
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

/**
 * ⭐⭐ **WHICH NOTE A DRAGGED SQUARE IS OVER** — the mouse twin of `Ctrl+Shift+←/→`, and what a trill
 * drag has to decide (his ask, 2026-08-18).
 *
 * ⭐ **It answers with a NOTE**, where the pedal's and the bracket's drags answer with an address in
 * time. That is the family difference all the way down: the model takes note ids, so the drag hands
 * one over and lets `setTrillStart` / `setTrillEnd` judge it.
 *
 * ⭐⭐ **THE TWO ENDS MEASURE AGAINST DIFFERENT X'S, and it is the drawing that says so.**
 * `TrillRenderer.spanX` puts the sign on the start note's LEFT EDGE and stops the wavy line at the
 * left edge of the **first note AFTER** the trill — the third end rule, the end of a DURATION rather
 * than a notehead (docs/pedal-plan.md names all three). So:
 *
 *  - the START square is nearest the note it is ON;
 *  - the END square is nearest the note AFTER the one it ends on — and for the last note of the lane
 *    there is none, so its own right edge stands in for the bar's end, which is where the renderer
 *    falls back to as well.
 *
 * Measuring the end against its own notehead would leave the square a whole note's width behind the
 * cursor — the hairpin's recorded *"it jumps before x mouse reach the target"*, and this family
 * reaches it by the same route the wedge did (a tip drawn at the first UNCOVERED note).
 *
 * ⭐ **The cursor's y is TRANSLATED first**, `pedalDragTargetAt`'s rule: the hand rides the
 * ornament's own line, several spaces off the music, so the raw y can be nearer a neighbouring
 * system. ⚠️ And the offset is SIGNED here — a trill sits above the staff or below it
 * (`Trill.placement`, flipped by `x`), so the note it was drawn over is on the opposite side of the
 * square each time.
 *
 * ⛔ It does not police the span: reaching the other end COLLAPSES the trill, and passing it is
 * refused — both by the model, which is the authority (see `trillReanchor`).
 *
 * @returns the write the drop should apply, or null when the cursor is on no system's music.
 */
export function trillDragTargetAt(
  engine: DragEngine,
  trillId: string,
  which: 'start' | 'end',
  x: number,
  y: number,
): TrillDragWrite | null {
  const trill = engine.getTrillById(trillId)
  const start = trill ? engine.getNote(trill.startNoteId) : null
  if (!trill || !start) return null

  // The START note's own lane — `reanchorArmedTrillEndpoint`'s rule, so the mouse and the keys can
  // reach exactly the same notes. ⛔ Rests are not candidates: a trill attaches to a note.
  const lane: Array<{ id: string; left: number; right: number; y: number }> = []
  const registry = engine.getElementRegistry()
  for (const el of registry.getByType('note')) {
    if (!el.id) continue
    const note = engine.getNote(el.id)
    if (!note || note.isRest) continue
    if (voiceOf(note) !== voiceOf(start) || staffOf(note) !== staffOf(start)) continue
    const seen = lane.find(n => n.left === el.bbox.x && n.y === el.bbox.y + el.bbox.height / 2)
    if (seen) continue
    lane.push({
      id: el.id,
      left: el.bbox.x,
      right: el.bbox.x + el.bbox.width,
      y: el.bbox.y + el.bbox.height / 2,
    })
  }
  if (!lane.length) return null
  lane.sort((a, b) => a.left - b.left)

  const inMusic = y - signToMusicOffset(registry, trillId, which, trill.placement ?? 'above', lane)

  // ⭐ The candidate x per note: where THIS square would be drawn if that note were its anchor.
  const candidates = lane.map((n, i) => ({
    x: which === 'start' ? n.left : (lane[i + 1]?.left ?? n.right),
    y: n.y,
    noteId: n.id,
  }))

  // ⭐ The y picks the SYSTEM, the x picks the note — `pedalDragTargetAt`'s split, and for its
  // reason: one hypotenuse over both axes lets a pitch difference inside a row outvote the x.
  const row = candidates.filter(c => Math.abs(inMusic - c.y) <= TRILL_DRAG_ROW_PX)
  if (!row.length) return null

  let best: string | null = null
  let bestDistance = TRILL_DRAG_SNAP_PX
  for (const c of row) {
    const d = Math.abs(x - c.x)
    if (d < bestDistance) { bestDistance = d; best = c.noteId }
  }
  return best ? { at: which, noteId: best } : null
}

/**
 * ⭐⭐ **How far off the music this ornament is drawn, MEASURED from the last render** — the number
 * {@link trillDragTargetAt} subtracts from the cursor's y, so the hand can ride the `tr`'s own line
 * instead of hunting for the noteheads.
 *
 * ⚠️ **SIGNED by the trill's side**, the bracket's rule rather than the pedal's: an ornament ABOVE
 * the staff was drawn over music BELOW its square, and a `below` trill is the mirror. Looking the
 * wrong way finds the neighbouring system's music and reports a gap of nothing.
 *
 * Returns 0 when the ornament is not on screen or nothing lies on the expected side — the honest
 * "I don't know", which leaves the raw cursor y in play rather than inventing a shift.
 */
function signToMusicOffset(
  registry: ElementRegistry,
  trillId: string,
  which: 'start' | 'end',
  side: 'above' | 'below',
  lane: ReadonlyArray<{ left: number; y: number }>,
): number {
  const anchor = trillEndpointHandles(registry.getByType('trill'), trillId)
    .find(h => h.which === which)
  if (!anchor) return 0
  const musicIsBelow = side === 'above'
  let found: { left: number; y: number } | null = null
  let nearest = Infinity
  for (const n of lane) {
    if (musicIsBelow ? n.y <= anchor.y : n.y >= anchor.y) continue
    const d = Math.hypot(anchor.x - n.left, anchor.y - n.y)
    if (d < nearest) { nearest = d; found = n }
  }
  return found ? anchor.y - found.y : 0
}

/** ⚠️ HORIZONTAL only, now that the row is chosen separately. The family's number. */
const TRILL_DRAG_SNAP_PX = 150

/** How far off a system's noteheads the translated cursor may be and still be READING that system.
 *  `PEDAL_DRAG_ROW_PX`'s twin — a tolerance, not a boundary. */
const TRILL_DRAG_ROW_PX = 80

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
