/**
 * Styling constants for the SUSTAIN PEDAL — `Ped.` and its release `✻` (docs/pedal-plan.md §5, P2).
 *
 * `./ottavaStyle`'s twin and deliberately the same shape: the family's two clearance numbers, the
 * glyph size, and how far the sign's ink reaches from its own baseline. Everything vertical that is
 * not a measurement of the MUSIC lives here, so `./PedalRenderer` holds no numbers of its own.
 *
 * ⚠️ **Codepoints written out, never `Glyphs.xxx`.** VexFlow's `Glyphs` object is CJS-only and
 * resolves to `undefined` in the browser build — a bug that shows as a blank score rather than as an
 * error (`reference_vexflow_glyphs_esm_vs_cjs`). Every value below was read out of the table VexFlow
 * itself ships (`build/esm/src/glyphs.js`), so they are the font's own, not remembered.
 *
 * ⭐ **THE STYLE IS NOT THE FEATURE.** Today a pedal is two glyphs with nothing between them; the
 * bracket, the hook and the retake notch are a later dress for the same statement (docs/pedal-plan.md
 * header). That swap must land HERE and in the renderer — ⛔ never in the model, which stores no
 * `style` field precisely so this file can be rewritten without touching a score.
 */
import type { Clearance, MarkInk } from '@/engine/layout/inkBand'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'
import { DYNAMIC_TEXT_FONT } from './dynamicStyle'

/** `keyboardPedalPed` — the `Ped.` sign, where the foot goes DOWN. */
export const PEDAL_DOWN_GLYPH = '\uE650'

/** `keyboardPedalUp` — the release ✻, where the foot comes UP. ⭐ The whole of the "third end rule":
 *  it marks a point in TIME, not a note (docs/pedal-plan.md §5.2). */
export const PEDAL_UP_GLYPH = '\uE655'

/**
 * ⭐⭐ **The parentheses around a CONTINUATION `Ped.`** — the reminder on a system the pedal did not
 * start on (docs/pedal-plan.md §5.3).
 *
 * **SMuFL's own, `keyboardPedalParensLeft` / `Right` (U+E676/E677)** — glyphs drawn *for this job*
 * ("left/right parenthesis for pedal marking"), which exist because the practice does.
 *
 * ⚠️ **Owed to his eye, and the ottava is the warning** (§12.5): that family started on SMuFL's
 * dedicated octave parens and he moved it to ITALIC TEXT, because SMuFL's octave numerals are
 * themselves italic and an upright bracket sat against them at a visibly wrong slant. `Ped.` is also
 * an italic-ish sign, so the same call may follow — ⏭️ reverting is three constants, exactly as it
 * was there: `'('` / `')'` in {@link PEDAL_PAREN_FONT}, drawn through the text path with a scale and
 * a raise. Starting on E676/E677 because these are drawn to match THIS glyph, and letting the screen
 * decide.
 */
export const PEDAL_PAREN_LEFT = '\uE676'
export const PEDAL_PAREN_RIGHT = '\uE677'

/** The serif stack a TEXT paren would be set in, if his eye moves this family the way it moved the
 *  ottava's. Unused while the SMuFL pair above is in play — kept named so the swap is three
 *  constants rather than a new decision. */
export const PEDAL_PAREN_FONT = DYNAMIC_TEXT_FONT

/**
 * px, at full staff size — the ottava's and the trill's 26, because all three are the same weight of
 * mark and are read at the same distance.
 *
 * ⚠️ **A first cut, and one of the five numbers owed to his eye** (§12.3). The band the family works
 * in is 2.02–2.42 staff spaces (`reference_engraving_text_sizes`); at `STAFF_SPACE_PX` = 10 this is
 * 2.6, i.e. a touch above it — `Ped.` is a wider mark than `8va` or `tr` and may want to come DOWN
 * rather than up. ⛔ Never state it in px at a draw site: it is here so one number moves it.
 */
export const PEDAL_GLYPH_SIZE = 26

/*
 * Tight vertical ink extent of `Ped.`, from its own text baseline, in px.
 *
 * ⚠️ **First-cut proportions, not a measurement** — a glyph measures 0×0 in jsdom
 * (`reference_jsdom_cannot_measure_glyphs`), so a number computed at load would be a number agreeing
 * with itself; the honest measurement belongs to the browser suite. Unlike the octave numerals,
 * `Ped.` has a real DESCENDER (the `P`'s tail in Bravura's keyboard-pedal glyph), so BELOW is not
 * near-zero the way `OTTAVA_MARK_INK`'s is.
 */
const PEDAL_GLYPH_INK_ABOVE = PEDAL_GLYPH_SIZE * 0.52 // baseline → glyph top
const PEDAL_GLYPH_INK_BELOW = PEDAL_GLYPH_SIZE * 0.18 // baseline → glyph bottom (the descender)

/**
 * How far the pedal's ink reaches either side of its baseline, in STAFF SPACES.
 *
 * ⭐ In the staff's own spaces, which is why no staff size appears here or in the renderer: the sign
 * is drawn inside the staff's `scale(k)` group at a fixed px size, so a small staff's glyph is the
 * same number of ITS spaces as a full-size one's. `ottavaStyle`'s arrangement verbatim.
 */
export const PEDAL_MARK_INK: MarkInk = {
  above: PEDAL_GLYPH_INK_ABOVE / STAFF_SPACE_PX,
  below: PEDAL_GLYPH_INK_BELOW / STAFF_SPACE_PX,
}

/**
 * ⭐ The pedal's two clearance numbers.
 *
 * ⭐⭐ **Its RUNG is not these numbers — it is the pass order**, and that distinction is the ladder.
 * `renderPedals` runs after every other below-staff family and reads what they claimed
 * (`layout/outsideStaffBand`), so it clears them whatever their floors are. Two sources put it
 * outermost: Dorico (*pedal lines go below the bottom staff and outside everything*) and LilyPond's
 * `outside-staff-priority` — pedal spanners **1000** against DynamicLineSpanner 250 and TrillSpanner
 * 50. ⛔ There is no priority table and there must never be one.
 *
 * ⚠️ So `minFromStaff` is only the FLOOR for a bar with nothing else below the staff — it is not what
 * puts the pedal under a dynamic. It is set outside the dynamics line's 2.1 so that even on an empty
 * system the families come out in their proper order, which is belt-and-braces rather than the
 * mechanism.
 *
 * ⚠️ **Taste, and the first two of the five numbers owed to his eye** (§12.1–2): 4.0 is the plan's
 * suggested start (further out than the dynamics line, as the outermost below-staff family must be)
 * and 0.6 is the dynamics line's own padding, borrowed unchanged.
 */
export const PEDAL_LINE: Clearance = {
  padding: 0.6,
  minFromStaff: 4.0,
}

/**
 * ⭐⭐ **How far LEFT of the first note a CONTINUATION `(Ped.)` sits**, in staff spaces — the
 * ottava's `OTTAVA_CONTINUATION_INSET`, at his eye's value for that family (2.0, 2026-08-13).
 *
 * Same cause, same fix: `planSlurSegments`' left edge is `noteStartX`, i.e. where NOTES may begin —
 * after the clef, key and meter — which puts a resumed sign directly over the first notehead. A
 * resumption is a REMINDER, read before the music rather than with it, so it belongs in the space the
 * clef sits in. Clamped at the bar's own left edge at the draw site so it can never reach onto the
 * clef. ⚠️ Taste, and §12.5 asks his eye for it.
 */
export const PEDAL_CONTINUATION_INSET = 2.0

/**
 * ⭐⭐ **THE SHORTEST PEDAL THAT STILL READS AS TWO SIGNS**, in staff spaces — measured from the
 * `Ped.`'s left edge to the `✻`'s right edge.
 *
 * `OTTAVA_MIN_LINE`'s precedent, for the same class of reason and with a different failure at the
 * end of it: the honest geometry can put the lift x so close to the press x that the two glyphs
 * overlap into one smudge. `Ped.` is three glyph-widths of ink and `✻` is round; a pedal over a
 * single sixteenth is narrower than either.
 *
 * ⭐ So when the two would collide, the `✻` is pushed right to keep this much total width. ⚠️ It is
 * the one place the drawing knowingly overruns §5.2's lift x — by at most a space, and only where
 * obeying it exactly would make the pedal unreadable. ⚠️ Taste, §12.6.
 */
export const PEDAL_MIN_SPAN = 3.4

/**
 * ⭐⭐ **AIR BEFORE THE BARLINE**, in staff spaces — how far *inside* the line the `✻` sits when the
 * lift is the bar's end (docs/pedal-plan.md §12.4, one of the five numbers owed to his eye).
 *
 * ⚠️ **It exists because "at the barline" and "inside the barline" are different pictures, and the
 * geometry gives the first for free.** The lift x for a bar-length pedal is that bar's `noteEndX` —
 * where the music's space stops and the line is drawn — so a release right-aligned there has its ink
 * *touching* the barline. Measured, exactly: 250 against 250. Gould's rule is that the release lands
 * at or before the line; a sign leaning on it reads as a sign ON it.
 *
 * ⭐ Applied ONLY on that fallback path — where the lift landed on a barline rather than on a column
 * — so an ordinary mid-bar release still sits exactly on its own column. ⚠️ It is the inverse of
 * `OTTAVA_END_AIR`, which pushes a bracket PAST its last note: this pulls a sign BACK off a line.
 */
export const PEDAL_BARLINE_AIR = 0.4

/**
 * ⭐ Air between the two glyphs when {@link PEDAL_MIN_SPAN} is not in play — the least gap the `✻`
 * keeps from the `Ped.`'s ink, in staff spaces, so a short-but-legal pedal does not look like one
 * sign with a blob after it. The ottava's `OTTAVA_NUMERAL_GAP` (0.3) is the same idea one family
 * over; this is larger because both sides of this gap are solid glyphs rather than a glyph and a
 * dashed line.
 */
export const PEDAL_SIGN_GAP = 0.5
