/**
 * ⭐ **WHERE A DYNAMIC'S GROUP IS TRANSLATED TO — one owner, one absolute write.**
 *
 * Three passes move a rendered dynamic off the spot VexFlow drew it: the co-located row
 * (`layoutCoLocatedDynamics`), the hand nudge (`applyDynamicOffsets`) and, since P1 of
 * docs/dynamics-line-and-hairpins-plan.md, the **dynamics line** — a post-measure system pass. They
 * all move the same `<g>`, so somebody has to own the attribute, and until now nobody did: the first
 * overwrote it, the second PREPENDED to whatever it found.
 *
 * ⚠️⚠️ **Prepending is only safe on a freshly drawn group, and the line pass is the one that isn't.**
 * The first two run inside `drawMeasureContent`, so the element is new and empty every time. The line
 * pass runs over EVERY measure of a system — including the ones that were reused rather than
 * re-engraved (`replaySnapshot`), whose marks still carry last render's transform. Prepend there and
 * each render adds another translate on top of the last: the mark walks down the page, one line's
 * worth per keystroke, and the registry box walks with it. That is the plan's ⚠️ in §7, and this
 * module is the answer to it.
 *
 * ⭐ **The fix is to keep the COMPONENTS, not the sum.** Each contribution is stored on the element
 * itself, and every write recomposes the whole transform from them — so the pass is idempotent
 * (running it twice with the same line moves nothing) and a reused mark is corrected by exactly the
 * change, with no arithmetic on strings.
 *
 * ⚠️ Why on the ELEMENT and not on the `RenderPass`: a reused measure's mark is precisely the case
 * where the pass state was thrown away and the DOM node was not. The node is the one thing that
 * survives a render it took no part in, which is what makes it the right place to keep what was done
 * to it. (The alternative is a fourth id-keyed map through `MeasureSnapshot`, `captureById` and
 * `replaySnapshot` — three more slices in the big file, for a number the node already carries.)
 *
 * ⚠️ Every delta here is LOCAL — the translate rides inside the staff's `scale(k)` group — so the
 * registry is told in the same units and applies the scale itself ({@link ElementRegistry.shiftById}).
 * A caller outside `withScale` must say which staff it is moving ink on.
 */
import type { RenderPass } from './RenderPass'

/** The co-located row's own shift (`layoutCoLocatedDynamics`). `"x,y"`, local px. */
const SHIFT_ATTR = 'data-dyn-shift'
/**
 * ⭐⭐ **THE HAND NUDGE, ON ITS OWN** (client #8) — `"x,y"` in local px, and a component SEPARATE
 * from {@link SHIFT_ATTR} since 2026-08-22.
 *
 * ⚠️ It used to be summed into that shift, and inside the bar draw the two are indistinguishable:
 * the element is new every time, so adding is setting. A PREVIEW is what tells them apart — it
 * re-applies the nudge to a mark nobody re-engraved (`./dynamicNudgePass`), and there is no way to
 * SET half of a sum. Kept apart, each is one absolute answer with one writer, which is this module's
 * own rule two paragraphs up.
 */
const NUDGE_ATTR = 'data-dyn-nudge'
/** The dynamics line's own contribution, local px — see `dynamicsLinePass`. */
const LINE_ATTR = 'data-dyn-line'
/** Half a level's width, pulling it back onto its notehead — see `dynamicMarkAnchor`. */
const ANCHOR_ATTR = 'data-dyn-anchor'

/** What the mark's `transform` is made of. Its sum is `(x + nudgeX + anchor, y + nudgeY + line)`. */
interface MarkTransform {
  x: number
  y: number
  /** The composer's own nudge, kept apart from the row's shift — see {@link NUDGE_ATTR}. */
  nudgeX: number
  nudgeY: number
  line: number
  anchor: number
}

const finite = (value: number): number => (Number.isFinite(value) ? value : 0)

/** What was last written to this element — all zeros for a freshly drawn one. */
function componentsOf(el: SVGGraphicsElement): MarkTransform {
  const [x, y] = (el.getAttribute(SHIFT_ATTR) ?? '').split(',').map(Number)
  const [nudgeX, nudgeY] = (el.getAttribute(NUDGE_ATTR) ?? '').split(',').map(Number)
  return {
    x: finite(x),
    y: finite(y),
    nudgeX: finite(nudgeX),
    nudgeY: finite(nudgeY),
    line: finite(Number(el.getAttribute(LINE_ATTR))),
    anchor: finite(Number(el.getAttribute(ANCHOR_ATTR))),
  }
}

/** The sum of the components on each axis — the `translate` itself, and what the registry is
 *  moved by. One place, so a fifth component cannot be forgotten in one of three sums. */
const sumX = (t: MarkTransform): number => t.x + t.nudgeX + t.anchor
const sumY = (t: MarkTransform): number => t.y + t.nudgeY + t.line

/** Write the composed transform, and move the registry box by the CHANGE it caused. */
function write(pass: RenderPass, id: string, el: SVGGraphicsElement, next: MarkTransform): void {
  const was = componentsOf(el)
  el.setAttribute(SHIFT_ATTR, `${next.x},${next.y}`)
  el.setAttribute(NUDGE_ATTR, `${next.nudgeX},${next.nudgeY}`)
  el.setAttribute(LINE_ATTR, `${next.line}`)
  el.setAttribute(ANCHOR_ATTR, `${next.anchor}`)
  el.setAttribute('transform', `translate(${sumX(next)}, ${sumY(next)})`)
  pass.elementRegistry.shiftById(id, sumX(next) - sumX(was), sumY(next) - sumY(was))
}

/**
 * Move a mark by a draw-time delta — the co-located row's x, or a hand nudge. ADDS to what is
 * already stored, because the two of them compose (a nudged mark inside a `p dolce` row keeps both).
 */
export function shiftDynamicMark(pass: RenderPass, id: string, el: SVGGraphicsElement, dx: number, dy: number): void {
  const was = componentsOf(el)
  write(pass, id, el, { ...was, x: was.x + dx, y: was.y + dy })
}

/**
 * Put the mark where the engraving says it goes: on the dynamics line, and — for a level — centred
 * on its notehead (`dynamicMarkAnchor`).
 *
 * Both SET rather than add: each is one absolute answer and this is their only writer, so re-running
 * the pass on a mark already in place is a no-op. That is what makes it safe to run over a measure
 * nobody re-engraved, whose element still carries last render's transform.
 */
/**
 * ⭐⭐ **WHAT THIS MARK HAS BEEN MOVED BY, as one pair of local px** — the sum of the three
 * components, which is exactly the `translate` on its group.
 *
 * 🚨 **Because `getBBox()` on the inner `<text>` is measured BEFORE that translate**, and every
 * reader that compares a mark's ink against something drawn elsewhere has to add it back. His
 * report, 2026-08-18: a wedge broken for a dynamic left *"more white on the right side"* — it was
 * cutting the hole around the box's UNMOVED position, so the whole hole sat one anchor-shift to the
 * right of the letter, overlapping its ink on one side and leaving a gap on the other.
 *
 * ⚠️ The centring `anchor` is the big term and the reason this bites LEVELS and not prose: a level
 * is pulled back by half its own width to straddle the notehead (`dynamicMarkAnchor`), a word is
 * anchored where it was drawn and shifts by nothing. That is his *"with text it is not a problem,
 * the problem is with the dynamic glyphs"*, exactly.
 *
 * ⛔ Not the CTM: this is the mark's OWN translate, in the same local space the caller is drawing
 * in. Anything above it (the measure group, the staff's `scale(k)`) is shared with the caller and
 * must not be counted.
 */
export function dynamicMarkTranslate(el: SVGGraphicsElement): { x: number; y: number } {
  const was = componentsOf(el)
  return { x: sumX(was), y: sumY(was) }
}

/**
 * ⭐⭐ **THE COMPOSER'S NUDGE — SET, never added** (client #8, `DynamicsLayout.applyDynamicOffsets`).
 *
 * ⚠️ Setting is what lets a PREVIEW re-apply it to a mark nobody re-engraved: the stored component and
 * the authored override are the same number, so running this over a mark already in place moves
 * nothing (`./dynamicNudgePass`, and `./tempoMarkTransform.setTempoMarkOffset` next door — the same
 * rule, arrived at the same way).
 *
 * ⛔ Not {@link shiftDynamicMark}, which ADDS and must: the co-located row's x composes with this
 * one, and each has to survive the other.
 */
export function setDynamicMarkNudge(
  pass: RenderPass,
  id: string,
  el: SVGGraphicsElement,
  x: number,
  y: number,
): void {
  write(pass, id, el, { ...componentsOf(el), nudgeX: x, nudgeY: y })
}

export function placeDynamicMark(
  pass: RenderPass,
  id: string,
  el: SVGGraphicsElement,
  place: { line: number; anchor: number },
): void {
  write(pass, id, el, { ...componentsOf(el), ...place })
}
