/**
 * ⭐⭐ **THE CAUTIONARY KEY SIGNATURE — where a key change that lands on a system break is ENGRAVED.**
 *
 * P6 of docs/key-signature-plan.md, and its own module rather than a third copy of the loop in
 * `MeasureLayout` (CLAUDE.md's rule: a new feature adds a MODULE). The two that are there already —
 * `applyCautionaryClefs` and `applyCautionaryTimeSignatures` — differ from this one in three ways, so
 * ⛔ do not collapse the three until there is a reason beyond their shape:
 *
 *  - **it has no opt-in gate.** The clef's and the meter's courtesies require an authored override
 *    (`cautionaryClefAllowedOf` / `cautionaryAllowedOf`) because they are WARNINGS. This one is not a
 *    warning, it is where the change is drawn (see below), so it is unconditional;
 *  - **the room is taken from the LINE, not from the bar** (see {@link cautionaryKeyRoom});
 *  - **it is per staff** like the clef's and unlike the meter's, because a key is per-staff content.
 *
 * ## ⭐⭐ IT IS NOT AN OPTION — Gould, printed p. 93, verbatim
 *
 * *"When a key change coincides with a system break, **the cancelling naturals and the new key
 * signature go at the end of the first system. The new system takes only the new key signature.**"*
 * No option to omit is offered and her drawing does not parenthesise it. **Gerou & Lusk p. 78**
 * (⚠️ p. 78, not p. 28 — the first pass mis-cited it) gives it as numbered rules, rule 3 being *"The
 * staff is left open after the courtesy key signature"*; Ross p. 148 agrees (*"a key change should be
 * made at the end of a staff or system (the staff remains open)"*), **MOLA requires** it, all three engines and all four applications default to it, and Dorico
 * cannot switch it off. ⏭️ A per-change suppression is a future row (his *"everything can be tuned…
 * but this is not priority now"*) and ⛔ must not be built by inverting the other two kinds' override
 * table — presence meaning "allowed" for two kinds and "suppressed" for a third, with nothing in the
 * code saying so, is the trap that note exists to prevent.
 *
 * ## ⭐⭐ AFTER THE BARLINE, AND THE STAFF IS LEFT OPEN
 *
 * ⭐ **Measured off Gould's p. 93 figure** (600 dpi, 1 sp = 26.5 px — ⚠️ the first pass labelled the
 * same measurement 450 dpi, which would give 19.9 px; the number was right and the label was not):
 * the cautionary sits **0.64–0.72 sp** after the system's last barline across three instances, which
 * is what our 0.75 rounds to, and there is **no barline after it** — ⭐ which all three engines
 * confirm from their own source (MuseScore's `addSystemTrailer` creates key/time/clef courtesies and
 * no line; LilyPond's end-of-line `break-align-orders` put `staff-bar` FIRST; Verovio's
 * `DrawStaffDefCautionary` draws only those glyphs). ⚠️ MuseScore additionally DOUBLES the barline
 * *before* a courtesy key by default (`CourtesyBarlineMode::DOUBLE_BEFORE_COURTESY`) — ⛔ we do not,
 * and that is his standing decision, reversed the same day he made the first one (plan §4.2b).
 *
 * G&L p. 52 states the asymmetry that goes with it: a courtesy CLEF goes *before* the last barline, a
 * courtesy key signature and time signature *after* it.
 *
 * ⚠️ **So the room cannot be added to the bar's width**, which is what the meter's courtesy does: a
 * bar's own barline is drawn at its right edge, so room added inside puts the ink BEFORE the line.
 * {@link cautionaryKeyRoom} shortens the LINE instead — the bars justify into a narrower span and the
 * leftover is the courtesy's, past the last barline. ⏭️ The meter's courtesy is drawn on the wrong
 * side of the line by the same reasoning and is NOT fixed here (it is the meter's own change, and it
 * moves every courtesy meter in every score) — recorded in plan §8.6 rather than quietly bundled.
 */
import type { Clef, KeySignature } from '@/types/music'
import type { StaffKeys } from '@/utils/keySignature'
import { keyChangeRow, keySignatureExtent } from './keySignatureLayout'

/**
 * ⭐⭐ **How far after the last barline the courtesy's first sign begins — 0.75 staff spaces.**
 *
 * Measured off Gould's p. 93 engraving of exactly this case (barline right edge → first sign of the
 * cautionary), and the same 0.75 sp appears on her p. 92 figure for a mid-score change measured the
 * same way. ⛔ Not {@link BARLINE_TO_KEY_INK}'s 1.0, which is LilyPond's number for a signature
 * inside a bar's header — this gap is on the other side of the line and has its own measurement.
 */
export const BARLINE_TO_CAUTIONARY_KEY_INK = 0.75

/**
 * ⭐⭐ **The bare staff left after the courtesy — 0.5 staff spaces, and ALL THREE ENGINES say it.**
 *
 * | engine | the number, in source |
 * |---|---|
 * | MuseScore | `Sid::systemTrailerRightMargin`, default `0.5_sp` (`style/styledef.cpp:228`), added at `horizontalspacing.cpp:1176` — *"} else if (nextSeg->trailer()) { nextSegWidth = nextSeg->minRight() + …systemTrailerRightMargin"* |
 * | LilyPond | `KeySignature.space-alist` — **`(right-edge . (extra-space . 0.5))`** (`scm/define-grobs.scm:1996`), and the identical entry on `KeyCancellation` (`:1947`) |
 * | Verovio | `rightMarginKeySig`, default `1.0` MEI unit (`src/options.cpp:1787`), and a unit is *"1⁄2 of the distance between the staff lines"* — i.e. 0.5 sp |
 *
 * 🚨 **AND OUR DEFAULT IS 0.75 — HIS CHOICE, and it is deliberately BETWEEN the two answers.**
 * The literature and the implementations disagree by almost a space and a half:
 *
 * | source | trailing gap |
 * |---|---|
 * | Gould p. 93, measured — three instances, 1.89 / 1.85 / 2.08 | **≈1.9 sp** |
 * | ⚠️ Gerou & Lusk pp. 78 and 52, measured — the only MATCHED PAIR in the library (courtesy staff and the staff below it drawn to the same right edge) | **0.42 / 0.53 sp** |
 * | MuseScore / LilyPond / Verovio, in source (table above) | **0.5 sp** |
 * | ⭐ **ours** | **0.75 sp** |
 *
 * ⭐⭐ **AND THE DRAWN EVIDENCE SAYS IT IS A RESIDUAL, NOT A CONSTANT** — the finding that makes the
 * control below more than a convenience. ⛔ **No source states a distance at all**: G&L p. 78 rule 3
 * says only *"the staff is left open"*, Ross p. 148 the same. Gould's ~1.9–2.1 sp comes from
 * free-length EXCERPTS (her staff ends far short of the text measure), while G&L's 0.4–0.5 sp comes
 * from figures drawn to a FIXED width — so the two disagree because one is a leftover and the other
 * is a margin, not because the engravers disagreed. Our tail is a leftover too: the line gives up
 * `0.75 + ink + this`, so the staff runs to the margin exactly as G&L's matched pair does.
 *
 * His words, 2026-08-28, on the 1.9: *"i think we dont need that much space"*; then on the 0.75 that
 * replaced it, after the engines' 0.5 came in: *"i liked it, it was a good compromise between gould
 * and what the engines say."* ⛔ So this is a CHOSEN default, not a copied one, and neither source is
 * a reason to move it on its own — a change needs his eye, because the disagreement is the point.
 *
 * ⭐ **It is also the gap on the other side** ({@link BARLINE_TO_CAUTIONARY_KEY_INK}), so the courtesy
 * is framed by equal air — one number in the picture rather than two. ⚠️ That is a happy coincidence
 * of the compromise, not its justification; the two constants stay separate because one is a spacing
 * rule (measured, Gould p. 93) and the other is a default a user may overrule.
 *
 * ⭐ **And the author can change it** ({@link CautionaryKeyGapOverride} + the Properties row that
 * writes it) — his ask in the same breath, and the reason it matters: with the sources this far apart,
 * a default should not be the last word.
 */
export const CAUTIONARY_KEY_TO_LINE_END = 0.75

/** What one staff draws at the end of a line, and what the line pays for all of them. */
export interface CautionaryKeyPlan {
  /** Per staff INDEX: the row (cancelling naturals + the new signature) that staff draws, or
   *  undefined where its key does not change across the break. */
  rows: (KeySignature | undefined)[]
  /** ⭐ The room the LINE gives up, in staff spaces — the WIDEST staff's row plus the gaps either
   *  side of it. Charged once: the courtesies of a grand staff sit at one x. */
  room: number
  /** The bare staff drawn after the last sign — the default, or the author's own. The DRAWING needs
   *  it separately from `room`, which has the ink and the leading gap folded in. */
  trailing: number
}

/**
 * The courtesy this boundary needs, or **null when no staff changes key across it**.
 *
 * @param keysByStaff each staff's resolved key walk (`resolveStaffKeys`), by staff id
 * @param staffIds the score's staves in order — the index of each is what {@link CautionaryKeyPlan.rows} is keyed by
 * @param clefOf that staff's clef at the boundary, for placing the cancelling naturals
 * @param endsLine the measure the current line ENDS with
 * @param opensNextLine the measure the next line OPENS with
 */
export function cautionaryKeyAt(
  keysByStaff: Map<string | undefined, StaffKeys>,
  staffIds: readonly (string | undefined)[],
  clefOf: (staffIndex: number) => Clef,
  endsLine: number,
  opensNextLine: number,
  /** ⭐ The author's own trailing gap for this change, in staff spaces, or undefined for the
   *  engraver's ({@link CAUTIONARY_KEY_TO_LINE_END}). Handed in rather than looked up, so this module
   *  stays a pure rule over a walk — the score is the caller's to hold. */
  authoredGap?: number,
): CautionaryKeyPlan | null {
  const rows: (KeySignature | undefined)[] = []
  let widest = 0

  staffIds.forEach((staffId, staffIndex) => {
    const keys = keysByStaff.get(staffId)
    if (!keys) return
    const outgoing = keys.ending.get(endsLine)
    const incoming = keys.opening.get(opensNextLine)
    if (!outgoing || !incoming) return
    // ⭐ THE SAME ROW a mid-line change would draw — Gould p. 93 makes them one question
    //   (`keyChangeRow`), so there is no second rule here to drift from that one.
    const row = keyChangeRow(incoming, outgoing, clefOf(staffIndex))
    if (!row) return
    rows[staffIndex] = row
    widest = Math.max(widest, keySignatureExtent(row))
  })

  if (widest === 0) return null
  // ⭐ An authored gap REPLACES the default rather than adding to it — the hairpin aperture's rule
  //   (`HairpinApertureOverride`): a hand-set number is a human answering what the default guesses.
  //   ⚠️ `?? `, never `||`: a gap of 0 is a real answer ("no tail at all") and must not fall back.
  const trailing = authoredGap ?? CAUTIONARY_KEY_TO_LINE_END
  return { rows, room: BARLINE_TO_CAUTIONARY_KEY_INK + widest + trailing, trailing }
}

/**
 * ⭐⭐ **The room a line gives up for its courtesy, in PIXELS** — subtracted from the width the line's
 * bars justify into, so the ink lands past the last barline rather than inside the last bar.
 *
 * ⚠️ A separate function from {@link cautionaryKeyAt} only so the two questions stay legible at the
 * call site: *does this boundary need one* and *what does it cost the line*.
 */
export function cautionaryKeyRoom(plan: CautionaryKeyPlan, staffSpacePx: number): number {
  return plan.room * staffSpacePx
}
