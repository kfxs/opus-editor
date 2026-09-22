/**
 * ⭐ **The group of a pitch drawn OUTSIDE its `StaveNote`** — a fan member's head (`beams/FanPass`) or a
 * grace note (`GracePass`). Both are filed in `RenderPass.fanMemberGroupMap`, which is how the selection
 * highlight finds their ink, so both need the DOM node back: ONE seam, one reach for the page
 * (`npm run lint:paint` counts it once).
 */
import type { DrawContext } from '@/engine/paint/DrawContext'
import { drawGroupOf, svgNode } from './painter/svgDrawGroup'

/** Open the group, and hand back its node for the highlight map (null off the page — a recording). */
export function openMemberGroup(ctx: DrawContext, cls: string, id: string): SVGGElement | null {
  return svgNode(drawGroupOf(ctx.openGroup(cls, id))) ?? null
}
