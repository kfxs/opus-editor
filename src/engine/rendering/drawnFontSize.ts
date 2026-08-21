/**
 * ⭐⭐ **A GLYPH SIZE IS IN POINTS, AND IT IS DRAWN IN PIXELS** — the one conversion every ink table
 * in this folder was missing, and the reason the outside-staff ladder under-modelled its own marks
 * by a quarter.
 *
 * ## The measurement (2026-08-21)
 *
 * His report: a `Ped.` sitting under an `f` on the lower staff of a grand staff, *"the f is almost
 * colliding the Ped"* — while the same pedal under a HAIRPIN looked right. Measured in the browser,
 * with the page's own font metrics:
 *
 * | mark            | drawn `font-size` | ink above baseline | what the ladder believed |
 * |-----------------|-------------------|--------------------|--------------------------|
 * | `Ped.` (E650)   | `26pt` = 34.7 px  | 2.00 sp            | 1.35 sp                  |
 * | `f` (E522)      | `30pt` = 40 px    | 1.80 sp            | 2.04 sp                  |
 *
 * The pedal's 0.65 sp of under-estimate is more than the 0.6 sp of padding the rule leaves, so the
 * two glyphs met. ⭐ A HAIRPIN never showed it because a wedge is drawn by this renderer line by
 * line: its band is known exactly, with no font in the answer.
 *
 * ## Why every family had it
 *
 * `Element.setFont(family, size)` takes a bare number as **points** — VexFlow's own
 * `Font.scaleToPxFrom.pt = 4/3` — and writes `font-size="26pt"` into the SVG, which the browser then
 * draws at 34.7 user units. Every `*_GLYPH_SIZE` here is the number handed to `setFont`, and every
 * ink table read it as pixels and divided by {@link STAFF_SPACE_PX}. The error is a clean ×4/3 and it
 * is in the same direction for all five families (dynamics, pedal, ottava, trill, tempo), which is
 * exactly why it stayed invisible: every lane was too tight by the same quarter, so the ORDER of the
 * ladder was always right and only the AIR between rungs was wrong.
 *
 * ⚠️ It reaches further than the ladder: `DynamicsLayout.registerDynamics` rebuilds a mark's hit-box
 * from the same two constants, so the dynamic's clickable box was a quarter short as well.
 *
 * ⛔ **This is the UNIT, not the taste.** The ink RATIOS beside it (`0.52`, `0.68`, …) are still the
 * first-cut proportions their own files admit to — the table above says the pedal's is 0.577 and the
 * dynamic's 0.45, both measured — and replacing them moves engraving, so they are a separate call
 * (docs/pedal-plan §12.1–2 already owes his eye five of them).
 */
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'

/** VexFlow's own point→pixel factor (`Font.scaleToPxFrom.pt`), named here so the reason travels with
 *  the number. ⛔ Not a CSS constant of ours: it is the unit VexFlow chose for a bare size. */
const PT_TO_PX = 4 / 3

/**
 * How many PIXELS tall a font VexFlow was handed as `sizePt` is actually drawn.
 *
 * @param sizePt the number passed to `setFont(family, size)` / written as `font-size="Npt"`.
 */
export function drawnFontPx(sizePt: number): number {
  return sizePt * PT_TO_PX
}

/**
 * ⭐ **One ink extent, in STAFF SPACES** — `ratio` of the glyph as it is really drawn.
 *
 * The whole of what an outside-staff family needs: hand it the size it gave VexFlow and the fraction
 * of that size its glyph reaches on one side of its own text baseline.
 */
export function inkSpaces(sizePt: number, ratio: number): number {
  return (drawnFontPx(sizePt) * ratio) / STAFF_SPACE_PX
}
