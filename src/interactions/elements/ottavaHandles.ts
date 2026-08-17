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
import type { MusicEngine } from '../../engine/MusicEngine'
import type { OttavaSlotTarget, OttavaDragWrite } from '../../engine/models/ottavaOps'
import type { Score } from '../../types/music'
import type { EditorState } from '../EditorState'
import { selectedOf } from '../EditorState'
import { staffOf } from '../../utils/lanes'
import { fracCompare } from '../../utils/fraction'
import { dbg } from '../../utils/debug'

/** What finding a drag target needs off the engine — a Pick, so a test can stand up the four reads
 *  without a renderer. */
type DragEngine = Pick<MusicEngine, 'getOttavaById' | 'getScore' | 'getElementRegistry' | 'getNote'>

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
 * ⭐⭐ **WHICH SLOT A DRAGGED SQUARE IS OVER** — the mouse twin of `Ctrl+Shift+←/→`, and the whole of
 * what an ottava drag has to decide (his ask, 2026-08-17: *"next step is the drag mouse reanchor for
 * both points"*).
 *
 * ⭐ **It snaps to a SLOT of the bracket's own staff, never to a pixel.** An octave line's extent is
 * musical — which notes are displaced — so a drag may not put an end between two onsets any more
 * than the keyboard may: the model has nowhere to store "two thirds of the way to the next quaver".
 *
 * ⭐⭐ **The two ends snap to DIFFERENT EDGES, and that is not symmetry for its own sake — it is
 * where each end is DRAWN.** `OttavaRenderer.spanX` puts the numeral at the first covered notehead's
 * LEFT edge and the hook at the last covered notehead's RIGHT edge (Gould's rule 2, the opposite of
 * the wedge's). Measuring both against one edge is exactly the mistake that made the hairpin drag
 * *"jump before x mouse reach the target"* — there, snapping to notehead CENTRES when the tips are
 * drawn on left edges. Here the ink itself is asymmetric, so the candidate x is too.
 *
 * ⚠️ **The lane is the STAFF, every voice** — `resizeOttavaBySlot`'s rule, so a drag cannot land the
 * bracket on a slot the keyboard could not reach.
 *
 * ⚠️ **The distance is measured in BOTH axes**, though only x carries the answer within a system.
 * The y term is what keeps a drag on system 2 from snapping to a note at a similar x on system 1 —
 * cross-system x's are not one ruler. The radius is generous because the cursor is never near a
 * notehead's y: the bracket rides above (or below) the staff and the square is dragged along it.
 *
 * @returns the slot's (measure, beat) address plus which end it is for, or null when nothing on the
 *   staff is near enough.
 */
export function ottavaDragTargetAt(
  engine: DragEngine,
  ottavaId: string,
  which: 'start' | 'end',
  x: number,
  y: number,
): OttavaDragWrite | null {
  const ottava = engine.getOttavaById(ottavaId)
  if (!ottava) return null
  const staff = staffIndexOf(engine.getScore(), ottava.staffId)

  // One candidate per ONSET of the staff. ⚠️ A chord registers one entry per notehead at one onset,
  // and a second interval displaces one of them sideways — so the beginning takes the LEFTMOST edge
  // and the end the RIGHTMOST, which is the pair of edges the bracket is actually drawn against.
  const onsets: Array<{ left: number; right: number; y: number; target: OttavaSlotTarget }> = []
  const registry = engine.getElementRegistry()
  for (const el of [...registry.getByType('note'), ...registry.getByType('rest')]) {
    if (!el.id) continue
    const note = engine.getNote(el.id)
    if (!note) continue
    // ⛔ No voice filter — an octave line governs the whole staff. `resizeOttavaBySlot` says why.
    if (staffOf(note) !== staff) continue
    const target = { measure: note.measure, beat: note.beat }
    const seen = onsets.find(o =>
      o.target.measure === target.measure && fracCompare(o.target.beat, target.beat) === 0)
    if (seen) {
      seen.left = Math.min(seen.left, el.bbox.x)
      seen.right = Math.max(seen.right, el.bbox.x + el.bbox.width)
      continue
    }
    onsets.push({
      left: el.bbox.x,
      right: el.bbox.x + el.bbox.width,
      y: el.bbox.y + el.bbox.height / 2,
      target,
    })
  }
  if (!onsets.length) return null

  let best: OttavaSlotTarget | null = null
  let bestDistance = OTTAVA_DRAG_SNAP_PX
  for (const o of onsets) {
    const d = Math.hypot(x - (which === 'start' ? o.left : o.right), y - o.y)
    if (d < bestDistance) { bestDistance = d; best = o.target }
  }
  return best ? { at: which, ...best } : null
}

/** ⚠️ Generous on purpose — see {@link ottavaDragTargetAt}: the cursor rides the bracket's line,
 *  several staff-spaces off the noteheads it is choosing between. The hairpin's number. */
const OTTAVA_DRAG_SNAP_PX = 150

/** The staff INDEX an ottava's `staffId` names (absent = the first staff), so a drawn element's own
 *  `staff` can be compared against it. `hairpinHandles`' helper, kept local for its reason: it is
 *  three lines and sharing it would put a `Score` import in whichever file lost. */
function staffIndexOf(score: Score, staffId: string | undefined): number {
  if (!staffId) return 0
  const at = score.staves?.findIndex(s => s.id === staffId) ?? -1
  return at === -1 ? 0 : at
}

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
