/**
 * ⭐ **THE THIN-LINE WEIGHT — one number for a whole family of marks, named once.**
 *
 * SMuFL's `engravingDefaults` (Bravura) gives the same **0.16 staff spaces** to every thin
 * structural line a score draws: `thinBarlineThickness`, `legerLineThickness`,
 * `octaveLineThickness`, `tupletBracketThickness` and `hairpinThickness`. That is not a
 * coincidence in the font — it is the statement that these marks are one weight, so that a score
 * reads as having been drawn by one hand.
 *
 * ⛔ **So a new thin line does not get to pick a number.** It imports this one. The alternative is
 * what a codebase drifts into on its own: a 0.16 here, a 1.5 px there, and a page whose ledger
 * lines, tuplet brackets and hairpins each look like they came from a different edition. The
 * barline arrived first and named it `THIN_BARLINE_SPACES` (`./barlineInk`, which still owns the
 * separate question of *hinting* one onto the device-pixel grid); this is that same value under the
 * name that says why anything else may use it.
 *
 * ⚠️ In **staff spaces**, never pixels — so it scales with a small staff's `scale(k)` group like
 * everything else drawn there. Convert at the draw site against the stave you are drawing on.
 *
 * ⚠️ It is a HAIRLINE, which is its own hazard: at ordinary zooms 0.16 spaces is around one device
 * pixel, and a one-pixel line straddling two pixel rows renders as two half-lit rows — visibly
 * fatter and greyer than a line that landed on one. See `./barlineInk`'s hinting pass and
 * `reference_thin_lines_need_half_pixel_offset` in the memory index. The defence is the editor's;
 * a print render keeps the true 0.16, because paper has no pixel grid to lose the line to.
 */
export const THIN_LINE_SPACES = 0.16
