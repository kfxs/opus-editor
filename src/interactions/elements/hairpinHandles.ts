/**
 * ⭐ **A SELECTED HAIRPIN'S TWO ENDPOINT HANDLES** — where they sit, how a press picks one, the order
 * Tab walks them, and which boundary a DRAG of one lands on. His ask in four steps across 2026-08-17,
 * from *"for the moment we don't do anything with the endpoints, let's just draw them"* to *"i want
 * to be able to do the last two operations with the endpoints dragging with the mouse"*.
 *
 * ⚠️ **What an armed end does is MUSICAL, never cosmetic.** A wedge's extent says which notes get
 * louder, so both routes off these squares — `Ctrl+Shift+←/→` and now the drag — write `beat` /
 * `length` on the model (docs/dynamics-line-and-hairpins-plan.md §4). There is no offset behind them
 * and nothing for `Ctrl+Backspace` to reset, unlike the slur's blue squares one file over.
 *
 * ⭐ **One module for all four questions**, because they are one answer read four ways: the walk
 * order IS the drawn order, the hit is the same two boxes, and the drag snaps to the same geometry
 * that placed them. The slur's equivalents are split across `HighlightController` (draw),
 * `MouseController` (press, drag) and `slurHandleCycle` (Tab) for historical reasons; this is what
 * that would look like filed by the thing rather than by the mechanism (CLAUDE.md's "a new feature
 * adds a MODULE").
 *
 * ## The arithmetic
 *
 * `HairpinRenderer` registers ONE ENTRY PER FRAGMENT under the hairpin's id, each carrying the drawn
 * outline as four `points` — top arm start, top arm end, bottom arm end, bottom arm start. So:
 *
 *  - the **beginning** handle is the FIRST fragment's left edge, at the midpoint between its two
 *    arms — i.e. on the wedge's axis, where the tip is on a crescendo and the mouth is on a
 *    diminuendo. A corner would sit on one arm and read as belonging to it;
 *  - the **end** handle is the LAST fragment's right edge, the same way.
 *
 * ⚠️ **The two ends come from DIFFERENT entries on a split wedge**, and that is the whole reason this
 * is a function rather than two array indexes: a hairpin cut across a system break has its beginning
 * in one system's coordinates and its end in another's. Reading both from one entry draws the second
 * square in the wrong system — the same trap the attachment guide has (`guides` ride the FIRST
 * fragment only) and the one `slurHandleCycle` names for slur handles.
 */
import type { ElementInfo, ElementRegistry } from '../../engine/ElementRegistry'
import type { MusicEngine } from '../../engine/MusicEngine'
import type { HairpinDragWrite } from '../../engine/models/hairpinOps'
import type { EditorState } from '../EditorState'
import { selectedOf } from '../EditorState'
import { hairpinLaneBoundaries } from '../hairpinLane'
import { authoredApertureRange } from '../../engine/rendering/hairpinShape'
import { dbg } from '../../utils/debug'

/** What finding a drag target needs off the engine — a Pick, so a test can stand up the four reads
 *  without a renderer. */
type DragEngine = Pick<MusicEngine, 'getHairpinById' | 'getScore' | 'getElementRegistry' | 'getNote'>

/** One drawn handle: a point, and which end of the span it is. */
export interface HairpinHandle {
  which: 'start' | 'end'
  x: number
  y: number
}

/**
 * ⭐ **HOW FAR OUTSIDE THE WEDGE EACH SQUARE SITS** — his correction, 2026-08-17: *"the squares are
 * too close to the hairpin… so it is easy to see the form of the hairpin and this don't overlap"*.
 * The beginning steps LEFT and the end steps RIGHT, i.e. both step outward along the span, so the
 * wedge's own shape — the thing being selected — is never under a square.
 *
 * The number is the handle's half-side (6 px, `SLUR_HANDLE_R + 1`) plus a few px of air, so the
 * square's inner edge clears the tip rather than merely missing its centre. ⚠️ PIXELS, like every
 * other handle in the editor: these are drawn on the highlight layer at a constant on-screen size,
 * so a square stays the same size to the hand at every zoom (⛔ not the rule for a DOM text overlay,
 * which sizes itself relative to its own box — different layer, different problem).
 */
export const HAIRPIN_HANDLE_GAP_PX = 10

/** The midpoint of a fragment's two arms at one side — the wedge's axis there — stepped `gap` px
 *  outward along the span so the square sits beside the ink instead of on it. */
function axisAt(
  points: { x: number; y: number }[],
  top: number,
  bottom: number,
  gap: number,
): { x: number; y: number } {
  return { x: points[top].x + gap, y: (points[top].y + points[bottom].y) / 2 }
}

/**
 * The two endpoint handles of `hairpinId`, from what the last render DREW (the registry is the list —
 * the same rule the slur's handles follow). Returns an empty array when the wedge is not on screen,
 * and drops a fragment whose outline is missing rather than guessing at a position.
 */
export function hairpinEndpointHandles(
  entries: readonly ElementInfo[],
  hairpinId: string,
): HairpinHandle[] {
  const pieces = entries.filter(el => el.id === hairpinId && (el.points?.length ?? 0) >= 4)
  if (!pieces.length) return []
  // Registration order IS drawing order, which is left to right through the systems — so the first
  // piece holds the beginning and the last holds the end (one piece holds both).
  const first = pieces[0].points!
  const last = pieces[pieces.length - 1].points!
  return [
    { which: 'start', ...axisAt(first, 0, 3, -HAIRPIN_HANDLE_GAP_PX) },
    { which: 'end', ...axisAt(last, 1, 2, HAIRPIN_HANDLE_GAP_PX) },
  ]
}

/**
 * ⭐ **A PRESS ON A SQUARE ARMS THAT END** — the mouse route, run as a PRE-STEP in
 * `MouseController` before the selection is cleared and before the hit chain, exactly where the
 * slur's handle press runs.
 *
 * ⚠️ **Before the chain, not a row in it**, and the reason is a real overlap rather than symmetry
 * with the slur: a hairpin shares the dynamics line with the `p` or `f` at its mouth, so a square
 * can land inside a dynamic's box — and `DYNAMIC_ELEMENT` sits ahead of `HAIRPIN_ELEMENT` in
 * {@link ELEMENT_HIT_ORDER}. A handle you can SEE has to win the press over the glyph it happens to
 * sit on, and a chain row could not promise that without reordering the marks themselves.
 *
 * The squares are only in the registry while their hairpin is selected (the highlight pass puts them
 * there), so no guard for "is this hairpin selected" is needed — nothing else can be hit.
 *
 * @returns true if a square consumed the press (the caller then re-renders and stops).
 */
export function armHairpinEndpointAt(
  state: EditorState,
  registry: ElementRegistry,
  x: number,
  y: number,
): boolean {
  const hit = registry.getByType('hairpin-endpoint').find(el => {
    const b = el.bbox
    return x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height
  })
  if (!hit?.hairpinId || !hit.endpoint) return false
  // ⚠️ Reassigned whole — the observable Proxy traps the SET, so mutating `.endpoint` in place would
  // change the value and tell nobody.
  state.selectedElement = { kind: 'hairpin', id: hit.hairpinId, endpoint: hit.endpoint }
  dbg(`✓ Hairpin endpoint armed | id:${hit.hairpinId} end:${hit.endpoint}`)
  return true
}

/**
 * ⭐⭐ **WHICH SLOT A DRAGGED SQUARE IS OVER** — the mouse twin of `Ctrl+Shift+←/→`, and the whole of
 * what a hairpin drag has to decide (his ask, 2026-08-17: *"take into account the current x position
 * of the mouse and the target anchor to make the jump so it match the movement"*).
 *
 * ⭐ **It snaps to a SLOT of the wedge's own lane, never to a pixel.** A wedge's extent is musical —
 * which notes get louder — so a drag may not put an end between two notes any more than the keyboard
 * may: the model has nowhere to store "two thirds of the way to the next quaver". The cursor chooses
 * a slot; the slot decides the geometry. That is also what makes the drag and the arrow keys land on
 * identical model states, rather than two roads to nearly-the-same wedge.
 *
 * ⚠️ **The distance is measured in BOTH axes**, though only x carries the answer within a system.
 * The y term is what keeps a drag on system 2 from snapping to a note at a similar x on system 1 —
 * cross-system x's are not one ruler. The radius is generous because the cursor is never near a
 * notehead's y: the wedge is drawn several spaces BELOW the staff, and the square is dragged along
 * that line.
 *
 * ⚠️ Candidates are the hairpin's OWN LANE (its voice, its staff), the same filter the model's
 * stepping ops apply — so a drag cannot land the wedge on a slot the keyboard could not reach.
 *
 * @returns the slot's (measure, beat) address, or null when nothing in the lane is near enough.
 */
export function hairpinDragTargetAt(
  engine: DragEngine,
  hairpinId: string,
  which: 'start' | 'end',
  x: number,
  y: number,
): HairpinDragWrite | null {
  const hairpin = engine.getHairpinById(hairpinId)
  if (!hairpin) return null

  // ⭐⭐ THE BOUNDARIES, NOT THE NOTEHEADS — and this is the whole accuracy of the gesture. Both of a
  // wedge's tips are drawn at a note's LEFT EDGE, so the positions a tip can occupy are the lane's
  // onsets. Snapping to notehead CENTRES — the slur's rule, right for the slur because a slur's end
  // is drawn ON the head — put the jump half a notehead early and, for the tip, a whole note late:
  // *"sometimes it jumps before x mouse reach the target"* (his report, 2026-08-17).
  //
  // ⭐ The list itself is `../hairpinLane`'s, shared with the left square's keyboard WALK — one
  // answer to where a slot is drawn, so the two devices cannot disagree about it. Its header carries
  // the geometry and the lane rule this comment used to.
  const boundaries = hairpinLaneBoundaries(engine, hairpin)
  if (!boundaries.length) return null

  // ⭐ One extra boundary PAST the last note of the lane — "cover everything". Without it the last
  // note could never be included: every other boundary is an onset, and the music has no onset after
  // its final one. (Its x is that note's own right edge, which is where the bar's end is heading.)
  const last = boundaries.reduce((a, b) => (b.y > a.y || (b.y === a.y && b.x > a.x) ? b : a))
  const candidates = [...boundaries.map(b => ({ ...b, covering: false })), { ...last, x: last.right, covering: true }]

  let best: typeof candidates[number] | null = null
  let bestDistance = HAIRPIN_DRAG_SNAP_PX
  for (const b of candidates) {
    const d = Math.hypot(x - b.x, y - b.y)
    if (d < bestDistance) { bestDistance = d; best = b }
  }
  if (!best) return null

  if (which === 'start') {
    // A start has nowhere to go past the last onset — the "cover everything" boundary is the tip's.
    return best.covering ? null : { at: 'start', ...best.target }
  }
  return { at: best.covering ? 'endCovering' : 'endBefore', ...best.target }
}

/** ⚠️ Generous on purpose — see {@link hairpinDragTargetAt}: the cursor rides the wedge's line,
 *  several staff-spaces below the noteheads it is choosing between. */
const HAIRPIN_DRAG_SNAP_PX = 150

/**
 * ⭐ **THE SCALE FOR A BODY DRAG** — the staff-line spacing (px) of the staff the wedge was DRAWN on,
 * which is the divisor that turns a cursor's pixel delta into the staff-spaces its offset override
 * is stored in (his ask, 2026-08-18: dragging a selected hairpin with NO square armed).
 *
 * ⭐ **Read off the drawn entry, not off a constant**, because a staff may be SMALL: a wedge on a
 * `scale(k)` staff moves k times fewer pixels per staff-space, and a fixed 10 would make the same
 * gesture move a cue staff's hairpin twice as far as a full one's
 * (`project_small_staff_spacing` — visual coordinates inside a scaled scope are the bug class).
 *
 * @returns null when the wedge is not on screen or its staff has no measured geometry — no picture,
 *   no scale, so the caller must not start a drag at all rather than guess one.
 */
export function hairpinStaffSpacePx(registry: ElementRegistry, hairpinId: string): number | null {
  const drawn = registry.getByType('hairpin').find(e => e.id === hairpinId)
  if (!drawn || drawn.measure === undefined) return null
  return registry.getStaffGeometry(drawn.measure, drawn.staff ?? 0)?.lineSpacing ?? null
}

/**
 * ⭐⭐ **WHICH SQUARE HAS THE MOUTH** — the right-hand one on a crescendo, the left on a diminuendo
 * (his rule, 2026-08-17: *"the endpoint that control the mouth is the one who has the mouth"*).
 *
 * A wedge is closed at one end and open at the other, and only the open end has an aperture to
 * change; the tip is a point. So the mouth keys answer on ONE of the two squares, and the choice is
 * the wedge's TYPE rather than a side of the score.
 */
export function hairpinMouthEnd(type: 'cresc' | 'dim'): 'start' | 'end' {
  return type === 'cresc' ? 'end' : 'start'
}

/** What the mouth keys need off the engine. */
type MouthEngine = Pick<MusicEngine, 'getHairpinById' | 'getElementRegistry' | 'setHairpinAperture'>

/** The mouth as the last render DREW it, plus the range it may be authored in — both facts about the
 *  drawn wedge, since the automatic aperture is a function of its length. */
function drawnMouth(engine: MouthEngine, hairpinId: string): { value: number; min: number; max: number } | null {
  const drawn = engine.getElementRegistry().getByType('hairpin').find(e => e.id === hairpinId)
  if (drawn?.apertureSpaces === undefined) return null
  return { value: drawn.apertureSpaces, ...authoredApertureRange(drawn.hairpinLengthSpaces ?? 0) }
}

/**
 * ⭐⭐ **OPEN OR CLOSE THE MOUTH BY ONE STEP** — `Shift+↑` / `Shift+↓` with the mouth-bearing square
 * armed (his ask, 2026-08-17).
 *
 * ⚠️ **It was `Shift+←/→` first, and the argument for that was wrong in the hand.** The reasoning:
 * the mouth is a SYMMETRIC spread about the wedge's axis, so pressing ↑ moves the top arm up and the
 * bottom arm *down* and no vertical direction really means "open"; grow / shrink on a modified `←/→`
 * is the editor's idiom for size (bar width, note spacing, the extent, a pedal's length). He tried it
 * and said *"i test it and is not intuitive, lets try arrow up down instead"*. ⭐ Which is the better
 * answer, and the flaw in the argument is visible once you know: you do not reach for "the pair", you
 * reach for the ARM under the cursor — the mouth's own square sits at the open end, and ↑ = wider is
 * what the hand expects there. Recorded because the reasoning was sound and still lost to a test.
 *
 * ⚠️ It therefore shares an axis with the plain and `Ctrl` arrows, which move this same square's
 * OFFSET. That is a real cost of the choice, paid because the gesture reads better: the modifier is
 * what separates "move this end" from "open the wedge".
 *
 * ⭐ **It steps from what is DRAWN**, authored or automatic, for the reason the Properties input does:
 * a first press must continue the shape on screen rather than jump to a bound (his correction on the
 * panel, applied here by construction). And it CLAMPS into `authoredApertureRange`, so the keyboard
 * and the panel cannot reach different values.
 *
 * ⚠️ DECLINES when no hairpin end is armed, when the armed one is the CLOSED end (a tip has no
 * aperture), when the wedge is not on screen to measure, or when the step would leave the range —
 * which is what keeps `Shift+←/→` the barline gap's everywhere else.
 */
export function nudgeArmedHairpinMouth(
  state: EditorState,
  engine: MouthEngine,
  delta: number,
): boolean {
  const selected = selectedOf(state, 'hairpin')
  if (!selected?.endpoint) return false
  const hairpin = engine.getHairpinById(selected.id)
  if (!hairpin || selected.endpoint !== hairpinMouthEnd(hairpin.type)) return false

  const mouth = drawnMouth(engine, selected.id)
  if (!mouth) return false
  const next = Math.min(mouth.max, Math.max(mouth.min, round2(mouth.value + delta)))
  if (next === round2(mouth.value)) return false // already at that bound — decline rather than no-op
  if (!engine.setHairpinAperture(selected.id, next)) return false
  dbg(`Hairpin mouth ${delta > 0 ? 'opened' : 'closed'} | id:${selected.id} → ${next}sp`)
  return true
}

/**
 * `Shift+Backspace` with the mouth-bearing square armed: back to the automatic, length-aware
 * aperture — the matching backspace this editor gives every arrow-chord.
 *
 * ⚠️ DECLINES when nothing is authored (the engine's own answer), so the key still falls through to
 * the barline gap's reset.
 */
export function resetArmedHairpinMouth(state: EditorState, engine: MouthEngine): boolean {
  const selected = selectedOf(state, 'hairpin')
  if (!selected?.endpoint) return false
  const hairpin = engine.getHairpinById(selected.id)
  if (!hairpin || selected.endpoint !== hairpinMouthEnd(hairpin.type)) return false
  if (!engine.setHairpinAperture(selected.id, null)) return false
  dbg(`Hairpin mouth reset to auto | id:${selected.id}`)
  return true
}

/** Two decimals — the drawn aperture is a float off a pixel division, and stepping it must not
 *  accumulate `1.6500000000000001`. */
function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * ⭐ **TAB WALKS THE TWO SQUARES** — `+1` Tab, `−1` Shift+Tab — the keyboard route to the same
 * selection, and the hairpin's half of what `slurHandleCycle` does for a slur.
 *
 * The REGISTRY IS THE LIST, that module's rule and for its reasons: the walk visits what the last
 * render actually DREW, so a hairpin whose squares are not on screen has none to visit and Tab stays
 * the browser's. With none armed, Tab takes the FIRST and Shift+Tab the LAST, so either key is a way
 * in; the walk WRAPS.
 *
 * ⚠️ DECLINES (false) when no hairpin is selected or its squares are not drawn — the caller chains
 * rather than repaints on a false.
 */
export function cycleHairpinEndpoint(
  state: EditorState,
  registry: ElementRegistry,
  step: 1 | -1,
): boolean {
  const selected = selectedOf(state, 'hairpin')
  if (!selected) return false
  const order = hairpinEndpointHandles(registry.getByType('hairpin'), selected.id)
  if (!order.length) return false

  const at = order.findIndex(h => h.which === selected.endpoint)
  const next = at === -1
    ? (step === 1 ? 0 : order.length - 1)
    : (at + step + order.length) % order.length
  state.selectedElement = { kind: 'hairpin', id: selected.id, endpoint: order[next].which }
  return true
}
