/**
 * ⭐⭐ **THE JOIN SQUARE OF A SELECTED BARLINE** — the handle that joins the gap between two staves,
 * or disjoins it. P2 of docs/barline-join-plan.md; the drag that grabs one is P3, and ⛔ none of it is
 * here yet.
 *
 * ## ⭐⭐ A SQUARE EXISTS EXACTLY WHERE A GAP EXISTS — and ONE is offered, at the end you pressed
 *
 * The geometry is the first half: every gap of the system carries two possible squares, one hanging
 * under the staff above it and one sitting over the staff below, so a square can never name a gap the
 * model cannot express. ⛔ **Never an `if (staffCount === 1) return`** — a single staff has no gap, so
 * the loop below has nothing to iterate and produces nothing.
 *
 * What is OFFERED is the second half, and it is a much smaller set: {@link offeredAt} keeps the ONE
 * square at the staff and the END the press landed on. His two calls, 2026-08-28 — *"we should show
 * the blue square just in the stave we clicked and not in all staves"*, then *"the spot to click is
 * critical… if the user click in that area we show the blue square related with that"* — and both
 * programs that have this gesture agree (Sibelius §4.5 p. 343, MuseScore's single grip).
 *
 * ⚠️ **TWO squares, ONE gap, ONE stored fact.** Both squares of a gap name the same
 * `barlineJoinBelow` on the same upper staff (`engine/models/barlineJoin`) — which is why either end
 * of either staff can author the same join, and why {@link BarlineJoinHandle.staffAbove} is the
 * model's key while `side` is only ever which staff's edge the square hangs off. P3 reads `side` for
 * the DIRECTION of the drag (away from the staff joins, back toward it disjoins); ⛔ nothing reads it
 * as an identity.
 *
 * ## ⭐ The look does NOT say whether the gap is joined
 *
 * His call, 2026-08-28, asked as a choice between a state-showing square and one that never changes:
 * *"always the same square"*. The ink crossing the gap is what says the gap is joined; the square only
 * says *you can grab here*. ⇒ this module answers the same handles either way and never consults
 * `barlineJoinsBelow` at all — which is also what keeps a JOINED gap grabbable, since grabbing it is
 * how you disjoin (plan §1).
 */
import { BARLINE_BOX_STRADDLE_PX, barlineSignParts, type BarlineSignKind } from '@/engine/layout/barlineSign'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'

/**
 * ⭐ **THE AIR — how far outside its staff's own line each square's CENTRE sits**, in px.
 *
 * The same 10 the hairpin's, the ottava's and the pedal's handles use (`PEDAL_HANDLE_GAP_PX` and its
 * twins), measured the same way — centre to ink — so the square's near edge stands about 4 px clear of
 * the staff line it hangs off. One family, one look, one distance for the hand to learn.
 *
 * ⚠️ There is room: the default stride puts ~110 px between one staff's bottom line and the next
 * staff's top line (`layout/staffStride`), so the two squares of a gap stand ~90 px apart and neither
 * is anywhere near the other.
 *
 * ⚠️ PIXELS, like every other handle in the editor — the squares are drawn on the highlight layer at a
 * constant on-screen size, so one stays the same size to the hand at every zoom, and a SMALL staff's
 * squares stand as far off its lines as a full-size one's. ⭐ That is the gap ink's own rule one level
 * up (`rendering/barlineGap`: the ink between two staves is the SCORE's, not either staff's).
 */
export const BARLINE_JOIN_HANDLE_GAP_PX = 10

/** One drawn square: the gap it owns, which staff's edge it hangs off, and where it goes. */
export interface BarlineJoinHandle {
  /** ⭐ **The gap, named by the staff ABOVE it** — `barlineJoinBelow`'s own key, so the two squares of
   *  one gap carry the same number. */
  staffAbove: number
  /** `below` = under the upper staff of the gap, `above` = over the lower one. */
  side: 'below' | 'above'
  /** The square's CENTRE, in the SVG's own coordinates (what the registry answers in). */
  x: number
  y: number
}

/** What this needs of the {@link ElementRegistry}: the barline boxes, and which bars were painted. */
export interface BarlineBoxRegistry {
  getByType(type: 'barline'): ReadonlyArray<{
    measure?: number
    staff?: number
    bbox: { x: number; y: number; width: number; height: number }
  }>
  isPainted(measure: number, staff: number): boolean
}

/**
 * The squares of the barline that ends `measure` — from what the last render actually DREW (the
 * registry is the list, every handle family in the editor's rule).
 *
 * ⚠️ **Only PAINTED bars**, `interactions/elements/barline`'s rule and for its reason: tier 1
 * registers a barline box for every bar in the SCORE, drawn or not, so an off-screen bar would
 * otherwise hand out squares hanging in blank space.
 *
 * ⚠️ **ADJACENT staves only.** A gap is between staff *n* and staff *n+1*, which is what
 * `barlineJoinsBelow(score, staffId, …)` can express; when the staff between two painted ones was not
 * drawn there is no single gap to name, so no square is offered for it.
 *
 * ⭐ **Each square takes its x from ITS OWN staff's box**, not from the upper one's for both. Normally
 * they are identical; where they are not — a start repeat displaced past a header on one staff only
 * (`BarlineRenderer.displacedRepeatX`) — each square still sits on the line it hangs off, and it is
 * `rendering/barlineGap` that declines to draw a kinked join. ⛔ Never split the difference.
 */
export function barlineJoinHandles(
  registry: BarlineBoxRegistry,
  measure: number,
  kind: BarlineSignKind,
  pressedAt?: PressedAt,
): BarlineJoinHandle[] {
  const inkCentre = strokeCentrePx(kind)
  const boxes = registry.getByType('barline')
    .filter(el => el.measure === measure && registry.isPainted(measure, el.staff ?? 0))
    .map(el => ({ staff: el.staff ?? 0, bbox: el.bbox }))
    .sort((a, b) => a.staff - b.staff)

  const handles: BarlineJoinHandle[] = []
  for (let i = 0; i + 1 < boxes.length; i++) {
    const above = boxes[i]
    const below = boxes[i + 1]
    if (below.staff !== above.staff + 1) continue
    handles.push({
      staffAbove: above.staff,
      side: 'below',
      x: boundaryX(above.bbox) + inkCentre,
      y: above.bbox.y + above.bbox.height + BARLINE_JOIN_HANDLE_GAP_PX,
    })
    handles.push({
      staffAbove: above.staff,
      side: 'above',
      x: boundaryX(below.bbox) + inkCentre,
      y: below.bbox.y - BARLINE_JOIN_HANDLE_GAP_PX,
    })
  }
  return handles.filter(h => offeredAt(h, pressedAt))
}

/** Where on the line the press landed, when a press is what selected the barline — the staff, and
 *  which END of it (`SelectedElement`'s `barline`). Either half may be absent, and an absent half
 *  narrows nothing: ⛔ an unknown spot is never a guessed one. */
export interface PressedAt {
  staff?: number
  end?: 'top' | 'bottom'
}

/**
 * ⭐⭐ **ONE SQUARE, AT THE END YOU PRESSED** — his call, 2026-08-28: *"the spot to click is
 * critical… if the user click in that area we show the blue square related with that"*, after seeing
 * two at once and finding it *"too much"*.
 *
 * ⭐ **And it is what both programs that have this gesture do**: Sibelius shows the handle at the end
 * clicked (*"Click carefully at the top or bottom of a normal barline… a purple square 'handle' will
 * appear"*, Reference 2022.3 §4.5 p. 343) and MuseScore 4 shows exactly one grip
 * (`BarLine::gripsPositions`, the top one commented out in the source).
 *
 * ⚠️ **A pressed end with no gap behind it offers NOTHING** — the top of the first staff, the bottom
 * of the last — and that is the rule doing its job, not a case to special-case: there is no space
 * there for a line to run through, so there is nothing to join. The gap on the other side of that
 * staff belongs to its neighbour and is offered by pressing THAT line.
 */
function offeredAt(handle: BarlineJoinHandle, pressed: PressedAt | undefined): boolean {
  if (pressed?.staff !== undefined && nearStaff(handle) !== pressed.staff) return false
  if (pressed?.end !== undefined && handle.side !== (pressed.end === 'top' ? 'above' : 'below')) return false
  return true
}

/** The staff a square HANGS OFF — the one whose line it stands beside. A `below` square hangs off the
 *  staff above its gap, an `above` square off the staff below it. ⚠️ ⛔ Not
 *  {@link BarlineJoinHandle.staffAbove}, which names the GAP and is the model's key: the two differ
 *  for exactly half the squares, and that is the half his *"just in the stave we clicked"* turns on. */
function nearStaff(handle: BarlineJoinHandle): number {
  return handle.side === 'below' ? handle.staffAbove : handle.staffAbove + 1
}

/**
 * 🚨 **WHERE THE LINE ACTUALLY IS, recovered from the box that straddles it.** A barline's hit box
 * grows LEFTWARD with the sign's ink and straddles the boundary by {@link BARLINE_BOX_STRADDLE_PX}
 * either way, so the boundary is its right edge less the straddle — ⛔ never its centre, which on a
 * final bar or a repeat is half a sign's width to the left of the line the square must sit on.
 */
function boundaryX(bbox: { x: number; width: number }): number {
  return bbox.x + bbox.width - BARLINE_BOX_STRADDLE_PX
}

/**
 * ⭐⭐ **THE SQUARE IS CENTRED ON THE INK, NOT ON THE BOUNDARY** — his report, 2026-08-28: *"i have
 * the feeling the blue square is not centered regarding the barline"*. He was right, and measured
 * (jsdom, bar 1): the boundary is x 166 while the drawn stroke is `[166, 167.6]`, so a square centred
 * on the boundary sits **0.8 px left** of the line it is supposed to belong to. ⛔ A boundary is a
 * COORDINATE; what the eye centres a handle against is INK
 * ([[feedback_every_space_needs_a_quotation]]'s rule, in miniature).
 *
 * ⭐ **And it is the STROKES' span, which is exactly what the join draws.** `rendering/barlineGap`
 * fills `parts.strokes` and ⛔ never `parts.dots` (the lines run through, the dots do not), so the
 * square centres on the very ink the gap will hold. That matters far more than 0.8 px on the signs
 * that are not plain: a final bar's and an end repeat's strokes are **entirely to the LEFT** of the
 * boundary, so centring on the boundary would stand the square ~5 px off its own line, and an end
 * repeat's dots — deliberately excluded here — would drag it further still.
 *
 * ⚠️ **In the SCORE's staff space** ({@link STAFF_SPACE_PX}), ⛔ not the staff's own: the square hangs
 * in the gap, and the gap's ink is the score's at the score's staff-space (`barlineGap`'s `GAP_SPACE`,
 * and `drawSystemConnector`'s rule before it). A small staff's own sign is narrower; the line the
 * square marks is not.
 */
function strokeCentrePx(kind: BarlineSignKind): number {
  const { strokes } = barlineSignParts(kind)
  const left = Math.min(...strokes.map(s => s.x))
  const right = Math.max(...strokes.map(s => s.x + s.width))
  return ((left + right) / 2) * STAFF_SPACE_PX
}
