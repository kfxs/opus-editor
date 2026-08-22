/**
 * ⭐⭐ **THE COMPOSER'S NUDGE, RE-APPLIED TO MARKS NOBODY RE-ENGRAVED** — `./dynamicsLinePass`'s twin,
 * and `./tempoNudgePass`'s: the same module, one family over.
 *
 * ## Why this exists
 *
 * A dynamic's `transform` is composed of four contributions kept on the element itself
 * (`./dynamicMarkTransform`): the co-located row's shift and the composer's nudge, both written
 * inside the bar draw; and the LINE's row and the centring anchor, written by `./dynamicsLinePass`
 * over every measure drawn or reused.
 *
 * ⚠️ Draw time is correct and deliberate for the nudge — `MeasureRedrawKey` folds each mark's
 * overrides into its bar's shape key, so a nudge re-engraves that bar and the line pass runs again.
 * ⛔ Leave it out of the key and the offset moves in the JSON while the mark sits still, which is the
 * dynamic's own recorded lesson of 2026-07-18 (`reference_render_width_key_vs_shape_key`).
 *
 * 🚨 **But a PREVIEW re-engraves nothing** (docs/render-performance-plan.md §12.5a). A dynamic drag
 * changes exactly that override, and the one writer of it is inside the bar draw the preview exists
 * to skip. Without this pass the frame would move the mark's ROW and leave its nudge on the last
 * render's value — the mark would follow the hand down the line and refuse to follow it sideways.
 *
 * ⭐ **So it is not a second writer.** It is the same call `applyDynamicOffsets` makes, reached by id
 * instead of by having just drawn the annotation, and safe to run over a mark already right because
 * `setDynamicMarkNudge` SETS its component rather than adding to it. Running this pass on a finished
 * full render is a no-op that touches two attributes per mark.
 *
 * ⛔ It does NOT own the row. Run `./dynamicsLinePass` after it, exactly as `renderScore` does — the
 * row is a fact about the mark's SYSTEM and this is a fact about the mark.
 */
import type { Measure } from '@/types/music'
import type { Stave } from 'vexflow'
import type { RenderPass } from './RenderPass'
import { staffDynamics } from '@/engine/models/staffContent'
import { dynamicOffsetOverrideOf } from '@/engine/models/engravingOverrides'
import { setDynamicMarkNudge } from './dynamicMarkTransform'
import { staffSpacesToPixels } from './staffSpace'

/** What this pass needs of a `MeasurePlacement` — the shape `./dynamicsLinePass` already declares. */
export interface DynamicNudgePlacement {
  view: Measure
  staffIndex: number
  stave: Stave
  scale: number
}

/**
 * Re-apply every dynamic's stored nudge to the annotation it is already drawn in.
 *
 * Pure no-op without the marks' elements, like every other pass that repositions rendered SVG.
 */
export function applyDynamicNudges(
  pass: RenderPass,
  placements: readonly DynamicNudgePlacement[],
  staffIds: readonly (string | undefined)[],
): void {
  for (const placement of placements) {
    // 🚨 From the SCORE, ⛔ never `placement.view.dynamics` — a `view` is a lane copy taken during the
    //    render (`staffMeasureView`), so a mark dragged onto this staff after it, or into a bar that
    //    had none, is invisible to it. The same filter the view itself used, applied to the live
    //    score. (`./dynamicsLinePass` carries the full note.)
    const measure = pass.score.measures.find(m => m.number === placement.view.number)
    if (!measure) continue
    const dynamics = staffDynamics(measure, staffIds[placement.staffIndex], pass.score)
    if (!dynamics.length) continue

    // The translate is local to the staff's scale group; the registry is told in the same units.
    pass.elementRegistry.withScale(placement.scale, () => {
      for (const dyn of dynamics) {
        if (dyn.id === pass.suppressedDynamicId) continue // drawn by the text overlay instead
        const el = pass.dynamicObjectMap.get(dyn.id)?.getSVGElement?.() as SVGGraphicsElement | undefined
        if (!el) continue

        // ⭐ ALWAYS written, including the zero: a drag that walks the mark onto its next slot lands
        //   the offset back at 0, and a pass that skipped that case would leave the previous frame's
        //   nudge standing on an element nobody redrew.
        const offset = dynamicOffsetOverrideOf(pass.score, dyn.id)
        setDynamicMarkNudge(pass, dyn.id, el,
          staffSpacesToPixels(offset?.x ?? 0, placement.stave),
          staffSpacesToPixels(offset?.y ?? 0, placement.stave))
      }
    })
  }
}
