/**
 * ⭐⭐ **THE BEAM'S INK — P4a** (`docs/plans/beam-engraving-plan.md`, `docs/plans/own-engraving-engine.md` P4).
 *
 * ## ⭐ What a beam IS, as ink
 *
 * > A **run of filled quads**, one per level, each a sloped top edge with the thickness applied
 * > downward — stacked at a fixed multiple of that thickness.
 *
 * That is the whole content of this module, and it is deliberately thin: everything interesting
 * about a beam is *which notes a line runs between* (the fractional beams) and *what SLOPE it
 * takes*, and neither is here. ⭐ Both now have an owner beside this file: the SIDE a fractional beam
 * points is `./fractionalBeam` (P4c, the four treatises' rule) and the slope's budget is
 * `./beamSlope` (P4b). ⛔ What is still VexFlow's is the x's themselves — `getBeamLines` — and a
 * stub's LENGTH.
 *
 * ## 🚨 Why the ink alone was worth a commit: it had FOUR owners
 *
 * | who filled a beam quad | for what |
 * |---|---|
 * | `Beam.drawBeamLines` (VexFlow) | every ordinary beam |
 * | `FanPass` | a feathered beam's levels |
 * | `ScoreRenderer.drawCrossBarSideBeam` | the half-beam hung over a system break |
 * | `ScoreRenderer.drawCrossBarLoneFragment` | the same, for a side of one note |
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
 * (`docs/plans/note-engraving-plan.md` §3). ⛔ So there is nothing here for his eye.
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
 * fourth (`rendering/EngravedBeam`) opens its own `beam` group around the whole run — the
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

/**
 * ⭐ **WHERE A BEAM LINE STARTS, relative to the stem it hangs on** — half a stem-width left of the
 * stem's own x, so the beam's edge is flush with the stem's edge rather than with its centre.
 *
 * ⚠️ It is VexFlow's number (`beam.js:515`) and P4a kept it, but the rule had **three owners**: theirs,
 * inside `getBeamLines`, and both cross-system fragments in `ScoreRenderer`, each spelling
 * `getStemX() - Stem.WIDTH / 2` by hand. ⭐ This is the one owner now: theirs went when the x's did
 * (S7d — `./beamLineSpans` is fed this).
 *
 * ⭐ Measured in a browser rather than merely transcribed: `e2e/beam.e2e.ts` asserts the drawn beam
 * clears its first stem by exactly this much.
 */
export function beamLineStartX(stemX: number, stemWidth: number): number {
  return stemX - stemWidth / 2
}

/**
 * ⭐⭐ **A RUN OF BEAM LINES BETWEEN TWO X'S — every level of a fragment, at one slope** (P4d).
 *
 * The two cross-system fragments (`ScoreRenderer.drawCrossBarSideBeam` and
 * `…LoneFragment`) each walked their own level loop, differing only in whether there was a slope to
 * continue. ⭐ That loop is this function, and the difference is the `levelY` argument: a side beam
 * passes its group's slope, a lone note passes the identity because it has no slope to continue.
 *
 * ⛔ **`EngravedBeam` deliberately does NOT use this**, and the reason is worth stating so nobody
 * "finishes the job" later: a real beam has a **different set of x-spans per level** (the hooks and
 * partial beams `getBeamLines` decides), while a fragment has **one span repeated across levels**.
 * Forcing both through one helper would mean an abstraction that fits neither.
 *
 * @param levelY maps a level's baseline y at an x — `(x, y) => y` for a flat stub.
 */
export function beamLevelRun(
  span: { startX: number; endX: number },
  firstLevelY: number,
  thickness: number,
  levels: number,
  levelY: (x: number, baselineY: number) => number,
): BeamLineInk[] {
  const run: BeamLineInk[] = []
  for (let level = 0; level < levels; level++) {
    const baseline = beamLevelY(firstLevelY, level, thickness)
    run.push({
      startX: span.startX,
      startY: levelY(span.startX, baseline),
      endX: span.endX,
      endY: levelY(span.endX, baseline),
    })
  }
  return run
}

/**
 * The box a run of beam lines actually inks — ⭐ **derived from the run, ⛔ not accumulated while
 * drawing it.** The lone fragment used to widen a `minY`/`maxY` pair inside its fill loop, which made
 * the hit box a side effect of painting: draw one fewer level and the box silently shrank.
 *
 * ⚠️ `thickness` is SIGNED by the stem direction (see {@link beamLevelY}), so the run's y's may be
 * either edge — hence the min/max over both.
 */
export function beamRunInkBox(
  run: readonly BeamLineInk[],
  thickness: number,
): { x: number; y: number; width: number; height: number } | null {
  if (!run.length) return null
  const xs = run.flatMap(l => [l.startX, l.endX])
  const ys = run.flatMap(l => [l.startY, l.startY + thickness, l.endY, l.endY + thickness])
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y }
}
