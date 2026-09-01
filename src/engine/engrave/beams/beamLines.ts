/**
 * ⭐⭐ **THE BEAM'S INK — P4a** (`docs/beam-engraving-plan.md`, `docs/own-engraving-engine.md` P4).
 *
 * ## ⭐ What a beam IS, as ink
 *
 * > A **run of filled quads**, one per level, each a sloped top edge with the thickness applied
 * > downward — stacked at a fixed multiple of that thickness.
 *
 * That is the whole content of this module, and it is deliberately thin: everything interesting
 * about a beam is *which notes a line runs between* (the hooks and partial beams) and *what SLOPE it
 * takes*, and neither is here. ⛔ Both are still VexFlow's, and taking them is the next piece of work
 * rather than an oversight — `own-engraving-engine.md` §6.1 lists beam hooks among the places
 * *"where we currently have no opinion"*, and a re-implementation without an opinion is strictly
 * worse than a dependency.
 *
 * ## 🚨 Why the ink alone was worth a commit: it had FOUR owners
 *
 * | who filled a beam quad | for what |
 * |---|---|
 * | `Beam.drawBeamLines` (VexFlow) | every ordinary beam |
 * | `FanPass` | a feathered beam's levels |
 * | `VexFlowRenderer.drawCrossBarSideBeam` | the half-beam hung over a system break |
 * | `VexFlowRenderer.drawCrossBarLoneFragment` | the same, for a side of one note |
 *
 * ⭐ The last three already shared {@link fillBeamQuad} — it was extracted from the renderer for
 * exactly that reason — so the tell (§3.1's *"the second owner is the tell"*) was the odd one out:
 * **VexFlow's copy was the only beam in this editor not drawn by our own primitive.** The quad now
 * lives here, beside the two numbers the other three had been re-deriving.
 *
 * ⭐⭐ And the LEVEL STACK is the second thing that was copied rather than shared: `beamY0 + k *
 * thickness * 1.5` appears in VexFlow's loop and twice more in the cross-barline fragments.
 * {@link beamLevelY} is now its one owner.
 */
import type { DrawContext } from '@/engine/paint/DrawContext'

/**
 * One beam line as ink: its TOP edge, from one stem to another. ⛔ No level, no duration, no
 * direction — the y's carry the slope and the thickness carries the way up.
 */
export interface BeamLineInk {
  startX: number
  startY: number
  endX: number
  endY: number
}

/**
 * ⭐ **How far apart two levels of one beam sit, as a multiple of the beam's own thickness.**
 *
 * 1.5 — a beam thickness of ink and half of one as air. It is VexFlow's number
 * (`beam.js`: `beamY += beamThickness * 1.5`), and the three hand-drawn beam fragments in this
 * editor had each copied it.
 *
 * ⭐⭐ **And for once the two sources AGREE.** Bravura states the same distance as a pair —
 * `beamSpacing` 0.25 spaces of air against `beamThickness` 0.5 (`fonts/bravuraMetrics`) — and
 * (0.5 + 0.25) / 0.5 is exactly this 1.5. ⚠️ Worth saying out loud because it is the FIRST number in
 * this migration where the room we reserve and the ink we draw came from two sources and matched:
 * the ledger overhang, the stem's thickness and the notehead's glyph table all disagree
 * (`docs/note-engraving-plan.md` §3). ⛔ So there is nothing here for his eye.
 */
export const BEAM_LEVEL_STRIDE = 1.5

/**
 * The y at which level `level` of a beam sits, given the first level's y.
 *
 * ⚠️ `thickness` is SIGNED by the stem direction, exactly as its callers hold it: a stem-down beam
 * stacks upward from the top line, and that fact lives in the sign rather than in a branch.
 */
export function beamLevelY(firstLevelY: number, level: number, thickness: number): number {
  return firstLevelY + level * thickness * BEAM_LEVEL_STRIDE
}

/**
 * ⭐ Fill one beam quad, from the vertices `drawBeamLines` uses (`beam.js`): the top edge start→end,
 * the thickness applied downward.
 *
 * ⛔ **Opens no group.** Three of its four callers have no beam object to name one after, and the
 * fourth (`rendering/EngravedBeam`) opens VexFlow's own `beam` group around the whole run — the
 * group belongs to the OBJECT's identity, as it does for a stem.
 */
export function fillBeamQuad(
  ctx: DrawContext,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  thickness: number,
): void {
  ctx.beginPath()
  ctx.moveTo(startX, startY)
  ctx.lineTo(startX, startY + thickness)
  ctx.lineTo(endX, endY + thickness)
  ctx.lineTo(endX, endY)
  ctx.closePath()
  ctx.fill()
}

/** ⭐ Fill a whole beam's lines — every level of it, at one thickness. */
export function drawBeamLines(
  ctx: DrawContext,
  lines: readonly BeamLineInk[],
  thickness: number,
): void {
  for (const line of lines) {
    fillBeamQuad(ctx, line.startX, line.startY, line.endX, line.endY, thickness)
  }
}
