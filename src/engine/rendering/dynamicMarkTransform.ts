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

/** The draw-time shift: the co-located row's x, plus the hand nudge. `"x,y"`, local px. */
const SHIFT_ATTR = 'data-dyn-shift'
/** The dynamics line's own contribution, local px — see `dynamicsLinePass`. */
const LINE_ATTR = 'data-dyn-line'
/** Half a level's width, pulling it back onto its notehead — see `dynamicMarkAnchor`. */
const ANCHOR_ATTR = 'data-dyn-anchor'

/** What the mark's `transform` is made of. Its sum is `(x + anchor, y + line)`. */
interface MarkTransform {
  x: number
  y: number
  line: number
  anchor: number
}

const finite = (value: number): number => (Number.isFinite(value) ? value : 0)

/** What was last written to this element — all zeros for a freshly drawn one. */
function componentsOf(el: SVGGraphicsElement): MarkTransform {
  const [x, y] = (el.getAttribute(SHIFT_ATTR) ?? '').split(',').map(Number)
  return {
    x: finite(x),
    y: finite(y),
    line: finite(Number(el.getAttribute(LINE_ATTR))),
    anchor: finite(Number(el.getAttribute(ANCHOR_ATTR))),
  }
}

/** Write the composed transform, and move the registry box by the CHANGE it caused. */
function write(pass: RenderPass, id: string, el: SVGGraphicsElement, next: MarkTransform): void {
  const was = componentsOf(el)
  el.setAttribute(SHIFT_ATTR, `${next.x},${next.y}`)
  el.setAttribute(LINE_ATTR, `${next.line}`)
  el.setAttribute(ANCHOR_ATTR, `${next.anchor}`)
  el.setAttribute('transform', `translate(${next.x + next.anchor}, ${next.y + next.line})`)
  pass.elementRegistry.shiftById(
    id,
    next.x + next.anchor - (was.x + was.anchor),
    next.y + next.line - (was.y + was.line),
  )
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
  return { x: was.x + was.anchor, y: was.y + was.line }
}

export function placeDynamicMark(
  pass: RenderPass,
  id: string,
  el: SVGGraphicsElement,
  place: { line: number; anchor: number },
): void {
  write(pass, id, el, { ...componentsOf(el), ...place })
}
