/**
 * ⭐ **The group of a pitch drawn OUTSIDE its `StaveNote`** — a fan member's head (`beams/FanPass`) or a
 * grace note (`GracePass`). Both are filed in `RenderPass.fanMemberGroupMap`, which is how the selection
 * highlight finds their ink, so both need the DOM node back: ONE seam, one reach for the page
 * (`npm run lint:paint` counts it once).
 */
import type { DrawContext } from '@/engine/paint/DrawContext'
import { drawGroupOf, svgNode } from './painter/svgDrawGroup'
import type { Affine } from '@/engine/paint/Affine'

/** Open the group, and hand back its node for the highlight map (null off the page — a recording).
 *  ⭐ `placement` (a bracketed grace's `scaling(k)`) goes on THIS group, so every piece of its ink is a
 *  direct child — which is what the selection highlight walks (`interactions/elements/notePaint`). */
export function openMemberGroup(ctx: DrawContext, cls: string, id: string, placement?: Affine): SVGGElement | null {
  const group = drawGroupOf(ctx.openGroup(cls, id))
  if (placement) group?.setPlacement(placement)
  return svgNode(group) ?? null
}
