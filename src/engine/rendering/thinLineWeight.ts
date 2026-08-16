/**
 * ⭐ **THE THIN-LINE WEIGHT — one number for a whole family of marks, named once.**
 *
 * SMuFL's `engravingDefaults` (Bravura) gives the same **0.16 staff spaces** to every thin
 * structural line a score draws: `thinBarlineThickness`, `legerLineThickness`,
 * `octaveLineThickness`, `tupletBracketThickness` and `hairpinThickness`. That is not a
 * coincidence in the font — it is the statement that these marks are one weight, so that a score
 * reads as having been drawn by one hand.
 *
 * ⭐⭐ **And it is now READ from the font rather than typed** (F3, docs/font-metrics-plan.md):
 * `engravingDefault('thinBarlineThickness')` out of `engine/fonts/`. The five names above are one
 * value in Bravura, so any of them would do; the barline is named because it is the member this
 * family was first extracted from.
 *
 * ⚠️ **Deriving is right HERE and wrong for the ink table**, which keeps its literals and merely
 * checks them (`layout/spacingPadding.font.test.ts`). The difference is what the number IS: an ink
 * extent is our own MEASUREMENT of what we draw, and it diverges from the font on purpose in places
 * (a clearance is rounded out). A weight is a TRANSCRIPTION of the font's own statement — there is
 * no independent claim to preserve, so the only thing a literal could add is a typo.
 *
 * ⛔ **So a new thin line does not get to pick a number.** It imports this one. The alternative is
 * what a codebase drifts into on its own: a 0.16 here, a 1.5 px there, and a page whose ledger
 * lines, tuplet brackets and hairpins each look like they came from a different edition. The
 * barline arrived first and named it `THIN_BARLINE_SPACES` (`./barlineInk`, which still owns the
 * separate question of *hinting* one onto the device-pixel grid); this is that same value under the
 * name that says why anything else may use it.
 *
 * ⭐⭐ **THE HAIRPIN WAS TAKEN OUT OF THIS FAMILY ON 2026-08-15 AND PUT BACK THE SAME DAY. Do not
 * try it again without new evidence.**
 *
 * The case for leaving looked strong. All four reference engines override SMuFL downward for that
 * one mark, by about half — LilyPond `thickness 1.0` against a thin barline's `hair-thickness 1.9`;
 * MuseScore `hairpinLineWidth 0.12_sp` against `barWidth 0.18_sp`; Verovio 0.1 sp; GUIDO 0.08 sp —
 * and a hairpin has a property no other line here has: **its two strokes CONVERGE**, so near the
 * closed end they land closer together than their own width and read as one heavy line rather than
 * a wedge. A long crescendo of his did exactly that, and the stretch it happens over is directly
 * proportional to this number.
 *
 * ⛔ **His eye rejected it twice.** Verovio's and LilyPond's 0.10: *"now the line is too thin."*
 * MuseScore's 0.12: put back to *"the size of the beginning."* So the engines are outvoted here by
 * the only test that decides a taste number, and 0.16 — SMuFL's own figure, and this family's — is
 * what a hairpin is drawn at. The convergence is real and unfixed; the lever for it is the MOUTH
 * (`hairpinShape`'s `HAIRPIN.APERTURE`, which did move, 1.33 → 1.5) or a minimum opening angle,
 * **not the stroke**.
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
import { engravingDefault } from '@/engine/fonts/fontMetrics'

export const THIN_LINE_SPACES = engravingDefault('thinBarlineThickness')
