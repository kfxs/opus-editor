import { Tremolo, Metrics, Stem } from 'vexflow'
import type { Note } from 'vexflow'
import type { TremoloMark } from '@/types/music'
import { PENDERECKI_TREMOLO } from '@/utils/tremoloGlyphs'

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
 * fixes the same complaint by a different means — it lands near a line without snapping to one. (2)
 * is implemented, in the renderer, in the two shapes named below. (3) is NOT: nothing stops a stroke
 * from sitting outside the staff on a note whose stem points away from it.
 *
 * WHY A SUBCLASS AND NOT A `setYShift`. `renderText` does add `yShift`, so a shift would work — but
 * the amount depends on `getStemExtents()`, which does not exist until the notes are formatted and
 * the beams have applied their stem extensions. Computing it at build time would be computing it
 * from stems that are not final yet. Overriding `draw()` puts the arithmetic at the one moment
 * everything it reads is settled.
 */

/**
 * How much longer a FLAGGED note's stem gets so its flag clears the strokes, as a fraction of the
 * stem's own length. A flag hangs DOWN from the stem tip (`drawFlag` reads `stem.getHeight()`), so on
 * a lone eighth it reaches straight into the middle of the stem where the strokes now sit — while a
 * beam, which sits ON the tip, never does. Hence this one is for flags only.
 *
 * ⚠️ The strokes do NOT follow this stretch — that is the whole point. They stay where the unstretched
 * stem put them and the flag moves away from them, so the full stretch becomes clearance. Centring
 * them in the longer stem instead would move them up half as far as the flag and gain only half.
 */
export const TREMOLO_FLAG_STEM_STRETCH = 0.25

/**
 * The air left between the stroke stack and each end of the usable stem, in staff spaces — the
 * *chosen* number in the fit rule below, where everything else is measured.
 *
 * A quarter of a space at each end (half a space in total): enough that the outer strokes are not
 * touching the notehead or the beam, small enough that a stem is only lengthened when it genuinely
 * has to be. Staff spaces, not pixels, so it holds at any staff size.
 */
export const TREMOLO_STROKE_CLEARANCE = 0.25

/**
 * The Penderecki sign is one VexFlow has no glyph for, so this class sets it as the modifier's text
 * and then places it exactly as it places the strokes. Both codepoints live in
 * `utils/tremoloGlyphs`: the selection highlight recognises a drawn stroke by the same character,
 * and that side of the app has no VexFlow. See docs/tremolo-plan.md §0.
 */

/** A rectangle in the same pixel space the ElementRegistry stores. */
export interface TremoloInkRect { x: number; y: number; width: number; height: number }

/**
 * The span the strokes have to live in: the stem from the notehead's EDGE to its tip.
 *
 * ⚠️ `getStemExtents().baseY` is the notehead's CENTRE, not its edge — it comes from the note's key
 * lines, and a key line runs through the middle of a head. Using it directly counts the head's top
 * half as if it were stem. The head is one staff space tall, so the stave's own line spacing IS the
 * correction, which is what makes this hold at any staff size.
 *
 * Shared by the draw (which centres in this span) and by the renderer's stretch pass (which asks
 * whether the stack fits in it), so the two cannot drift apart.
 */
export function usableStemSpan(note: Note): { tip: number; noteheadEdge: number; length: number } {
  const { topY, baseY } = note.getStemExtents()
  const staffSpace = note.getStave()?.getSpacingBetweenLines() ?? 10
  const noteheadEdge = baseY - note.getStemDirection() * (staffSpace / 2)
  return { tip: topY, noteheadEdge, length: Math.abs(topY - noteheadEdge) }
}

export class CenteredTremolo extends Tremolo {
  /** Pixels of stem added for {@link TREMOLO_FLAG_STEM_STRETCH}, which the strokes must NOT follow. */
  private stemStretch = 0

  /** The stack's ink box as of the last {@link draw} — see {@link inkRect}. */
  private lastInkRect: TremoloInkRect | null = null

  /**
   * Takes the {@link TremoloMark} itself, not a stroke count — so the Penderecki sign rides the same
   * placement, the same stem stretches, the same ghost and the same bounding-box fix as the strokes,
   * instead of being a second drawing path that has to remember all four.
   *
   * It is **one glyph in a stack of one**: `num = 1` with the text swapped for E22B. Everything below
   * then reads "the stack" and gets the right answer without a special case — including
   * `strokeStackHeight`, which measures whatever glyph is set, so the taller sign asks for its own
   * stem room automatically.
   *
   * ⚠️ The codepoint is written out. VexFlow's own `Tremolo` constructor reaches into its `Glyphs` map
   * for E220, which works *inside* the library's ESM build but is `undefined` when we import it —
   * `Glyphs` is not re-exported, and the failure is silent
   * (`reference_vexflow_glyphs_esm_vs_cjs`). SMuFL codepoints are spec-stable, so owning it removes
   * the question.
   */
  constructor(mark: TremoloMark) {
    super(typeof mark === 'number' ? mark : 1)
    if (mark === 'penderecki') this.text = PENDERECKI_TREMOLO
  }

  /**
   * Tell the strokes how much stem was added *under* them to get a FLAG out of the way, so they can
   * stay at the position the unstretched stem gave them. Set by the renderer
   * (`applyTremoloStemStretch`) — the one moment when the Beam objects exist, so `hasFlag()` is
   * finally trustworthy — never at build time.
   *
   * ⚠️ The other stretch (the fit one, {@link TREMOLO_STROKE_CLEARANCE}) is deliberately NOT reported
   * here: that stem grew *because the strokes did not fit*, so they must spread into the new room
   * rather than stay put. Two stretches, opposite treatments — the reason they are separate numbers.
   */
  setStemStretch(px: number): this {
    this.stemStretch = px
    return this
  }

  /**
   * The stack's own ink height: the steps between strokes plus one stroke's ink.
   *
   * Read by the renderer to decide whether the stem is long enough. Measures the glyph rather than
   * assuming a height, so it stays true at any font scale — and returns just the steps when the text
   * canvas is unavailable (jsdom), which under-reports by one stroke in the one environment where
   * nothing is drawn.
   */
  strokeStackHeight(): number {
    const scale = this.checkAttachedNote().getFontScale()
    const { ink } = this.measureStroke(scale)
    return Math.abs(Metrics.get('Tremolo.spacing') * scale) * (this.num - 1) + ink
  }

  /**
   * One stroke's ink box, at the size it will be drawn.
   *
   * ⚠️ Size FIRST, and via `setFontSize`: that is what invalidates the cached metrics, where
   * VexFlow's own `this.fontInfo.size = …` mutates the object behind the getter and leaves them
   * stale. Ascent is measured UP from the baseline and descent DOWN, so the ink runs
   * `[y − ascent, y + descent]`.
   */
  private measureStroke(scale: number): { ascent: number; descent: number; ink: number } {
    this.setFontSize(Metrics.get('Tremolo.fontSize') * scale)
    const { actualBoundingBoxAscent: ascent, actualBoundingBoxDescent: descent } = this.textMetrics
    return { ascent, descent, ink: ascent + descent }
  }

  /**
   * The ink the WHOLE stack covers, from the last {@link draw} — the mark's own click target, and
   * the box the registry stores (`ElementRegistry` type `'tremolo'`). Null before it has drawn.
   *
   * ⚠️ NOT `Element.getBoundingBox()`, which every other modifier registers through. That box is one
   * glyph anchored at `this.x`, `this.width` wide — and `width` is the ADVANCE width, measured from
   * the anchor rightward, while a tremolo stroke's ink straddles the stem it is centred on. So it
   * would sit half a stroke to the right of what you see, and a click on the left half of the
   * strokes would fall through to the stem underneath. It also describes the first stroke alone,
   * not the stack.
   *
   * So the box is built from the ink extents (`actualBoundingBox*`, measured either side of the
   * anchor) and stretched over the `num − 1` steps the stack marches through. Recorded during the
   * draw rather than recomputed on demand, because every input — the stem extents, the stretch, the
   * font scale — is only settled at that moment.
   *
   * ⚠️ jsdom measures no text, so every extent comes back 0 and this is a degenerate rect there
   * (`reference_jsdom_cannot_measure_glyphs`) — the one environment where nothing is clicked.
   */
  inkRect(): TremoloInkRect | null {
    return this.lastInkRect
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
    // ⚠️ A STEMLESS NOTE HAS NO STEM TO SIT ON. The stem x is the notehead's right EDGE (stem-up) or
    // its left (stem-down) — right where the stem is drawn, and beside the head where it is not. On a
    // whole note that leaves the strokes hanging off the side of the notehead instead of over it
    // (reported by eye). So a note with no stem centres them on the head.
    //
    // The same distinction the two-note pair had to make: a stemless note has stem EXTENTS to borrow
    // a height from — VexFlow builds the `Stem` object regardless — but no stem INK to line up with.
    // Height from the imaginary stem, x from the notehead.
    const x = note.hasStem()
      ? note.getAbsoluteX() + (stemDirection === Stem.UP ? note.getGlyphWidth() - Stem.WIDTH / 2 : Stem.WIDTH / 2)
      : note.getAbsoluteX() + note.getGlyphWidth() / 2

    const { ascent, descent } = this.measureStroke(scale)

    // `stemStretch` is undone here, not ignored: the stem was lengthened to get its FLAG out of the
    // way, and the strokes are supposed to stay where the unstretched stem put them. Adding
    // `stemDirection * stretch` walks the tip back toward the notehead by that much, in whichever
    // direction the stem points. Zero for a beamed or stemless note, and zero for the FIT stretch,
    // which the strokes are meant to spread into.
    const { tip, noteheadEdge } = usableStemSpan(note)
    const middleOfStem = (tip + stemDirection * this.stemStretch + noteheadEdge) / 2

    // ⚠️ `renderText` places the glyph's BASELINE at the y it is given — the glyph is NOT centred on
    // that point. So centring the baselines is not centring the ink: whatever E220's baseline→ink
    // offset is, the whole stack inherits it (which is why the first version drew low). The ink
    // centre sits `(descent − ascent) / 2` BELOW the baseline, so the baseline has to rise by that
    // much.
    //
    // Degrades to no correction when the text canvas is unavailable (jsdom — the metrics come back
    // zeroed), which is exactly the environment where nothing is looked at anyway. That degradation
    // is also the reason measuring beats a tuned constant here: the worst it can do is what NOT
    // measuring would have done, and when it works it is exact at any font size.
    const inkCentreBelowBaseline = (descent - ascent) / 2

    const firstStrokeY = middleOfStem - inkCentreBelowBaseline - ((this.num - 1) * ySpacing) / 2

    // ⚠️ SET `x`/`y`, THEN RENDER AT THE ORIGIN — the pattern `Articulation`, `Accidental` and `Dot`
    // all follow (`this.x = x; this.y = y; this.renderText(ctx, 0, 0)`), and the one thing VexFlow's
    // own `Tremolo` does NOT: it calls `renderText(ctx, x, y)` and leaves `x`/`y` at zero.
    //
    // That is not cosmetic. `StaveNote.getBoundingBox()` merges EVERY modifier's box, and
    // `Element.getBoundingBox()` is built from `this.x`/`this.y` — so a tremolo left at the origin
    // drags its note's box out to x = 0, which is then what the registry stores for the note. Any
    // hit-test reading `bbox.x + bbox.width / 2` (Ctrl/Shift-click's distance check, for one) then
    // measures to a point halfway across the system and silently does nothing. `renderText` adds
    // `this.x`/`this.y` to what it is passed, so the pixels below are identical either way.
    this.x = x
    this.y = firstStrokeY
    for (let i = 0; i < this.num; ++i) {
      this.renderText(ctx, 0, i * ySpacing)
    }

    this.recordInkRect(firstStrokeY, ySpacing, ascent, descent)
  }

  /**
   * Store what the draw above just covered, as ink — see {@link inkRect} for why this is measured
   * rather than taken from `getBoundingBox()`.
   *
   * `ySpacing` is signed (tip → notehead), so the last stroke can be either side of the first;
   * min/max rather than a direction case. Horizontally the extents are read either side of the
   * anchor, which is what puts the box ON the stem instead of beside it.
   */
  private recordInkRect(firstStrokeY: number, ySpacing: number, ascent: number, descent: number): void {
    const { actualBoundingBoxLeft: left, actualBoundingBoxRight: right } = this.textMetrics
    const lastStrokeY = firstStrokeY + (this.num - 1) * ySpacing
    const top = Math.min(firstStrokeY, lastStrokeY) - ascent
    const bottom = Math.max(firstStrokeY, lastStrokeY) + descent
    this.lastInkRect = {
      x: this.x - left,
      y: top,
      width: left + right,
      height: bottom - top,
    }
  }
}
