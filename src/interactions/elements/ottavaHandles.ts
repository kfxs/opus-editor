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
import type { EditorState } from '../EditorState'
import { selectedOf } from '../EditorState'
import { ottavaLaneOnsets } from '../ottavaLane'
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
 * ## 🚨🚨 THE Y IS TRANSLATED BEFORE ANYTHING IS COMPARED
 *
 * ⭐⭐ **The hand rides the BRACKET's line, and that line is nowhere near the noteheads it
 * addresses** — so the raw cursor y can be closer to the NEIGHBOURING system's music than to its
 * own, and answer with it. Reported on the pedal (2026-08-18: *"I'm dragging in the y of the pedal,
 * aligned to it, but it interprets I'm in the system below"*) and fixed here in the same breath,
 * because this is where that drag was copied from. ⚠️ It is not a tolerance that can be widened out
 * of trouble: the wrong row is genuinely nearer.
 *
 * ⭐⭐ **So the offset is MEASURED and subtracted, ⛔ never a constant and never re-derived from the
 * ladder** ({@link lineToMusicOffset}) — the gap between the drawn square and the onset it was drawn
 * over already contains whatever the families inside this one claimed, and it is re-read every
 * frame. After it, the y CHOOSES THE SYSTEM and the x CHOOSES THE NOTE: one hypotenuse over both
 * axes let a pitch difference inside a row (a note four ledger lines up) outvote a hundred pixels of
 * horizontal distance. Cross-system x's are not one ruler, which is the only reason y is consulted.
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

  // ⭐ ONE list of "where a slot is drawn", shared with the keyboard's walk (`../ottavaLane`) — the
  // mouse had this scan first, and a second copy would be a second answer that can disagree.
  const onsets = ottavaLaneOnsets(engine, ottava)
  if (!onsets.length) return null

  // 🚨 THE TRANSLATION — see the header. The cursor is where the HAND is, on the bracket's line; the
  // onsets are where the MUSIC is. This is the measured gap between the two.
  const inMusic = y - lineToMusicOffset(engine, ottavaId, which, ottava.shift, onsets)

  // ⭐ The y picks the SYSTEM, the x picks the note. Two axes, two questions.
  const row = onsets.filter(o => Math.abs(inMusic - o.y) <= OTTAVA_DRAG_ROW_PX)
  if (!row.length) return null

  let best: OttavaSlotTarget | null = null
  let bestDistance = OTTAVA_DRAG_SNAP_PX
  for (const o of row) {
    const d = Math.abs(x - (which === 'start' ? o.left : o.right))
    if (d < bestDistance) { bestDistance = d; best = o.target }
  }
  return best ? { at: which, ...best } : null
}

/**
 * ⭐⭐ **How far off the music this bracket's line is drawn, MEASURED from the last render** — the
 * number {@link ottavaDragTargetAt} subtracts from the cursor's y.
 *
 * ⚠️⚠️ **AND IT IS SIGNED, which is the one thing the pedal's twin does not have to think about.**
 * A pedal is always below its staff; an octave line takes the side its SHIFT names — 8va above, 8vb
 * below — so the onset the square was drawn over is on the opposite side of the square each time.
 * Looking the wrong way finds the *neighbouring system's* music and reports a gap of nothing, which
 * is the same bug this function exists to fix, arriving by the back door. ⛔ The side is derived
 * from `shift`, never from the pixels.
 *
 * Returns 0 when the bracket is not on screen or nothing lies on the expected side — the honest "I
 * don't know", which leaves the raw cursor y in play rather than inventing a shift.
 */
function lineToMusicOffset(
  engine: DragEngine,
  ottavaId: string,
  which: 'start' | 'end',
  shift: number,
  onsets: ReadonlyArray<{ left: number; y: number }>,
): number {
  const anchor = ottavaEndpointHandles(engine.getElementRegistry().getByType('ottava'), ottavaId)
    .find(h => h.which === which)
  if (!anchor) return 0
  // 8va rides ABOVE the staff, so its own music is BELOW the square; 8vb is the mirror.
  const musicIsBelow = shift > 0
  let found: { left: number; y: number } | null = null
  let nearest = Infinity
  for (const o of onsets) {
    if (musicIsBelow ? o.y <= anchor.y : o.y >= anchor.y) continue
    const d = Math.hypot(anchor.x - o.left, anchor.y - o.y)
    if (d < nearest) { nearest = d; found = o }
  }
  return found ? anchor.y - found.y : 0
}

/** ⚠️ Generous on purpose — see {@link ottavaDragTargetAt}: HORIZONTAL only, now that the row is
 *  chosen separately. The hairpin's number. */
const OTTAVA_DRAG_SNAP_PX = 150

/** How far off a system's noteheads the translated cursor may be and still be READING that system.
 *  `PEDAL_DRAG_ROW_PX`'s twin, and the same tolerance-not-boundary reading: wide enough for the
 *  pitch spread inside one system, well under the gap to the next. */
const OTTAVA_DRAG_ROW_PX = 80

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
