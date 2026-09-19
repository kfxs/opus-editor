/**
 * ⭐⭐ **THE LINE THAT OPENS A STAVE, AS INK — P5b's last piece of drawing**
 * (`docs/own-engraving-engine.md` P5; the seam is `rendering/EngravedBarline`).
 *
 * ⚠️ **It is not one of the barlines `BarlineRenderer` draws, and that is a statement about the
 * MARK rather than about this repo's history.** Every line that *divides two bars* — plain, final,
 * both repeats — is a SIGN at a boundary, and the pass that owns them exists because a boundary's
 * two neighbours have to agree on who draws it (`rendering/BarlineRenderer`, §3.2's *ONE OWNER PER
 * LINE*). This line divides nothing: it CLOSES the staff on its left, has no neighbour to agree
 * with, and is drawn once per system rather than once per bar. ⇒ it is part of the STAVE, which is
 * why it lives beside {@link module:engine/engrave/staff/staffLines} and not in `layout/barlineSign`.
 *
 * ## ⭐ THE RULE — three sentences, and each was a scattered fact before
 *
 * 1. **It runs between the two outer lines' MIDDLES** — ⛔ not their outer edges, so the staff lines'
 *    outer halves stick out past it rather than the other way round. That rule is
 *    {@link module:engine/engrave/staff/barlineExtent}'s, shared with every other vertical line in the
 *    score, and the two ys arrive here already resolved by it (see the ⚠️ below).
 * 2. **`x` IS the boundary, and the ink grows RIGHTWARD from it** — ⛔ it is not centred on it.
 *    That was `barlineInk.inkBarlines`' finding and its words are kept because the reasons are all
 *    still true: *"in this renderer `x` IS the bar boundary — the spacing model measures the lead-in
 *    from it, the registry's `noteEndX` hit-box is placed at it, the selection highlight paints from
 *    it, and `barWidth.e2e` asserts a drawn barline sits at the stave's own `x2`. Centring the line
 *    on the boundary would be the engraver's reading of 'where the line is', and it would put every
 *    one of those 0.3 px out of agreement with the ink for no visible gain."*
 * 3. **It is a FILLED BAR** of {@link OpeningBarlineInk.thickness}, ⛔ not a stroked path — which is
 *    the opposite choice from the staff lines beside it, and deliberate: `g.stavebarline rect` is
 *    what `barlineInk.hintBarlines`, `dev/barlineCensus` and three e2e specs read a barline back out
 *    of, exactly as `g.stave path` is what they read a staff line out of.
 *
 * ⚠️ **The THICKNESS is an ARGUMENT, ⛔ not a number chosen here** — P3b's flag-reach precedent. Its
 * owner is the thin-line family (`rendering/thinLineWeight.THIN_LINE_SPACES`, read from the font's
 * `thinBarlineThickness`), and a barline that picked its own would be the drift that family exists
 * to stop. ⭐ What this module owns is only *where the ink goes once you have one*.
 *
 * ## ⛔ What this does NOT take
 *
 * ⛔ **The x.** It is still `Stave.format()`'s BEGIN-modifier walk — the *"`headerInk` MEASURES,
 * `Stave` PLACES"* pair P5 is named after, and the rest of P5b.
 *
 * ⛔ **The HINTING** — snapping that x onto whole device pixels so every barline in the score reads
 * the same weight (`barlineInk.hintBarlines`). It is a pass over the drawn page, it moves the ink of
 * marks four other modules drew, and it belongs to the page rather than to this line.
 *
 * ⛔ **The other barline TYPES.** `Barline` can also draw `DOUBLE`, `END` and the two repeats, and
 * none of them is transcribed here: this repo overruled every one of those rules years of pixels ago
 * (`BarlineRenderer`'s header — the thick line's 3 px literal, the fixed pixel layout, the dots'
 * ≈0.1-space fudge, none of it scaling with its staff). ⭐ **Porting them in would import a rule we
 * have already replaced**, which is the one thing a migration step must not do; the seam leaves them
 * with VexFlow, where nothing this repo builds can reach them.
 */
import type { DrawContext } from '@/engine/paint/DrawContext'

/**
 * One opening barline's ink — the bar it occupies, ⛔ not the boundary it stands on.
 *
 * ⚠️ `topY`/`bottomY` arrive RESOLVED, for the reason the meter's baselines do: where a barline stops
 * is `staff/barlineExtent`'s rule and which lines a stave has is the stave's own arithmetic —
 * ⛔ neither is a thing this module gets to restate.
 *
 * ✅ **They used to be `Stave.getTopLineTopY()` / `getBottomLineBottomY()`, and the second of those is
 * what made the rule need an owner**: it is `getYForLine(last) + (getStyle().lineWidth ?? 1)`, a hard
 * **1** — VexFlow's staff-line thickness, which stopped being ours when P5c made a staff line 1.1 px,
 * and which `systemStart` had hand-written a second copy of. ⭐ The 0.1 px that fell out of that is
 * gone with the constant; what replaced it is a rule with three engines behind it, ⛔ not a repaired
 * number.
 */
export interface OpeningBarlineInk {
  /** ⭐ The BOUNDARY. The ink runs from here to `x + thickness`. */
  x: number
  topY: number
  bottomY: number
  thickness: number
}

/** The ink of one opening barline, stated by the rule above. */
export function openingBarlineInk(
  x: number,
  topY: number,
  bottomY: number,
  thickness: number,
): OpeningBarlineInk {
  return { x, topY, bottomY, thickness }
}

/**
 * ⭐ **THE INK** — one filled bar, opening no group.
 *
 * ⛔ Opens none for the reason `stampMeter` opens none: it is the entry point for a caller that owns
 * the group the ink lands in. {@link drawOpeningBarline} is the one that wraps.
 */
export function stampOpeningBarline(ctx: DrawContext, ink: OpeningBarlineInk): void {
  ctx.fillRect(ink.x, ink.topY, ink.thickness, ink.bottomY - ink.topY)
}

/**
 * ⭐ The line as a stave modifier draws it: the bar inside its own group.
 *
 * 🚨 **The group is load-bearing and must keep its id and class.** `g.stavebarline rect` is what
 * `barlineInk.hintBarlines` snaps onto the device-pixel grid, what `dev/barlineCensus` counts, and
 * what `e2e/harness.ts`'s barline reader returns; the id is how `ElementRegistry`'s box resolves back
 * to this ink. ⇒ this reproduces `Barline.draw`'s `openGroup('stavebarline', id)` exactly.
 */
export function drawOpeningBarline(
  ctx: DrawContext,
  ink: OpeningBarlineInk,
  groupId?: string,
): void {
  ctx.openGroup('stavebarline', groupId)
  try {
    stampOpeningBarline(ctx, ink)
  } finally {
    // ⚠️ In a `finally`, like every other `openGroup` in this engine: an unbalanced pair swallows the
    // rest of the render.
    ctx.closeGroup()
  }
}
