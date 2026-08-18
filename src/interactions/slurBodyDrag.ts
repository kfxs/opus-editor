/**
 * ⭐⭐ **DRAGGING THE ARC ITSELF** — the mouse twin of the arrows with nothing armed (his ask,
 * 2026-08-18: *"now the next step is doing this same offset controle by the drag mouse, similar to
 * hairpin"*), and the last of the four gestures a selected slur answers to.
 *
 * ⭐ **One curve, two categories, told apart by WHERE you grabbed it** — the hairpin's arrangement
 * exactly (`elements/hairpin.ts`): a HANDLE moves one point (an end through the music, or a control
 * point's bend), the BODY moves the whole drawing. That is the keyboard's own split arriving on the
 * mouse, and it means a press on the arc needs no new state: *something armed → that handle, nothing
 * armed → the whole thing* was already the rule.
 *
 * ⚠️ **Free pixels, and no walk.** The endpoint drag (`./slurEndpointWalk`) holds at each note and
 * re-anchors on arrival, because an endpoint HAS an anchor to arrive at. A whole-curve move has none —
 * it writes one cosmetic offset — so there is nothing to snap to, hold against, or latch onto, and the
 * cursor's delta goes straight through. ⛔ Do not give this gesture the hold: it would be a resistance
 * with nothing on the other side of it.
 *
 * The module exists for the two rules a caller keeps getting wrong, both proven by
 * `./slurBodyDrag.test.ts`: the SCALE must be measured (⛔ never a constant), and the anchor must NOT
 * advance on a refusal.
 */
import type { ElementRegistry } from '../engine/ElementRegistry'
import type { MusicEngine } from '../engine/MusicEngine'

/** What one frame needs off the engine — a Pick, so a spec can drive it with no renderer. */
export type SlurBodyDragEngine = Pick<MusicEngine, 'previewSlurOffset'>

/** Where the cursor was when the last ACCEPTED frame landed, plus the scale to convert with. */
export interface SlurBodyAnchor {
  /** SVG px. */
  x: number
  /** SVG px. */
  y: number
  /** Staff-line spacing in px on the staff the grabbed curve was drawn on — the px→staff-space
   *  divisor, measured at arm time. */
  staffSpacePx: number
}

/**
 * The staff-space size to convert this drag's pixels with, read off the DRAWN slur.
 *
 * ⛔ **No fallback constant**, `./slurEndpointWalk`'s rule and for its reason: the offset is stored in
 * staff-spaces, so a guessed scale silently moves a small staff's slur by the wrong amount (a small
 * staff is a RATIO, not a constant — `project_small_staff_spacing`). With nothing measured the press
 * stays an ordinary selection.
 *
 * ⚠️ It reads the `slur` entry rather than a `slur-handle`, deliberately: the handles are drawn only
 * for a SELECTED slur, and the first press on an unselected one arms this drag before the render that
 * would draw them. The arc itself is registered on every render. A cross-system slur registers one
 * entry per fragment, any of which answers — they are all the same curve, and the two ends' staves can
 * only differ in size, which the renderer converts per end anyway.
 */
export function slurBodyStaffSpacePx(registry: ElementRegistry, slurId: string): number | null {
  const drawn = registry.getByType('slur').filter(el => el.id === slurId)
  const measured = drawn.find(el => el.staffSpacePx !== undefined)?.staffSpacePx
  if (measured) return measured
  const first = drawn.find(el => el.measure !== undefined)
  if (!first || first.measure === undefined) return null
  return registry.getStaffGeometry(first.measure, first.staff ?? 0)?.lineSpacing ?? null
}

/**
 * ⭐ One frame: move the whole curve by the cursor's travel since the last accepted frame, and answer
 * with the anchor the NEXT frame should measure from.
 *
 * ⚠️ **On a refusal the anchor does not move** — `null` back, and the caller keeps the one it had.
 * The offset write accumulates, and both limits can refuse it (the page's edge, a neighbour's band),
 * so advancing the anchor through a refused stretch would bank the distance the curve never travelled
 * and jump it when the cursor came back. This is the hairpin body drag's rule; it is here in one
 * testable place because it is the half of a drag that is invisible until it is wrong.
 *
 * @returns the new anchor when the model changed, else null (refused, or a sub-pixel frame).
 */
export function slurBodyDragStep(
  engine: SlurBodyDragEngine,
  slurId: string,
  anchor: SlurBodyAnchor,
  x: number,
  y: number,
): SlurBodyAnchor | null {
  const dx = (x - anchor.x) / anchor.staffSpacePx
  const dy = (y - anchor.y) / anchor.staffSpacePx
  if (dx === 0 && dy === 0) return null
  if (!engine.previewSlurOffset(slurId, dx, dy)) return null
  return { x, y, staffSpacePx: anchor.staffSpacePx }
}
