/**
 * ⭐ **A GLYPH'S INK AS A SHAPE, not a box** — its drawn ink box minus the corners the FONT says are
 * empty (SMuFL's `cutOutNE` / `cutOutNW` / `cutOutSE` / `cutOutSW` anchors, read from our own metrics
 * tables — `fonts/fontMetrics.anchor`). No outline is loaded and nothing is baked: the box is the stamp's
 * own (`EngravedAccidental.drawnInk`), the cut-outs are the font's published data.
 *
 * Why (his report, 2026-09-25 — a glissando stopping short of a ♯): a sharp's crossbars slope up, so its
 * box's lower-left corner holds no ink; measured from the box, a line looked half a space off the sign
 * while being 0.3 sp from the rectangle. *"Don't use bbox, use ink for measure."*
 *
 * Pure: px in, px out, y DOWN (the page's).
 */
import { anchor, glyphBox, type GlyphName } from '@/engine/fonts/fontMetrics'

/** A rectangle of ink, px. */
export interface InkRect {
  left: number
  right: number
  top: number
  bottom: number
}

/**
 * The glyph's ink as rectangles: `box` (its drawn ink box, px) cut by the font's cut-out corners, in
 * horizontal bands. A glyph with no cut-outs is its box.
 */
export function glyphInkShape(
  name: GlyphName,
  box: { x: number; y: number; width: number; height: number },
): InkRect[] {
  const whole: InkRect = { left: box.x, right: box.x + box.width, top: box.y, bottom: box.y + box.height }
  const g = glyphBox(name)
  const tall = g.up + g.down
  if (!(tall > 0)) return [whole]
  const sp = box.height / tall
  const originX = box.x - g.left * sp
  const baselineY = box.y + g.up * sp
  // Each corner, where it is: its x and its y on the page, and which side / end of the box it empties.
  const corner = (which: string) => {
    const a = anchor(name, which)
    return a ? { x: originX + a[0] * sp, y: baselineY - a[1] * sp } : null
  }
  const nw = corner('cutOutNW'), sw = corner('cutOutSW'), ne = corner('cutOutNE'), se = corner('cutOutSE')
  if (!nw && !sw && !ne && !se) return [whole]

  const cuts = [whole.top, whole.bottom, nw?.y, sw?.y, ne?.y, se?.y]
    .filter((y): y is number => y !== undefined && y >= whole.top && y <= whole.bottom)
    .sort((a, b) => a - b)
  const rects: InkRect[] = []
  for (let i = 0; i + 1 < cuts.length; i++) {
    const top = cuts[i], bottom = cuts[i + 1]
    if (bottom - top <= 1e-9) continue
    const mid = (top + bottom) / 2
    // A NORTH corner empties the band above its y; a SOUTH one the band below it.
    let left = whole.left, right = whole.right
    if (nw && mid < nw.y) left = Math.max(left, nw.x)
    if (sw && mid > sw.y) left = Math.max(left, sw.x)
    if (ne && mid < ne.y) right = Math.min(right, ne.x)
    if (se && mid > se.y) right = Math.min(right, se.x)
    if (right > left) rects.push({ left, right, top, bottom })
  }
  return rects.length ? rects : [whole]
}

/** The distance from a point to the nearest ink of a shape, px — 0 inside it. */
export function distanceToInk(x: number, y: number, shape: readonly InkRect[]): number {
  let best = Infinity
  for (const r of shape) {
    const d = Math.hypot(Math.max(r.left - x, 0, x - r.right), Math.max(r.top - y, 0, y - r.bottom))
    if (d < best) best = d
  }
  return best
}
