/**
 * ⭐⭐ **THE JOIN SQUARE OF A SELECTED BARLINE** — the handle that joins the gap between two staves,
 * or disjoins it: where it is (P2), what a press on it grabbed and what the cursor then means (P3).
 * docs/plans/barline-join-plan.md.
 *
 * ⚠️ The gesture's *plumbing* is `MouseController`'s — arming, previewing, the one undo entry on the
 * drop — and everything here is a pure function of the registry and a coordinate, which is what lets
 * the whole rule be tested without a mouse.
 *
 * ## ⭐⭐ A SQUARE EXISTS EXACTLY WHERE A GAP EXISTS — and ONE is offered, at the end you pressed
 *
 * The geometry is the first half: every gap of the system carries two possible squares, one hanging
 * under the staff above it and one sitting over the staff below, so a square can never name a gap the
 * model cannot express. ⛔ **Never an `if (staffCount === 1) return`** — a single staff has no gap, so
 * the loop below has nothing to iterate and produces nothing.
 *
 * What is OFFERED is the second half, and it is a much smaller set: {@link offeredAt} keeps the ONE
 * square at the staff and the END the press landed on — and then {@link squareAtPointer} lets a
 * DRAG move that end across the gap, which is the same filter doing the same job for a spot the
 * gesture named rather than the press. His two calls, 2026-08-28 — *"we should show
 * the blue square just in the stave we clicked and not in all staves"*, then *"the spot to click is
 * critical… if the user click in that area we show the blue square related with that"* — and both
 * programs that have this gesture agree (Sibelius §4.5 p. 343, MuseScore's single grip).
 *
 * ⚠️ **TWO squares, ONE gap, ONE stored fact.** Both squares of a gap name the same
 * `barlineJoinBelow` on the same upper staff (`engine/models/barlineJoin`) — which is why either end
 * of either staff can author the same join, and why {@link BarlineJoinHandle.staffAbove} is the
 * model's key while `side` is only ever which staff's edge the square hangs off — which way is
 * "pull" for the drag ({@link joinedAtPointer}). ⛔ Nothing reads it as an identity.
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
 * up (`rendering/staff/barlineGap`: the ink between two staves is the SCORE's, not either staff's).
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

/** What this needs of the {@link ElementRegistry}: the barline boxes, the SQUARES the highlight
 *  registered, and which bars were painted. */
export interface BarlineBoxRegistry {
  getByType(type: 'barline' | 'barline-join'): ReadonlyArray<{
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
 * `rendering/staff/barlineGap` that declines to draw a kinked join. ⛔ Never split the difference.
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
 *  which END of it, or the GAP between two staves (`SelectedElement`'s `barline`). Either half may be
 *  absent, and an absent half narrows nothing: ⛔ an unknown spot is never a guessed one. */
export interface PressedAt {
  staff?: number
  end?: 'top' | 'bottom' | 'gap'
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
 *
 * ⭐⭐ **AND A PRESS IN THE GAP ITSELF OFFERS NONE EITHER** — his call, 2026-08-28: *"when i select
 * the barline in the midle, in the white space i dont need to see the square, the square is related
 * just to the stave"*. A handle marks the END of a staff's line; out in the gap there is no end, and
 * the line you would be reaching for is already there. ⛔ Not the same as an absent spot, which means
 * nobody said where the press was.
 */
function offeredAt(handle: BarlineJoinHandle, pressed: PressedAt | undefined): boolean {
  if (pressed?.end === 'gap') return false
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
 * ⭐ **And it is the STROKES' span, which is exactly what the join draws.** `rendering/staff/barlineGap`
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

/**
 * ⭐⭐ **WHAT A PRESS ON A SQUARE GRABBED** — everything the join drag needs, captured once at the
 * grab, off the picture the user actually grabbed (the bar-width drag's rule, and for its reason:
 * the picture moves under the gesture).
 */
export interface BarlineJoinGrab {
  /** The boundary — the bar the line ENDS. */
  measure: number
  /** The gap, named by the staff above it: `barlineJoinBelow`'s own key. */
  staffAbove: number
  /** Halfway down the gap, in SVG y. ⭐ **The whole gesture is this one number**: the barline is
   *  joined when the pointer has dragged the grabbed end PAST the middle of the space it would
   *  cross, and disjoined when it comes back. No threshold to tune, no dead zone to pick — the
   *  music's own geometry says how far "onto the next staff" is. ⭐ It is also forgiving where the
   *  references are not: Sibelius and MuseScore want the handle dragged the WHOLE way onto the next
   *  staff, and half of it is enough here. */
  gapMidY: number
  /** Which way is AWAY from the grabbed square's own staff — true for a square hanging UNDER a
   *  staff, false for one sitting OVER the staff below. ⚠️ Read from the square's own y against the
   *  gap's middle, ⛔ never stored on the registry entry: the two squares of a gap write the same
   *  fact, so the entry names the GAP, and where a square sits is what says which end of it is. */
  awayIsDown: boolean
}

/**
 * ⭐⭐ **THE PRESS THAT ARMS THE JOIN DRAG** — run as a PRE-STEP in `MouseController`, before the hit
 * chain, exactly where the hairpin's, the slur's, the ottava's and the pedal's handle presses run
 * (docs/plans/barline-join-plan.md §4, P3).
 *
 * ⚠️ **Before the chain, and it must be**: the square sits ~10 px into the gap, inside the PADDED
 * staff band (`staffBand`'s 12 px) that the staff-spacing drag claims, and that gesture is armed in
 * the same block. A handle you can SEE has to win the press over whatever it happens to overlap.
 *
 * ⭐ **It arms and selects NOTHING.** A join square is not a selectable element — the barline stays
 * selected right through the drag, which is exactly what keeps the square painted while you hold it.
 *
 * The squares are only in the registry while a barline is selected (the highlight pass puts them
 * there), so no "is a barline selected" guard is needed — nothing else can be hit.
 */
export function barlineJoinGrabAt(
  registry: BarlineBoxRegistry,
  x: number,
  y: number,
): BarlineJoinGrab | null {
  const hit = registry.getByType('barline-join').find(el => {
    const b = el.bbox
    return x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height
  })
  if (!hit || hit.measure === undefined || hit.staff === undefined) return null

  const boxOf = (staff: number) => registry.getByType('barline')
    .find(el => el.measure === hit.measure && (el.staff ?? 0) === staff)
  const above = boxOf(hit.staff)
  const below = boxOf(hit.staff + 1)
  // ⛔ No fallback midpoint. Without both staves there is no gap to measure, and a guessed one would
  // make the drag flip at a place the music never named (*a guessing fallback gets believed*).
  if (!above || !below) return null

  const gapMidY = (above.bbox.y + above.bbox.height + below.bbox.y) / 2
  return {
    measure: hit.measure,
    staffAbove: hit.staff,
    gapMidY,
    awayIsDown: hit.bbox.y + hit.bbox.height / 2 < gapMidY,
  }
}

/**
 * **Is the gap joined, for a pointer at `y`?** — the drag's whole decision, and a pure function of
 * the grab, the cursor and what the gap was when it was grabbed.
 *
 * ⭐⭐ **THE DRAG FLIPS THE STATE; IT DOES NOT SET AN ABSOLUTE ONE.** His rule, 2026-08-28: *"somehow
 * the gesture should be oposite to the state… i have two staves, go to the first and go down and
 * join, correct; then if i go to the second and go up i should be able to disjoin cause is already
 * joined"*. So the pointer crossing the middle of the gap means **"do the thing"**, and what the
 * thing is depends on what is there:
 *
 * | at the grab | dragged past the middle |
 * |---|---|
 * | not joined | **joins** |
 * | joined | **disjoins** |
 *
 * ⭐ **Which is what makes every square live.** Under the absolute reading, a square on an
 * already-joined gap did nothing at all when dragged away from its staff — the answer was already
 * `true` — and his report is exactly that: he went to the second staff, dragged up, and nothing
 * happened. A handle you can see must do something when you pull it.
 *
 * ⭐ **And it keeps ONE square doing both directions**, his requirement from the first sketch
 * (*"important disjoint should be also managed here"*) — just not the way that sketch guessed: the
 * pair is now *pull to flip* / *come back to cancel*, rather than *away joins, back disjoins*.
 * Coming back before the middle restores exactly what was there, so a drag can always be called off
 * by returning to where it started.
 */
export function joinedAtPointer(grab: BarlineJoinGrab, y: number, wasJoined: boolean): boolean {
  return crossedMiddle(grab, y) ? !wasJoined : wasJoined
}

/**
 * **Has the grabbed square been pulled PAST THE MIDDLE of its gap?** — the ONE geometric fact the
 * whole gesture is made of: {@link joinedAtPointer} turns it into the gap's state, and
 * {@link squareAtPointer} into where the square is drawn.
 *
 * ⭐ It is one function so those two can never disagree about where the threshold is. The square
 * jumps on the very frame the gap flips, which is the entire reason the jump is worth drawing —
 * a square that moved at some other moment would be announcing something that had not happened.
 */
export function crossedMiddle(grab: BarlineJoinGrab, y: number): boolean {
  return grab.awayIsDown ? y > grab.gapMidY : y < grab.gapMidY
}

/** Which staff's line a square stands at, and which END of it — `SelectedElement.barline`'s own
 *  `staff` + `pressedAt` pair, because that pair IS what the highlight reads to pick the one square
 *  it draws ({@link offeredAt}). */
export interface BarlineJoinSquareEnd {
  staff: number
  end: 'top' | 'bottom'
}

/**
 * ⭐⭐ **THE SQUARE TELEPORTS ACROSS THE GAP** — his call, 2026-08-28: *"the idea is that this
 * square teleport in the direction the user drag so is clear visually of the gesture"*.
 *
 * ⭐ **It costs no new drawing.** Both squares of a gap are already built above and one is already
 * filtered out; the jump is only ever *turn the grabbed one off, turn the far one on*. His own
 * reading of it: *"we already have all the squares, we just have to off the current one and
 * visualize the next one with the gesture"*.
 *
 * ⭐⭐ **AND IT JUMPS AT THE GAP'S MIDDLE — the same threshold the join flips at.** So the square
 * is ⛔ not a cursor following the mouse: it is the WITNESS that the line now reaches the staff it
 * landed on. Pull back over the middle and it hops home, exactly as the flip is cancelled — which
 * is the same *pull to flip / come back to cancel* pair {@link joinedAtPointer} carries.
 *
 * ⚠️ The two ends are the gap's, ⛔ not one staff's: a `below` square hangs off the staff ABOVE the
 * gap and an `above` square off the staff BELOW it ({@link nearStaff}'s rule, read backwards).
 */
export function squareAtPointer(grab: BarlineJoinGrab, y: number): BarlineJoinSquareEnd {
  // ⭐ `awayIsDown` already IS "which square was grabbed": only the square hanging UNDER the upper
  // staff has the rest of the gap below it. ⛔ Nothing stores that — the grab reads it off the
  // square's own y, and this reads it back rather than adding a second way to say it.
  const grabbedUpper = grab.awayIsDown
  return grabbedUpper !== crossedMiddle(grab, y)
    ? { staff: grab.staffAbove, end: 'bottom' }
    : { staff: grab.staffAbove + 1, end: 'top' }
}
