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
 * 🚨 **But a PREVIEW re-engraves nothing** (docs/history/render-performance-plan.md §12.5a). A mark drag
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
import type { EngravedStave } from './EngravedStave'
import type { Column } from '@/engine/layout/spacing'
import type { RenderPass } from './RenderPass'
import { tempoOffsetOverrideOf } from '@/engine/models/engravingOverrides'
import { setTempoMarkBase, setTempoMarkOffset } from './tempoMarkTransform'
import { tempoAnchorTravelPx } from './tempoAnchorInk'
import { staffSpacesToPixels } from './staffSpace'
import { dbg } from '@/utils/debug'
import { staveFrame } from './staveFrame'

/** What this pass needs of a `MeasurePlacement` — the shape `./tempoLinePass` already declares. */
interface TempoNudgePlacement {
  view: Measure
  measureNumber: number
  staffIndex: number
  line: number
  system: { columns: Column[] }
  stave: EngravedStave
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
  const svg = pass.painter?.svg as SVGSVGElement | undefined
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
        const el = svg.querySelector(`[id="${mark.id}"]`) as SVGGraphicsElement | null
        if (!el) continue

        // ⭐⭐ **THE ANCHOR'S OWN TRAVEL, and it is the half this pass used to be missing**
        // (`./tempoAnchorInk`, 2026-08-31). A crossing moves the mark's base and its offset together
        // so the drawing stands still; the glyph's base is baked in at draw time, so a preview that
        // wrote only the offset put the mark back on the beat it was engraved at. ⛔ A null is
        // "the picture cannot say" and the mark is left exactly where it is — `./markPreviewPass`
        // asks the same question first and refuses the whole frame, so this is the belt to that
        // brace and ⛔ never a 0 guessed in its place.
        //
        // ⚠️ PAGE pixels out of the registry, LOCAL pixels into the transform (it rides inside the
        //    staff's `scale(k)` group) — the one conversion, and it is the same `scale` the registry
        //    is told to apply back.
        const travel = tempoAnchorTravelPx(pass, mark.id)
        if (travel === null) continue

        // 🚨 `offset.y` is OUTWARD (+up), the one offset in the compartment that is. Screen y grows
        //    downward, so it is negated exactly here — the same negation `drawTempoMarks` makes.
        const offset = tempoOffsetOverrideOf(pass.score, mark.id)
        const base = travel / (placement.scale || 1)
        const x = staffSpacesToPixels(offset?.x ?? 0, staveFrame(placement.stave))
        // ⚠️ EXPLORATORY INSTRUMENT (2026-08-31) — the two halves and their sum, per frame. His
        // report survives a trace that says the model is perfect, and BOTH his logs put the whole
        // residual in the FIRST accepted frame (46px against a 45.7px first move; 1px against 1.4px).
        // So the question is now which half this pass wrote on that frame, and only this can say.
        dbg(`[Preview] tempo ${mark.id}: base+travel ${travel.toFixed(1)}px (scale ${placement.scale})`
          + ` + offset ${(offset?.x ?? 0).toFixed(3)}ss → transform x ${(x + base).toFixed(1)} local px`)
        // ⭐⭐ **TWO COMPONENTS, ⛔ not one sum** (2026-08-31, his report: *"the anchor line is not
        //    updating during the drag"*). They land in the same translate, but only the BASE moves
        //    what the mark is attached to — so the attachment guide's far end follows that one and
        //    ignores the nudge, which is `./tempoMarkTransform`'s whole reason for keeping them apart.
        setTempoMarkBase(pass, mark.id, el, base)
        setTempoMarkOffset(pass, mark.id, el, x,
          staffSpacesToPixels(-(offset?.y ?? 0), staveFrame(placement.stave)))
      }
    })
  }
}
