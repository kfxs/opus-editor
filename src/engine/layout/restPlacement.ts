/**
 * ⭐⭐ **WHICH LINE A REST IS DRAWN ON** — one rule, read by the model AND by the drawing.
 *
 * A rest is the one drawn thing whose vertical position is not a pitch: it goes at a fixed place on
 * the staff that depends only on its duration. Two parts of the app need that place and they used to
 * decide it separately — `rendering/NoteBuilder.ts` by picking a VexFlow key, `layout/spacingPadding`
 * by naming a band — which is exactly how they came to disagree (below). ⛔ **So neither of them
 * decides it any more.** They both read this.
 *
 * ## The rule, in Gould's own words
 *
 * > *"The semibreve hangs from the second line down; the minim rest sits on the centre stave-line."*
 * > — Elaine Gould, **Behind Bars**, p. 34
 *
 * Two lines, and they are not the same line:
 *
 * - ⭐ A **whole (semibreve) rest HANGS FROM the fourth line** — Gould's "second line down".
 * - A **half (minim) rest SITS ON the middle line**, and every shorter rest is anchored there too.
 *
 * ⭐ Independently confirmed by **Byrd, *Music Notation by Computer*** (1984), Appendix I p. I-14,
 * whose SMUT rest command documents a shift of *"-6 … WOULD LEAVE A WHOLE REST HANGING FROM THE
 * BOTTOM LINE"* — six half-spaces below normal, so normal is three spaces above the bottom line:
 * the fourth line, reached by arithmetic from a completely different direction.
 *
 * ⭐ **They are mirror images meeting in the middle of ONE space.** The whole rest fills the top half
 * of the space between the middle line and the line above it; the half rest fills its bottom half.
 * That picture is the quickest check that this table is right, and the quickest tell when it is not.
 *
 * ## ⚠️ The font already encodes half of this, which is easy to mistake for all of it
 *
 * Bravura registers the two glyphs on opposite sides of their own origin — `restWhole` has 0.036 of
 * ink above it and 0.540 **below**; `restHalf` has 0.568 **above** and 0.008 below (they are the same
 * shape, the same width). So the origin IS the attachment line in each case. But *which* line it
 * attaches to is not in the font, and no amount of measuring glyphs recovers it
 * (docs/font-metrics-plan.md §3.4a).
 *
 * ## 🚨 Why this module exists: we drew it wrong, for as long as we have drawn rests
 *
 * `NoteBuilder` gave **every** rest the key `b/4` — the middle line — and VexFlow puts a rest exactly
 * where its key says (`getLineForRest()` returns the key's line unchanged; VexFlow has no placement
 * rule of its own, and its own test files disagree with each other, `rests_tests.js` using `b/4`
 * where `stave_tests.js` uses `d/5`). Right for a half rest; **one staff space too low for a whole
 * rest**, in every empty bar in the app.
 *
 * The three reference engines are unanimous, and say it in three notations:
 *
 * | | whole rest | half and shorter | measure rest |
 * |---|---|---|---|
 * | LilyPond (`staff-position`, half-spaces, + up, 0 = middle) | **+2** | 0 | **+2** |
 * | MuseScore (`line`, spaces, + down, 0 = top line) | **1** | 2 | **1** |
 * | Verovio (`loc`, half-spaces, + up, 0 = bottom line) | **6** | 4 | **6** |
 *
 * …three spellings of one line. LilyPond's `rest.cc` puts the reason in a comment: *"make a semibreve
 * rest hang from the next available line"*, and its neighbour states the whole convention —
 * *"half rests need ledger if not lying on a staff line, whole rests need ledger if not hanging from
 * a staff line"*.
 *
 * ⭐⭐ **A whole-BAR rest is not a special case here.** All three engines place it exactly where they
 * place a duration whole rest, and MuseScore does not even distinguish them (`V_MEASURE` falls
 * through to `V_WHOLE`). ⚠️ They *do* special-case a bar of a **breve or longer**, which draws a
 * double-whole rest on the middle line instead — we have no breve, so that row is not here. It is the
 * row to add if one ever arrives.
 */

import type { NoteDuration } from '@/types/music'

/**
 * ⭐⭐ **This table gives each rest an ANCHOR, not a bounding box — and that is the right seam.**
 *
 * The shorter rests are not symmetric about the middle line, and Gould never says they are: a
 * crotchet rest spans the top space to the bottom space, a quaver *"sits above the middle
 * stave-line and extends down to the second stave-line from the bottom"*, a 32nd takes the top
 * three spaces. ⛔ **An engine that centred those glyphs BY BOUNDING BOX would land several of them
 * wrong.** The asymmetry belongs to the glyph's own design, so the model's job is to put the origin
 * on the right line and let the font carry the rest — which is exactly what LilyPond does
 * (`rest.cc`: `duration_log > 1` returns the middle position unchanged) and what {@link restBand}
 * does when it adds the font's own `up`/`down` to the line named here.
 */

/**
 * The vertical axis, stated once because three of them are in play: **staff spaces BELOW the top
 * line**, so the top line is 0, the middle 2 and the bottom 4. The same axis `layout/kerning.ts`
 * measures its bands on, and the same one `measureColumns` builds them in.
 *
 * ⚠️ It is not VexFlow's (which counts 1 = bottom to 5 = top) and not LilyPond's (half-spaces from
 * the middle, upward). The renderers convert; ⛔ nothing here speaks another engine's units.
 */
const MIDDLE_LINE = 2

/** The fourth line counting up from the bottom — the second from the top. */
const FOURTH_LINE = 1

/** Which line each rest is drawn on. See the header for where these two numbers come from. */
const REST_LINE: Record<NoteDuration, number> = {
  w: FOURTH_LINE,
  h: MIDDLE_LINE,
  q: MIDDLE_LINE,
  '8': MIDDLE_LINE,
  '16': MIDDLE_LINE,
  '32': MIDDLE_LINE,
}

/**
 * The line a rest of this duration hangs from or sits on, in staff spaces below the top stave line.
 *
 * ⛔ **The drawing must read this too, not a key of its own.** Whatever the renderer hands VexFlow
 * has to come from here, or the model measures one place while the picture uses another — which is
 * the defect this module was extracted to end, not merely to record.
 */
export function restStaffLine(duration: NoteDuration): number {
  return REST_LINE[duration] ?? MIDDLE_LINE
}
