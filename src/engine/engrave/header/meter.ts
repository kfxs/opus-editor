/**
 * ⭐⭐ **THE TIME SIGNATURE'S INK — P5b, and the second symbol of the HEADER that is ours**
 * (`docs/plans/own-engraving-engine.md` P5; the adapter is `rendering/EngravedTimeSignature`).
 *
 * ## What P5 said this step was
 *
 * > *"`engine/layout/headerInk.ts` already **measures** what a clef and a meter cost; `Stave` still
 * > **places** them — the two-sets-of-numbers problem in its last hiding place."*
 *
 * P5a took the staff's five lines; P5b's first step took the CLEF's glyph and left the rest of the
 * run named: *"⏭️ What is LEFT: the **METER's** ink, and every **PLACEMENT** moving off
 * `Stave.format()`"*. This is the meter half of the ink, and it is the same shape the clef's was:
 * ⭐ **the ink moves to a module of ours and enters the SCENE; the numbers that decide WHERE stay
 * exactly where they were, as NAMED INPUTS.** ⛔ No pixel moves.
 *
 * ## ⭐ The rule, in one sentence — and it is the CLEF's rule again
 *
 * > **A time signature's numeral is CENTRED ON A STAFF LINE — the upper row on the second line from
 * > the top, the lower on the fourth — and that line's y is the glyph's BASELINE.**
 *
 * ⭐⭐ **The font on disk is what makes the second half of that sentence true, and it is checkable**:
 * Bravura's `timeSig0`–`timeSig9` measure **up 0.98–1.04 sp and down 0.996–1.036 sp about their own
 * origin** (`engine/fonts/bravuraMetrics.GLYPH_BOXES`) — i.e. a digit is cut **centred on its
 * baseline** and stands two staff spaces tall. ⇒ baselines on the 2nd and 4th lines put the upper row
 * across lines 1–3 and the lower across lines 3–5, so ⭐ **the pair exactly fills the staff**, which is
 * the only thing any treatise states about a meter's vertical placement:
 *
 * > *"numerals should exactly fill the height of the stave"* — Gould, *Behind Bars* p. 152.
 *
 * ⛔ Which is why nothing here nudges, exactly as nothing in `engrave/header/clef` does. A numeral
 * that looks off-centre is a FONT question or an anchor-line question, ⛔ never a fudge factor.
 * `meter.test.ts` asserts the premise against the font's own table rather than restating it here, so a
 * font whose digits are not centred breaks a test instead of quietly breaking the rule.
 *
 * ## ⏳ What this module deliberately does NOT own
 *
 * | ⛔ not ours | where it still lives | why it was left |
 * |---|---|---|
 * | **WHICH lines** the two rows name | ✅ `./meterSign` since S4b0 (today's 1 and 3, as rows) | it still arrives here resolved, as a y |
 * | the **GAP between the rows** | ⛔ nobody chose it — it FALLS OUT of the two lines | 🚨 see below, and it is the sharpest ⛔ UNKNOWN in the header research |
 * | `lineShift` — ±½ line when the glyph is over 30 px tall | ✅ `./meterSign` since S4b0, as a row | an unsourced compensation of VexFlow's, kept; it arrives folded into the y |
 * | the rows' **CENTRING on each other** | ✅ `./meterSign` since S4b0, off a width the renderer measures | a MEASUREMENT, not ink — it arrives folded into each row's x |
 * | the **x** of the whole sign | `Stave.format()`'s BEGIN-modifier walk | *"`headerInk` MEASURES, `Stave` PLACES"* — the next step of P5b, ⛔ not this one |
 *
 * 🚨🚨 **THE ROW GAP IS UNKNOWN IN EVERY BOOK, AND THAT IS A FINDING, ⛔ NOT AN OMISSION.**
 * `docs/research/header-spacing-research.md` §2.8 searched all four treatises for it and found only Gould's
 * vertical rule above; the engines then split — **2.0 sp between the rows** (LilyPond, Verovio, and
 * VexFlow's lines 1↔3, which is what we draw) against **a 0.0 clear gap, bboxes touching**
 * (MuseScore's `timeSigNormalNumDist`). ⇒ row **H** of that document's table is marked ⛔ UNKNOWN
 * rather than open, and ⛔ **this module must not become the place somebody quietly picks one**: it
 * takes two resolved ys and stamps on them.
 *
 * ⛔ **No DOM, no vexflow** (`lint:boundary`).
 */
import type { DrawContext } from '@/engine/paint/DrawContext'
import { stampGlyph, type GlyphFont } from '../glyph'

export type { GlyphFont }

/**
 * One ROW of a time signature, as the ink cares about it — the upper numerals, the lower numerals,
 * or the single `C`/`C|` symbol, which is a one-row meter and nothing more special than that.
 *
 * ⚠️ `x` is the glyph's ORIGIN — the left edge of where it is stamped, which is the sign's own x plus
 * whatever centred this row over the other one. ⛔ Not a centre.
 */
export interface MeterRow {
  glyph: string
  x: number
  /** The y of the staff line this row is centred on — see the module header. ⭐ A BASELINE. */
  lineY: number
  font: GlyphFont
}

/**
 * ⭐ **THE RULE** — the anchor line's y *is* the baseline.
 *
 * ⚠️ An identity today, and a named function for the reason `clefPlacement` (the clef’s twin rule) and
 * `staffLineStrokeY` are ones: ⭐ **the statement is the point.** VexFlow expresses it as two
 * `stave.getYForLine(...)` calls inline in a draw method, where it can neither be read nor tested,
 * and where the fact that the numeral is CENTRED on that line rather than SITTING on it is invisible.
 *
 * ⭐ It is also the seam a row gap would land on the day one is chosen — see the module header's
 * ⛔ UNKNOWN. Today nothing may be added here.
 */
export function meterRowBaseline(lineY: number): number {
  return lineY
}

/**
 * ⭐⭐ **WHERE THE SIGN STANDS — its ORIGIN, from where its INK is wanted** (P5b's placement step).
 *
 * ⚠️ **The number in the style sheets is WHITE SPACE, ⛔ not an origin distance.** A digit's ink does
 * not begin at its origin, so a gap stated ink-to-ink must be converted before anything is
 * positioned: `glyphBox.left` is the reach LEFT of the origin (`timeSig4` **−0.08** — its ink starts
 * that much to the RIGHT of it), so the origin goes **back** by the bearing and the ink lands where
 * the rule asked.
 *
 * 🚨🚨 **THE SIGN WAS WRONG IN ONE OF THE TWO PLACES THIS USED TO LIVE, AND THE INSTRUMENT THAT
 * "SETTLED" IT WAS BIASED — the whole episode is worth more than the function.** `EngravedStave`'s
 * clef→meter padding was `gap − left`; `placeMeterAfterKeySignature`'s origin was `inkLeft + left`.
 * ⭐ Both look like *"the bearing, accounted for"*; they differ by **2 × 0.08 = 0.16 sp**.
 *
 * ⚠️ **The first attempt to settle it MEASURED THE WRONG WAY ROUND.** Asked to serve both anchors,
 * the `+ left` form read **0.80** in the browser against the armed 1.0 and was "corrected" to
 * `− left`, which read 0.96. ⇒ 🚨 **both readings were ≈0.17 sp too small**, because
 * `getBoundingClientRect` rounds every ink box OUTWARD by up to a device pixel per side and a white
 * gap therefore reads ~2 px short (the calibration is in `e2e/headerGap`). The true drawn gaps were
 * **1.0** and **1.16**. ⚠️ Found 2026-09-14: that excess belonged to VexFlow's embedded Bravura
 * build, which the page drew in then; with the fonts we ship the reader is within half a pixel.
 *
 * ✅ **So `+ left` is right**, and it is what all three engines compute: LilyPond's own line is
 * `offsets[next] = extents[idx][RIGHT] + distance − extents[next][LEFT]`
 * (`break-alignment-interface.cc:243`), and `extents[LEFT]` is the ink's signed offset from the
 * origin — the negative of our `glyphBox.left`. ⇒ ⭐ **the key→meter arm had been right all along**,
 * and the clef→meter gap had been ~1.16 since `8849d2e` rather than the 1.0 he armed.
 *
 * ⭐⭐ **The lesson is not the sign.** Two expressions of one rule do not disagree loudly — they
 * disagree by a bearing; and an instrument whose error (0.2 sp) exceeds the effect (0.16 sp) will
 * confirm whichever one you tried last. `docs/research/ink-anchors-and-side-bearings.md`.
 */
export function meterOriginX(inkLeftX: number, glyphLeft: number, space: number): number {
  return inkLeftX + glyphLeft * space
}

/**
 * ⭐ **THE INK** — one glyph per row, each in the face it was handed.
 *
 * ⛔ **Opens no group**, because VexFlow's `TimeSignature.drawAt` opens none: it is the entry point a
 * `TimeSigNote` uses to draw a mid-bar meter change inside the note's own group. {@link drawMeter} is
 * the one that wraps — see its note.
 *
 * ⚠️ An EMPTY row draws nothing rather than an empty `<text>` node (`stampGlyph`'s own guard).
 * Unreachable here — `utils/meter.timeSignatureKey` emits `C`, `C|` or `n/d`, so a numeric meter
 * always has both rows — and stated because the two are not the same DOM.
 */
export function stampMeter(ctx: DrawContext, rows: readonly MeterRow[]): void {
  for (const row of rows) {
    stampGlyph(ctx, row.glyph, row.x, meterRowBaseline(row.lineY), row.font)
  }
}

/**
 * ⭐ The sign as a stave modifier draws it: the rows inside their own group.
 *
 * 🚨 **The group is load-bearing and must keep its id.** `.timesignature text` is what
 * `e2e/barlineTypes.e2e.ts` measures a meter's ink with and what `e2e/staffSize.e2e.ts` reads a
 * meter's x from (`h.placed(...)[0].x` — ⚠️ **the UPPER row is index 0**, so the rows must stay in
 * their drawing order), and the ID is how `ElementRegistry`'s box resolves back to this ink.
 * ⇒ this reproduces `TimeSignature.draw`'s `openGroup('timesignature', id)` exactly.
 *
 * ⛔ **No style is applied**, exactly as `engrave/header/clef` applies none: `Metrics` has no
 * `TimeSignature` row, so VexFlow's own `drawWithStyle` had nothing to apply either, and every
 * recolour in this editor happens on the DOM after the fact
 * (`reference: vexflow setStyle context leak`).
 */
export function drawMeter(ctx: DrawContext, rows: readonly MeterRow[], groupId?: string): void {
  ctx.openGroup('timesignature', groupId)
  try {
    stampMeter(ctx, rows)
  } finally {
    // ⚠️ In a `finally`, like every other `openGroup` in this engine: an unbalanced pair swallows
    // the rest of the render.
    ctx.closeGroup()
  }
}
