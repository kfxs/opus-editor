/**
 * ⭐⭐ **WE DRAW THE BARLINES** — every end line in the score, plain ones included. P2 of
 * docs/barline-types-plan.md, and the answer to his question *"are we using VexFlow to draw?
 * shouldn't we draw ourself following the own engine strategy?"*
 *
 * A score-level pass beside `drawSystemConnector` / `renderHairpins` / `renderOttavas` /
 * `renderPedals`, and `own-engraving-engine.md`'s rule applies to it: **a new drawn element draws
 * through OUR context and OUR primitives, never by instantiating a VexFlow class.**
 *
 * ## ⭐ Why this one passes `vexflow-boundary.md`'s test
 *
 * Take a decision from VexFlow only when there is a **rule we want to state and cannot**. Four of
 * this plan's rules are unsayable through `Barline` (`vexflow/src/stavebarline.js`): the thick line is
 * `fillRect(x-2, …, 3, …)` — 3 px, a literal, where the convention is 0.50 spaces; the whole sign is
 * a fixed pixel layout (`END` inks x−5…x+1, `REPEAT_BEGIN` x−2…x+10) so which side it grows is not
 * addressable; the dots land ≈0.1 space low off a `dotRadius / 2` fudge; and none of it scales with
 * its staff. ⛔ And the usual argument against taking a piece — *"years of accumulated correctness
 * about glyphs, stems and fonts"* — has no purchase: a barline is rectangles and two dots.
 *
 * ⭐ It is also **finishing** a piece rather than opening a front. One plain barline used to cost
 * three passes: VexFlow's 1 px `fillRect`, `inkBarlines` rewriting that rect's width, and
 * `hintBarlines` rewriting its x. We already overruled VexFlow on both the WEIGHT and the POSITION of
 * every line on the page; this draws it right the first time.
 *
 * ## ⭐⭐ What being a PASS dissolves
 *
 * *ONE OWNER PER LINE* (§3.2) settles the model but not the picture: bar *N* draws a line at exactly
 * the x where bar *N+1* would open a repeat. Left to VexFlow that is a genuine cross-measure
 * dependency — bar *N*'s picture decided by bar *N+1*'s field — and `MEASURE_RENDER_ROLE` **cannot
 * express it** (it is `Record<keyof Measure, …>`, own-fields-only), so the three fields would compile,
 * pass the perturbation test, and still leave bar *N* reusing a stale `<g>`.
 *
 * Rebuilt from scratch each render, outside every measure group, this ends it the way the ottava's
 * pass does: **no measure's cached `<g>` can hold a stale barline, because none of them holds one at
 * all.** The suppression rule is then a local read in one place that can see both bars *and* the
 * casting-off:
 *
 * > **A boundary carries ONE sign.** The bar that ends there draws it — unless the bar that begins
 * > there opens a repeat, in which case the sign is that repeat (or, if both statements are made, the
 * > back-to-back form).
 *
 * ⚠️ **"On the same system" is not decoration.** A repeat that opens the next line does not suppress
 * anything on this one: the previous system still ends with its own barline, and the new one begins
 * with `|:`. That is what all three engines do (LilyPond prints the start repeat at the beginning of
 * the new line and nothing at the end of the previous one), and a per-measure render key could not
 * ask the question at all.
 *
 * ## ⚠️ What this pass does NOT take
 *
 * **The line at a system's LEFT EDGE.** That one is still VexFlow's `setBegBarType` (re-inked by
 * `inkBarlines` inside the measure group), and it is a different mark: it opens a stave rather than
 * dividing two bars, it has no neighbour to agree with, and the grand staff's own connector is
 * already drawn by hand beside it. The exception is a first-in-line bar that OPENS A REPEAT — there
 * the boundary's sign is `|:`, so the stave's begin bar is turned off and this pass draws it.
 */
import { Element, StaveModifierPosition } from 'vexflow'
import type { Stave } from 'vexflow'
import type { Score } from '@/types/music'
import { barlineSignParts, dotLines, signAtBoundary, type BarlineSignKind } from '@/engine/layout/barlineSign'
import { inStaffSpace } from './staffScaleGroup'
import type { RenderPass } from './RenderPass'

/**
 * What the pass needs of a `MeasurePlacement`, declared structurally so the renderer that calls this
 * is not imported back by it — the shape `PedalRenderer` and `OttavaRenderer` already use.
 */
export interface BarlinePlacement {
  measureNumber: number
  staffIndex: number
  stave: Stave
  /**
   * 🚨🚨 **WHERE THE BAR IS THIS RENDER, which is not always where its STAVE says it is.**
   *
   * A bar whose shape has not changed is REUSED rather than re-engraved: the renderer keeps the old
   * `Stave` object and moves the drawn group with a `transform: translate(dx, dy)`
   * (`replaySnapshot`). The stave's own numbers are therefore **where the bar was last PAINTED**, and
   * everything drawn inside that group rides the transform back into place — but this pass draws
   * OUTSIDE it, so nothing carries its signs along.
   *
   * Reported from use on a grand staff: *"the final bar and one of the simple bar that are in the
   * second stave [have] been stolen from the first stave"* — a staff-spacing nudge translates every
   * bar without re-engraving one, and every barline stayed at the previous render's y.
   *
   * ⭐ This is the SAME trap the barline selection highlight fell into once already
   * (docs/barline-selection.md: *"the coordinates LIE"*), which is why the fix is the same shape:
   * take the position from the PLACEMENT — the plan for THIS render — and never from the stave.
   */
  x: number
  y: number
  width: number
  /** The staff's drawn scale. `x`/`y`/`width` are SVG-space; the stave lives in its own scaled
   *  space, so the two are compared after dividing by this. */
  scale: number
}

/**
 * 🚨 **How far this render moved the bar since its stave was built** — see {@link BarlinePlacement.x}.
 *
 * Zero for every bar that was re-engraved (the stave was built at the plan's own coordinates), and
 * non-zero for exactly the bars that were reused and translated. Everything this pass reads off the
 * stave — `getX`, `getWidth`, `getTopLineTopY`, `getYForLine`, `getNoteStartX` — is in the stave's
 * own space, so the shift is applied there and not in the SVG's.
 */
function staleShift(placement: BarlinePlacement): { dx: number; dy: number } {
  const { stave, scale } = placement
  return { dx: placement.x / scale - stave.getX(), dy: placement.y / scale - stave.getY() }
}

/** Which end of a bar a sign was drawn at — only ever used to make the SVG group's id unique. */
type Side = 'end' | 'start'

/**
 * ⭐⭐ **One repeat dot, as the FONT draws it** — `repeatDot`, U+E044.
 *
 * ⛔ Not a circle of ours, and this was the correction: both engines that draw this sign draw this
 * code point (MuseScore `item->drawSymbol(SymId::repeatDot, …)`, Verovio
 * `DrawSmuflCode(…, SMUFL_E044_repeatDot, …)`). In Bravura it happens to be a perfect 0.4-space
 * circle, so an `arc` would have looked identical *in this font* — and been wrong in the first one
 * whose repeat dot is a hand-drawn blob (Petaluma's is). ⭐ The STROKES stay ours: both engines draw
 * those as plain lines too (`painter->drawLine` off `Sid::barWidth`, `DrawVerticalSegmentedLine` off
 * `m_barLineWidth`), because a precomposed `barlineFinal` glyph is exactly 4 staff spaces tall — a
 * five-line staff and nothing else — while a barline has to span whatever it is drawn on.
 *
 * `x` is the glyph's LEFT edge and `y` its baseline, which for this glyph is the dot's own centre
 * (its box is 0…0.4 across and −0.2…+0.2 up). The size follows the stave: a SMuFL em is 4 staff
 * spaces, and VexFlow reads a bare font size as POINTS at 4/3 px each (`./drawnFontSize`), so
 * `3 × space` is the size that draws this staff's own dot.
 */
function drawRepeatDot(ctx: RenderPass['context'], x: number, y: number, space: number): void {
  const dot = new Element('BarlineRenderer.repeatDot')
  dot.setText(REPEAT_DOT_GLYPH)
  dot.setFontSize(3 * space)
  dot.renderText(ctx, x, y)
}

/** `repeatDot` — the dot of a repeat sign, and NOT `augmentationDot` (U+E1E7), which is a different
 *  glyph that happens to have the same box in Bravura. ⭐ 3 of 3 engines draw THIS code point, and
 *  written as an escape for the same reason `pedalStyle` writes its own: a private-use character is
 *  invisible in every editor and diff, so the source has to say which one it is. */
const REPEAT_DOT_GLYPH = '\uE044'

/**
 * Draw one sign, centred on `boundaryX` **in the stave's own space**.
 *
 * ⭐ **It scales with its staff**, and this is now a decision rather than an accident (§4.6.6). It
 * used to be one: `inkBarlines` wrote a px width inside a group that happened to carry the staff's
 * scale, so a small staff got a proportionally thinner barline because of which `<g>` the rect landed
 * in. Drawing outside the measure group means saying so — and the answer keeps today's picture:
 * a cue-size staff's own divider is part of that staff's ink. ⚠️ The argument the other way is real
 * and is MuseScore's default (`Sid::scaleBarlines` is false — a barline divides the SYSTEM); the day
 * §2's per-staff work meets `docs/small-staff-spacing`, this is the line to revisit.
 */
function drawSign(
  pass: RenderPass,
  placement: BarlinePlacement,
  boundaryX: number,
  kind: BarlineSignKind,
  side: Side,
): void {
  const ctx = pass.context
  const { stave, staffIndex, measureNumber } = placement
  const space = stave.getSpacingBetweenLines()
  // 🚨 Every number below is the STAVE's, so it is the last render's for a bar that was reused and
  //    translated. See {@link staleShift}.
  const { dy } = staleShift(placement)
  const topY = stave.getTopLineTopY() + dy
  const botY = stave.getBottomLineBottomY() + dy
  const parts = barlineSignParts(kind)

  // ⚠️ Drawn inside a `stavebarline` group though VexFlow is not drawing it — `drawSystemConnector`'s
  // own note, and for the same reason: that class is the handle the hinting pass, the dev census and
  // the e2e harness all collect barlines by. It names what the ink IS, not who put it down.
  const group = ctx.openGroup('stavebarline', `barline-${measureNumber}-${staffIndex}-${side}`) as SVGGElement | undefined
  try {
    inStaffSpace(pass, staffIndex, group, () => {
      for (const stroke of parts.strokes) {
        ctx.fillRect(boundaryX + stroke.x * space, topY, stroke.width * space, botY - topY)
      }
      for (const dot of parts.dots) {
        for (const line of dotLines(stave.getNumLines())) {
          drawRepeatDot(ctx, boundaryX + dot.x * space, stave.getYForLine(line) + dy, space)
        }
      }
    })
  } finally {
    // ALWAYS close: an open group swallows the whole rest of the render (`renderMeasure`'s note).
    ctx.closeGroup()
  }

  // ⭐⭐ **A COMPOSITE SIGN IS HINTED AS A WHOLE OR NOT AT ALL — and today, not at all.**
  // `hintBarlines` rounds a thin line's ink onto the device-pixel grid so that every barline on the
  // page resolves identically. Applied to one stroke of a two-stroke sign it would do the opposite:
  // the thin line would move by up to half a device pixel while the thick one stayed put, so the
  // sign's own white gap — the 0.32 spaces that IS the final barline — would come out a different
  // width in every bar that has one. ⛔ So the sign opts out, exactly as VexFlow's 3 px thick line
  // always has. It is 0.5 spaces of ink; it does not vanish for want of alignment.
  if (group && kind !== 'plain') group.dataset.noHint = '1'
}

/**
 * ⭐⭐ **DOES THIS BAR'S OWN HEADER PUSH ITS START REPEAT OFF THE BOUNDARY?** — and if so, to where.
 *
 * ⭐ Two treatises state the rule, independently and in the same direction. **Gould p. 234**, under
 * *Placing changes of clef, key signature and time signature*:
 *
 * > "When there is a new clef, key signature or time signature at the beginning of a repeated
 * > section, place the repeat marks **afterwards**."
 *
 * **Ross p. 147** gives it as three numbered spacings — *"When a repeat bar follows a clef, the space
 * between the left side of the clef, and the left side of the repeat bar, is five and a half
 * spaces"*, and the same for a key signature and a time signature. ⇒ **header first, then `|:`**.
 *
 * So a bar that draws a header does NOT put its repeat on its own left boundary. That boundary keeps
 * whatever line belongs to it — a system's opening line, or the previous section's own end repeat —
 * and the `|:` stands between the header and the first note, which is where the music being repeated
 * actually starts.
 *
 * ⚠️ **And that is why it also stops SUPPRESSING anything** (see the caller): a start repeat only
 * replaces the line before it when it stands *on* that line. Displaced by a clef, it never touches
 * it, and a bar boundary with no line at all is the bug that would follow from forgetting this.
 *
 * @returns the x to centre the sign on, or `null` when the bar has no header and the sign belongs on
 *          its own boundary.
 */
function displacedRepeatX(stave: Stave, signRight: number, dx = 0): number | null {
  // A `NONE` begin bar is still a modifier, so the question is "anything but a barline".
  const header = stave.getModifiers(StaveModifierPosition.BEGIN).filter(m => m.getCategory() !== 'Barline')
  if (header.length === 0) return null
  // The sign's own ink ends one staff space before the music — Gould p. 42 (*"allow a stave-space…
  // on either side of a barline before a notational symbol"*) and Ross p. 143 (*"between the barline
  // and the left side of the first note is one space"*). ⏭️ The bar does not RESERVE this room yet,
  // so on a tight header the sign can still crowd the meter glyph; that is §5.1's leading term, P3.
  const space = stave.getSpacingBetweenLines()
  return stave.getNoteStartX() + dx - space - signRight * space
}

/**
 * **Draw every barline of this render.** One sign per boundary, at the ends of the bars that were
 * actually placed.
 *
 * `placements` is what this render put on the page — so a culled bar draws nothing, as it should, and
 * a boundary whose other half is off-screen is drawn by the half that is on it.
 */
export function renderBarlines(pass: RenderPass, score: Score, placements: BarlinePlacement[]): void {
  const byNumber = new Map(score.measures.map(m => [m.number, m]))
  const lineOf = (n: number): number | undefined => pass.measureLayoutInfo.get(n)?.lineNumber
  const at = new Map(placements.map(p => [`${p.measureNumber}:${p.staffIndex}`, p]))

  for (const placement of placements) {
    const n = placement.measureNumber
    const measure = byNumber.get(n)
    if (!measure) continue
    const line = lineOf(n)
    const stave = placement.stave
    const neighbour = (offset: -1 | 1): BarlinePlacement | undefined =>
      lineOf(n + offset) === line ? at.get(`${n + offset}:${placement.staffIndex}`) : undefined

    // ---- The boundary this bar ENDS at.
    //
    // ⭐ Its neighbour counts only if that bar is on this system AND was drawn AND puts its repeat on
    // this boundary rather than after a header of its own. Any of those three failing means the
    // neighbour's `|:` is not standing here, so nothing of this bar's is suppressed.
    const nextPlacement = neighbour(1)
    const next = nextPlacement && displacedRepeatX(nextPlacement.stave, 0, 0) === null
      ? byNumber.get(n + 1)
      : undefined
    const endKind = signAtBoundary(measure, next)
    // 🚨 The boundary comes from the PLACEMENT, never from `stave.getX() + stave.getWidth()` — a
    //    reused bar's stave reports where it was last painted. See {@link staleShift}.
    const { dx } = staleShift(placement)
    if (endKind) drawSign(pass, placement, stave.getX() + stave.getWidth() + dx, endKind, 'end')

    // ---- The boundary this bar BEGINS at, and only when it opens a repeat.
    if (measure.repeatStart === undefined) continue

    // ⭐ A header displaces the sign into the bar, after the clef/key/meter — see `displacedRepeatX`.
    const displaced = displacedRepeatX(stave, barlineSignParts('repeatStart').extent.right, dx)
    if (displaced !== null) {
      // ⛔ Always `repeatStart` alone, never the back-to-back form: the previous bar's own end sign
      // is a different mark at a different x now, and combining them would draw one sign in the
      // place of two.
      drawSign(pass, placement, displaced, 'repeatStart', 'start')
      continue
    }

    // ⭐ Otherwise this is the same boundary as the previous bar's end, so exactly one of the two
    // draws it. The previous bar does whenever it can — on this system and painted — and this bar
    // picks it up otherwise: at a system start (where the previous bar's end line is a different
    // boundary, on the line above) and where the previous bar was culled.
    if (neighbour(-1)) continue
    const prev = lineOf(n - 1) === line ? byNumber.get(n - 1) : undefined
    const startKind = signAtBoundary(prev, measure)
    if (startKind) drawSign(pass, placement, stave.getX() + dx, startKind, 'start')
  }
}
