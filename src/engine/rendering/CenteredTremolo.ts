import { Tremolo, Metrics, Stem } from 'vexflow'

/**
 * A single-note tremolo whose strokes sit in the MIDDLE of the stem.
 *
 * VexFlow's own `Tremolo` anchors the stack to the stem **tip** and marches toward the notehead at a
 * fixed step, with no notion of centring:
 *
 * ```js
 * const ySpacing = Metrics.get('Tremolo.spacing') * stemDirection * scale;   // 7 * dir
 * let y = note.getStemExtents().topY + (this.num <= 3 ? ySpacing : 0);
 * for (let i = 0; i < this.num; ++i) { this.renderText(ctx, x, y); y += ySpacing; }
 * ```
 *
 * On a ~35px stem that leaves ONE stroke about a full staff-space above the middle, and two nearly
 * as high — they read as clinging to the tip (or to the beam) instead of riding the stem. The bias
 * is toward the tip at every count; it is simply least visible at four and five, where the stack is
 * long enough to cover most of the stem anyway.
 *
 * Only the vertical anchor changes. The step between strokes, the x (the stem's own side of the
 * notehead), the font size and the glyph are VexFlow's, copied rather than reinvented, so the mark's
 * proportions stay the library's and only its placement is ours.
 *
 * ⚠️ CENTRING IS OUR RULE, NOT GOULD'S — say so rather than let it read as convention. *Behind Bars*
 * (the tremolo section, ~p.224–226) states three things about placement, and none of them is "the
 * middle of the stem":
 *   1. with ONE or TWO strokes it is clearest if they **centre on stave lines**;
 *   2. **extend the stem if necessary** so the strokes are clear of tails and beams;
 *   3. the strokes stay **within the stave**.
 * Her (1) singles out exactly the counts that looked wrong under VexFlow's tip anchor, so centring
 * fixes the same complaint by a different means — it lands near a line without snapping to one.
 * Neither (2) nor (3) is implemented: nothing here lengthens a stem, and nothing stops a stroke
 * from sitting outside the staff on a note whose stem points away from it.
 *
 * WHY A SUBCLASS AND NOT A `setYShift`. `renderText` does add `yShift`, so a shift would work — but
 * the amount depends on `getStemExtents()`, which does not exist until the notes are formatted and
 * the beams have applied their stem extensions. Computing it at build time would be computing it
 * from stems that are not final yet. Overriding `draw()` puts the arithmetic at the one moment
 * everything it reads is settled, which is also what makes a beamed note correct for free.
 */
/**
 * How much longer a FLAGGED note's stem gets so its flag clears the strokes, as a fraction of the
 * stem's own length. A flag hangs DOWN from the stem tip (`drawFlag` reads `stem.getHeight()`), so on
 * a lone eighth it reaches straight into the middle of the stem where the strokes now sit — while a
 * beam, which sits ON the tip, never does. Hence the stretch is for flags only.
 *
 * This is Gould's second rule ("extend a stem if necessary so that the tremolo strokes are clear of
 * tails and beams") with a number attached, since she gives none: a quarter of the stem.
 *
 * ⚠️ The strokes do NOT follow the stretch — that is the whole point. They stay where the unstretched
 * stem put them and the flag moves away from them, so the full stretch becomes clearance. Centring
 * them in the longer stem instead would move them up half as far as the flag and gain only half.
 */
export const TREMOLO_FLAG_STEM_STRETCH = 0.25

export class CenteredTremolo extends Tremolo {
  /** Pixels of stem added for {@link TREMOLO_FLAG_STEM_STRETCH}, which the strokes must NOT follow. */
  private stemStretch = 0

  /**
   * Tell the strokes how much stem was added under them, so they can stay at the position the
   * UNSTRETCHED stem gave them. Set by the renderer (`applyTremoloStemStretch`) — the one moment
   * when the Beam objects exist, so `hasFlag()` is finally trustworthy — never at build time.
   */
  setStemStretch(px: number): this {
    this.stemStretch = px
    return this
  }

  draw(): void {
    const ctx = this.checkContext()
    const note = this.checkAttachedNote()
    this.setRendered()

    const stemDirection = note.getStemDirection()
    const scale = note.getFontScale()
    // Signed: positive steps DOWN for a stem-up note, up for stem-down — i.e. always tip → notehead,
    // exactly as VexFlow's loop walks. So the centring below needs no per-direction case.
    const ySpacing = Metrics.get('Tremolo.spacing') * stemDirection * scale
    const x = note.getAbsoluteX()
      + (stemDirection === Stem.UP ? note.getGlyphWidth() - Stem.WIDTH / 2 : Stem.WIDTH / 2)

    // Size FIRST: the ink measurement below depends on it, and `setFontSize` is what invalidates the
    // cached metrics (VexFlow's own `this.fontInfo.size = …` mutates the object behind the getter and
    // leaves `metricsValid` alone — fine for drawing, wrong for measuring).
    this.setFontSize(Metrics.get('Tremolo.fontSize') * scale)

    // The span to centre on is the FREE stem: from where the notehead stops to the stem's tip.
    //
    // ⚠️ `baseY` is the notehead's CENTRE, not its edge — `getStemExtents` reads the note's key
    // lines, and a key line runs through the middle of its head. Centring on `(topY + baseY) / 2`
    // therefore sits half-a-half-notehead too low: it counts the top half of the head as if it were
    // stem. The visible stem starts at the head's edge on the stem's side (top edge for a stem-up
    // note, bottom for stem-down), which is half a notehead from the centre — and a notehead is one
    // staff space tall, so the stave's own line spacing IS that measurement. Taking it from the
    // stave rather than from a constant is what makes this hold at any staff size.
    // `stemStretch` is undone here, not ignored: the stem was lengthened to get its FLAG out of the
    // way (see {@link TREMOLO_FLAG_STEM_STRETCH}), and the strokes are supposed to stay where the
    // unstretched stem put them. Adding `stemDirection * stretch` walks the tip back toward the
    // notehead by that much, in whichever direction the stem points. Zero for a beamed or stemless
    // note, so those centre on exactly what VexFlow reports.
    const { topY, baseY } = note.getStemExtents()
    const tipBeforeStretch = topY + stemDirection * this.stemStretch
    const staffSpace = note.getStave()?.getSpacingBetweenLines() ?? 10
    const noteheadEdge = baseY - stemDirection * (staffSpace / 2)
    const middleOfStem = (tipBeforeStretch + noteheadEdge) / 2

    // ⚠️ `renderText` places the glyph's BASELINE at the y it is given — the glyph is NOT centred on
    // that point. So centring the baselines is not centring the ink: whatever E220's baseline→ink
    // offset is, the whole stack inherits it (which is why the first version drew low). Measure it
    // rather than carry a magic number: ink runs from `y − ascent` to `y + descent`, so its centre
    // sits `(descent − ascent) / 2` BELOW the baseline, and the baseline has to rise by that much.
    //
    // Degrades to no correction when the text canvas is unavailable (jsdom — the metrics come back
    // zeroed), which is exactly the environment where nothing is looked at anyway. That degradation
    // is also the reason measuring beats a tuned constant here: the worst it can do is what NOT
    // measuring would have done, and when it works it is exact at any font size.
    const { actualBoundingBoxAscent: ascent, actualBoundingBoxDescent: descent } = this.textMetrics
    const inkCentreBelowBaseline = (descent - ascent) / 2

    let y = middleOfStem - inkCentreBelowBaseline - ((this.num - 1) * ySpacing) / 2
    for (let i = 0; i < this.num; ++i) {
      this.renderText(ctx, x, y)
      y += ySpacing
    }
  }
}
