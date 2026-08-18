/**
 * A SLUR — the phrasing arc. Hit-tested against the sampled CURVE, not its bbox.
 *
 * ⚠️ Only the ARC is here. A slur's endpoint HANDLES are a pre-step drag in `MouseController`
 * (they run before the selection is cleared, so the slur they belong to stays selected through the
 * gesture) — which is why `slur` appears twice in the press path but once in this chain.
 */
import { dbg } from '@/utils/debug'
import type { ClickableElementSpec } from './chain'

/** Shortest distance from point (px,py) to the line segment a→b (clamped to the
 *  segment, so endpoints don't over-grab). Used for arc-proximity slur hit-testing. */
export function distToSegment(
  px: number, py: number,
  a: { x: number; y: number }, b: { x: number; y: number },
): number {
  const dx = b.x - a.x, dy = b.y - a.y
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return Math.hypot(px - a.x, py - a.y)
  let t = ((px - a.x) * dx + (py - a.y) * dy) / lenSq
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy))
}

export const SLUR_ELEMENT: ClickableElementSpec = {
  kind: 'slur',
  /** Select a slur arc for removal (hit-tested against the sampled curve points). */
  hit({ registry, x, y }, deps) {
    // Slur selection — hit-test by proximity to the ARC, not the coarse bbox
    // rectangle (which sits over the spanned notes). Clicking near the curve selects
    // it; Delete removes the arc (never the notes). We measure distance to the line
    // SEGMENTS between consecutive sampled points (a continuous ribbon along the
    // curve), not to the discrete points — otherwise wide arcs (cross-system BEGIN/
    // MIDDLE/END segments span a whole system, so the fixed ~17 samples sit tens of
    // px apart) would only be clickable right on a sample dot.
    const slurPad = 7
    const slurAt = registry.getByType('slur').find(el => {
      const pts = el.points
      if (!pts?.length) return false
      if (pts.length === 1) return (x - pts[0].x) ** 2 + (y - pts[0].y) ** 2 <= slurPad * slurPad
      for (let i = 1; i < pts.length; i++) {
        if (distToSegment(x, y, pts[i - 1], pts[i]) <= slurPad) return true
      }
      return false
    }) ?? null
    if (!slurAt?.id) return false

    dbg(`✓ Slur selected | id:${slurAt.id}`)
    // Selecting the slur by its arc disarms any previously-armed endpoint nudge — clicking
    // a blue (true end) or orange (open join) square is the only thing that re-arms one. Carrying
    // no endpoint IS that, now the two live in one value.
    return deps.pick({ kind: 'slur', id: slurAt.id })
  },

  // The arc is already coloured by the set pass; the handles are the single-click extra — and,
  // once one of the blue squares is ARMED, the note that square is anchored to wears the same blue,
  // so a keyboard re-anchor is visible as the tint moving on (`applyArmedSlurAnchorNote`).
  highlight: h => {
    h.applySlurHandles()
    h.applyArmedSlurAnchorNote()
  },
}
