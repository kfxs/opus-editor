/**
 * ⭐ **WHERE A TEMPO MARK'S GROUP IS TRANSLATED TO — one owner, one absolute write.**
 *
 * `./dynamicMarkTransform`'s twin, and it exists for the same reason at the same moment in the
 * family's life: a second pass started moving the mark. Until 2026-08-19 there was exactly one —
 * the ladder (`./tempoLinePass`), which owned the whole `transform` and kept its contribution in an
 * attribute so it could be re-run over a measure nobody re-engraved. The hand NUDGE (client #13,
 * `TempoOffsetOverride`) is the second, and two writers of one attribute is how a mark ends up
 * walking down the page one keystroke at a time.
 *
 * ⭐ **The fix is to keep the COMPONENTS, not the sum.** Each contribution is stored on the element
 * itself and every write recomposes the whole transform, so both passes are idempotent and a reused
 * mark is corrected by exactly the change — with no arithmetic on transform strings.
 *
 * ⚠️ Why on the ELEMENT and not on the `RenderPass`: a reused measure's mark is precisely the case
 * where the pass state was thrown away and the DOM node was not.
 *
 * ⚠️ Every delta here is LOCAL — the translate rides inside the staff's `scale(k)` group — so the
 * registry is told in the same units and applies the scale itself ({@link ElementRegistry.shiftById}).
 */
import type { RenderPass } from './RenderPass'

/** The tempo LINE's contribution — the row the ladder gave this mark, local px. */
const LINE_ATTR = 'data-tempo-line'
/** The hand nudge, `"x,y"` in local px — client #13. */
const OFFSET_ATTR = 'data-tempo-offset'

/** What the mark's `transform` is made of. Its sum is `(x, y + line)`. */
interface MarkTransform {
  x: number
  y: number
  line: number
}

const finite = (value: number): number => (Number.isFinite(value) ? value : 0)

/** What was last written to this element — all zeros for a freshly drawn one. */
function componentsOf(el: SVGGraphicsElement): MarkTransform {
  const [x, y] = (el.getAttribute(OFFSET_ATTR) ?? '').split(',').map(Number)
  return { x: finite(x), y: finite(y), line: finite(Number(el.getAttribute(LINE_ATTR))) }
}

/** Write the composed transform, and move the registry box by the CHANGE it caused. */
function write(pass: RenderPass, id: string, el: SVGGraphicsElement, next: MarkTransform): void {
  const was = componentsOf(el)
  el.setAttribute(OFFSET_ATTR, `${next.x},${next.y}`)
  el.setAttribute(LINE_ATTR, `${next.line}`)
  el.setAttribute('transform', `translate(${next.x}, ${next.y + next.line})`)
  pass.elementRegistry.shiftById(id, next.x - was.x, next.y + next.line - (was.y + was.line))
}

/**
 * Put the mark on its row — the ladder's answer (`./tempoLinePass`).
 *
 * ⭐ **SET, never add.** This pass runs over measures nobody re-engraved, whose group still carries
 * the last render's transform; prepend or accumulate there and the mark walks up the page one row's
 * worth per keystroke, with the hit-box walking with it.
 */
export function placeTempoMark(pass: RenderPass, id: string, el: SVGGraphicsElement, line: number): void {
  write(pass, id, el, { ...componentsOf(el), line })
}

/**
 * Move the mark by the composer's own nudge (client #13, his ask 2026-08-19), in local px.
 *
 * ⭐ **SET rather than add, unlike the dynamic's `shiftDynamicMark`** — and the difference is in what
 * the caller holds, not in the mark. A dynamic's draw-time shift is TWO things that compose (the
 * co-located row's x and the nudge), so its writer adds; a tempo mark has one, read whole out of the
 * override, so the stored component and the authored value are the same number. Setting it is what
 * makes a re-draw of the same bar idempotent.
 */
export function setTempoMarkOffset(
  pass: RenderPass,
  id: string,
  el: SVGGraphicsElement,
  x: number,
  y: number,
): void {
  write(pass, id, el, { ...componentsOf(el), x, y })
}
