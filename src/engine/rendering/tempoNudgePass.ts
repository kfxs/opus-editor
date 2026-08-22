/**
 * ⭐⭐ **THE COMPOSER'S NUDGE, RE-APPLIED TO MARKS NOBODY RE-ENGRAVED** — `./tempoLinePass`'s twin,
 * and the half of a tempo mark's transform that pass does not own.
 *
 * ## Why this exists
 *
 * A tempo mark's `transform` is composed of two contributions kept on the element itself
 * (`./tempoMarkTransform`): the LADDER's row, written by `./tempoLinePass` over every measure drawn
 * or reused; and the composer's own nudge (`TempoOffsetOverride`, client #13), written by
 * `TempoLayout.drawTempoMarks` **at draw time**.
 *
 * ⚠️ Draw time is correct and deliberate — `MeasureRedrawKey` folds each mark's overrides into its
 * bar's shape key, so a nudge re-engraves that bar and the line runs again. ⛔ Leave it out of the
 * key and the offset moves in the JSON while the mark sits still, which is the dynamic's recorded
 * lesson of 2026-07-18 (`reference_render_width_key_vs_shape_key`).
 *
 * 🚨 **But a PREVIEW re-engraves nothing** (docs/render-performance-plan.md §12.5a). A mark drag
 * changes exactly that override, and the one writer of it is inside the bar draw the preview exists
 * to skip. Without this pass the frame would move the mark's ROW and leave its nudge on the last
 * render's value — the mark would follow the hand vertically down the ladder and refuse to follow it
 * sideways at all.
 *
 * ⭐ **So it is not a second writer.** It is the same call `drawTempoMarks` makes, reached by id
 * instead of by having just drawn the group, and safe to run over a mark that is already right
 * because `setTempoMarkOffset` SETS the component rather than adding to it. Running this pass on a
 * finished full render is a no-op that touches two attributes per mark.
 *
 * ⛔ It does NOT own the row. Run `./tempoLinePass` after it, exactly as `renderScore` does — the row
 * is a fact about the mark's system and this is a fact about the mark.
 */
import type { Measure } from '@/types/music'
import type { Stave } from 'vexflow'
import type { Column } from '@/engine/layout/spacing'
import type { RenderPass } from './RenderPass'
import { tempoOffsetOverrideOf } from '@/engine/models/engravingOverrides'
import { setTempoMarkOffset } from './tempoMarkTransform'
import { staffSpacesToPixels } from './staffSpace'

/** What this pass needs of a `MeasurePlacement` — the shape `./tempoLinePass` already declares. */
export interface TempoNudgePlacement {
  view: Measure
  measureNumber: number
  staffIndex: number
  line: number
  system: { columns: Column[] }
  stave: Stave
  scale: number
}

/**
 * Re-apply every tempo mark's stored nudge to the group it is already drawn in.
 *
 * Pure no-op without a DOM, like every other pass that repositions rendered SVG.
 */
export function applyTempoNudges(
  pass: RenderPass,
  placements: readonly TempoNudgePlacement[],
): void {
  const svg = pass.context?.svg as SVGSVGElement | undefined
  if (!svg) return

  // 🚨 From the SCORE, ⛔ never `placement.view.tempos` — `tempoOps` replaces the property slot a
  //    lane view copied (`delete measure.tempos`, `target.tempos = []`), so a mark dragged into a bar
  //    that had none is invisible to a stale view. `./tempoLinePass` carries the full note.
  const byNumber = new Map(pass.score.measures.map(m => [m.number, m]))

  for (const placement of placements) {
    // Engraved once per system above the TOP staff — `drawTempoMarks`' own rule, and this must agree
    // with it or a grand staff nudges a mark that was never drawn there.
    if (placement.staffIndex !== 0) continue
    const tempos = byNumber.get(placement.measureNumber)?.tempos
    if (!tempos?.length) continue

    pass.elementRegistry.withScale(placement.scale, () => {
      for (const mark of tempos) {
        if (mark.id === pass.suppressedTempoId) continue // drawn by the text overlay instead
        if (!mark.text) continue // nothing printed (a mark that only sounds)

        // Scoped to THIS render's root, ⛔ not `document`: ids repeat across a torn-down SVG and a
        // document-wide lookup answers with the first in tree order
        // (`reference_vexflow_getsvgelement_is_document_wide`).
        const el = svg.querySelector(`#vf-${mark.id}`) as SVGGraphicsElement | null
        if (!el) continue

        // 🚨 `offset.y` is OUTWARD (+up), the one offset in the compartment that is. Screen y grows
        //    downward, so it is negated exactly here — the same negation `drawTempoMarks` makes.
        const offset = tempoOffsetOverrideOf(pass.score, mark.id)
        setTempoMarkOffset(pass, mark.id, el,
          staffSpacesToPixels(offset?.x ?? 0, placement.stave),
          staffSpacesToPixels(-(offset?.y ?? 0), placement.stave))
      }
    })
  }
}
