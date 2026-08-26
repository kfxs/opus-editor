/**
 * ⭐ **HOW FAR OUTSIDE THE STAFF LINES A PRESS STILL COUNTS AS "ON THIS STAFF"** — one number and one
 * predicate, shared by every gesture that has to answer *"which staff did they mean?"*.
 *
 * 🚨 **HIS REPORT, 2026-08-26:** *"why sometimes I'm clicking near the barline and it refuses to
 * write it?"* — six presses in a row declined at y 391 while the same x at y 386 placed a sign. The
 * barline stamp was testing the registered box's own height, which is **exactly the five staff
 * lines**, so a press five pixels under the bottom line was on no staff at all.
 *
 * ⭐ **The editor already had the answer and it was a private constant.** `MouseController`'s
 * measure-click band has padded the staff by 12 px since the box gesture shipped, matching the drawn
 * selection box's ±12 extent — *"click where the box would be → select"*. Two gestures asking the
 * same question with two different tolerances is how a user learns that clicking works *sometimes*,
 * so the number lives here now and both read it.
 *
 * ## ⛔ WHO DOES NOT USE THIS, and why it is not an oversight
 *
 * `interactions/elements/barline.ts` deliberately keeps the UNPADDED band. Its job is to pick *which*
 * barline a press is on when several are candidates, and on a grand staff the padded bands of two
 * staves overlap in the gap between them — where the honest answer is *"neither"*, since a barline is
 * one line per system and the press has not picked a staff. A hit-test that DISAMBIGUATES wants the
 * tight band; a gesture that merely needs to know it is near the music wants this one.
 */

/**
 * Vertical margin (px) added above and below a staff's five lines. Matches the drawn measure box's
 * own ±12 extent (`HighlightController.applyMeasureBox`), which is what makes the rule sayable:
 * **click where the box would be, and the gesture lands.**
 */
export const STAFF_BAND_PAD_PX = 12

/** Whether `y` falls in `box`'s staff band, padded by {@link STAFF_BAND_PAD_PX}. */
export function inStaffBand(box: { y: number; height: number }, y: number): boolean {
  return y >= box.y - STAFF_BAND_PAD_PX && y <= box.y + box.height + STAFF_BAND_PAD_PX
}
