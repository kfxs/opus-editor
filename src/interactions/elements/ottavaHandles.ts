/**
 * ⭐ **A SELECTED OTTAVA'S TWO ENDPOINT HANDLES** — one beyond the beginning of the bracket, one
 * beyond its end, and how a press or Tab picks one. His ask, 2026-08-17: *"lets add two endpoint to
 * the ottava, in the beginning and in the end, and we need air (similar to hairpin) for avoiding
 * collision"*.
 *
 * ⭐ **`./hairpinHandles`' twin, deliberately down to the shape of the file**: the same two squares
 * in the same blue at the same size, the same walk order, the same registry-is-the-list rule, the
 * same split-across-a-system-break trap. Two span families with two different-looking answers to
 * "where is my end" would be two things for the hand to learn; one look and one gesture is the
 * whole reason this is a copy rather than a variation.
 *
 * ⚠️ **They ARM, and nothing more — yet.** A press or Tab writes `endpoint` into the selection and
 * the square reads as picked; no key or drag acts on it. That is the hairpin's own first step
 * (*"for the moment we don't do anything with the endpoints, let's just draw them"*), and it is
 * where an octave line's edits will hang when they arrive — its extent is MUSICAL, the wedge's
 * category, so they will write `beat`/`length` on the model rather than an offset.
 *
 * ## The arithmetic
 *
 * `OttavaRenderer` registers ONE ENTRY PER FRAGMENT under the ottava's id, each carrying
 * `ottavaAxis` — the y its dashed line runs at on that system, and the x's of its ink at either
 * end. So the beginning handle is the FIRST fragment's `startX` and the end handle is the LAST
 * fragment's `endX`, each on that fragment's own line.
 *
 * ⚠️ **The two ends come from DIFFERENT entries on a broken bracket**, which is why this is a
 * function rather than two array indexes: a line cut across a system break has its beginning in one
 * system's coordinates and its end in another's, and reading both off one entry draws the second
 * square in the wrong system. The hairpin names the same trap, as does `slurHandleCycle`.
 *
 * ⛔ **The axis is measured by the RENDERER, never re-derived here.** The band's midpoint is not the
 * line: the bracket closes toward the staff, so the horizontal rides the numeral's top under an 8va
 * and its foot under an 8vb ({@link OTTAVA_LINE_RAISE_ABOVE}). Recomputing that in this layer would
 * be render arithmetic in the interaction layer, and it would be wrong on one side of the staff
 * only — the hardest kind of wrong to see.
 */
import type { ElementInfo, ElementRegistry } from '../../engine/ElementRegistry'
import type { EditorState } from '../EditorState'
import { selectedOf } from '../EditorState'
import { dbg } from '../../utils/debug'

/** One drawn handle: a point, and which end of the bracket it is. */
export interface OttavaHandle {
  which: 'start' | 'end'
  x: number
  y: number
}

/**
 * ⭐ **THE AIR — how far outside the bracket each square sits**, in px.
 *
 * His requirement in the same breath as the handles themselves (*"we need air … for avoiding
 * collision"*), and the hairpin's `HAIRPIN_HANDLE_GAP_PX` answering it: the beginning steps LEFT of
 * the numeral and the end steps RIGHT of the hook, so both step OUTWARD along the span and the
 * mark's own shape — the thing being selected — is never under a square.
 *
 * ⭐ Here the collision it avoids is more concrete than the wedge's. A square centred on the
 * bracket's end would sit ON the closing hook, which is the one stroke that tells the reader which
 * way the displacement goes; at the beginning it would sit on the `8va` itself. Both are the
 * statement, and a handle covering the statement makes you move the handle to read the music.
 *
 * ⚠️ The number is its own constant rather than an import of the hairpin's, so the two can be tuned
 * apart — the bracket's ink ends in a thin hook where the wedge's ends in a point, and they may not
 * want the same daylight. It STARTS at the wedge's 10 (the square's half-side, 6, plus a few px)
 * because that is a value his eye has already passed.
 *
 * ⚠️ PIXELS, like every other handle in the editor: the squares are drawn on the highlight layer at
 * a constant on-screen size, so one stays the same size to the hand at every zoom.
 *
 * 🚨 **The PAGE LIMIT reserves room for this** — `engine/layout/pageBounds.SPAN_HANDLE_ROOM_PX`, 16
 * px: this daylight plus the square's own half-side. ⛔ It cannot import the number (the engine may
 * not read `interactions/`), so raising this one means raising that one, or an end nudged to the
 * sheet's edge puts its square off the paper where no click can reach it (his report, 2026-08-21).
 */
export const OTTAVA_HANDLE_GAP_PX = 10

/**
 * The two endpoint handles of `ottavaId`, from what the last render DREW (the registry is the
 * list — every handle family in the editor follows that rule). Returns an empty array when the
 * bracket is not on screen, and drops a fragment whose axis is missing rather than guessing.
 */
export function ottavaEndpointHandles(
  entries: readonly ElementInfo[],
  ottavaId: string,
): OttavaHandle[] {
  const pieces = entries.filter(el => el.id === ottavaId && el.ottavaAxis)
  if (!pieces.length) return []
  // Registration order IS drawing order, which is left to right through the systems — so the first
  // piece holds the beginning and the last holds the end (one piece holds both).
  const first = pieces[0].ottavaAxis!
  const last = pieces[pieces.length - 1].ottavaAxis!
  return [
    { which: 'start', x: first.startX - OTTAVA_HANDLE_GAP_PX, y: first.y },
    { which: 'end', x: last.endX + OTTAVA_HANDLE_GAP_PX, y: last.y },
  ]
}

/**
 * ⭐ **A PRESS ON A SQUARE ARMS THAT END** — run as a PRE-STEP in `MouseController`, before the
 * selection is cleared and before the hit chain, exactly where the hairpin's and the slur's handle
 * presses run.
 *
 * ⚠️ **Before the chain, not a row in it.** The bracket sits on the outside-staff ladder directly
 * above whatever it clears, so a square beyond its end can land inside a trill's or a tempo mark's
 * box — and both of those sit AHEAD of `OTTAVA_ELEMENT` in {@link ELEMENT_HIT_ORDER}. A handle you
 * can SEE has to win the press over whatever it happens to overlap, and no ordering of the marks
 * themselves could promise that.
 *
 * The squares are only in the registry while their ottava is selected (the highlight pass puts them
 * there), so no "is this ottava selected" guard is needed — nothing else can be hit.
 *
 * @returns true if a square consumed the press (the caller then re-renders and stops).
 */
export function armOttavaEndpointAt(
  state: EditorState,
  registry: ElementRegistry,
  x: number,
  y: number,
): boolean {
  const hit = registry.getByType('ottava-endpoint').find(el => {
    const b = el.bbox
    return x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height
  })
  if (!hit?.ottavaId || !hit.endpoint) return false
  // ⚠️ Reassigned whole — the observable Proxy traps the SET, so mutating `.endpoint` in place would
  // change the value and tell nobody.
  state.selectedElement = { kind: 'ottava', id: hit.ottavaId, endpoint: hit.endpoint }
  dbg(`✓ Ottava endpoint armed | id:${hit.ottavaId} end:${hit.endpoint}`)
  return true
}

/**
 * ⛔ **THE SNAP IS GONE, 2026-08-21** — `ottavaDragTargetAt` used to answer *"which onset is the
 * cursor over"* and the drag wrote it outright, so the bracket jumped a whole note at a time. The
 * drag now WALKS (`../ottavaWalk.dragOttavaEndpoint`): the ink follows the hand and the bracket comes
 * along when the ink reaches an onset, which is the same journey the arrows make. The lane it used to
 * scan is `../ottavaLane`, and the wedge's own snap was deleted for this reason a day earlier.
 *
 * ⚠️ Its y-translation went with it — the drag reads no `y` at all now, because the SYSTEM is decided
 * by the wrap rather than by which row the hand is nearest. The rule it embodied (*a drag's cursor
 * rides the mark's line, nowhere near the noteheads it addresses*) is still live for the PEDAL, which
 * still snaps: see `./pedalHandles.pedalDragTargetAt`.
 */

/**
 * ⭐ **TAB WALKS THE TWO SQUARES** — `+1` Tab, `−1` Shift+Tab — the keyboard route to the same
 * selection, and the ottava's share of what `slurHandleCycle` and `cycleHairpinEndpoint` do.
 *
 * The REGISTRY IS THE LIST: the walk visits what the last render actually DREW, so a bracket whose
 * squares are not on screen has none to visit and Tab stays the browser's. With none armed, Tab
 * takes the FIRST and Shift+Tab the LAST, so either key is a way in; the walk WRAPS.
 *
 * ⚠️ DECLINES (false) when no ottava is selected or its squares are not drawn — the caller chains
 * rather than repaints on a false.
 */
export function cycleOttavaEndpoint(
  state: EditorState,
  registry: ElementRegistry,
  step: 1 | -1,
): boolean {
  const selected = selectedOf(state, 'ottava')
  if (!selected) return false
  const order = ottavaEndpointHandles(registry.getByType('ottava'), selected.id)
  if (!order.length) return false

  const at = order.findIndex(h => h.which === selected.endpoint)
  const next = at === -1
    ? (step === 1 ? 0 : order.length - 1)
    : (at + step + order.length) % order.length
  state.selectedElement = { kind: 'ottava', id: selected.id, endpoint: order[next].which }
  return true
}
