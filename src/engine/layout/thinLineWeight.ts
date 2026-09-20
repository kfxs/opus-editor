/**
 * ⭐ **THE THIN-LINE WEIGHT — one number for a whole family of marks, named once.**
 *
 * SMuFL's `engravingDefaults` (Bravura) gives the same **0.16 staff spaces** to every thin
 * structural line a score draws: `thinBarlineThickness`, `legerLineThickness`,
 * `octaveLineThickness`, `tupletBracketThickness` and `hairpinThickness`. That is not a
 * coincidence in the font — it is the statement that these marks are one weight, so that a score
 * reads as having been drawn by one hand.
 *
 * ⭐⭐ **And it is now READ from the font rather than typed** (F3, docs/plans/font-metrics-plan.md):
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
 * ⭐⭐ **THE HAIRPIN LEFT THIS FAMILY ON 2026-08-18 — see {@link HAIRPIN_LINE_SPACES} — and this
 * paragraph is the history that made that a decision rather than a drift.**
 *
 * It had been taken out once before, on 2026-08-15, and put back the same day:
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
 * MuseScore's 0.12: put back to *"the size of the beginning."* So the engines were outvoted by the
 * only test that decides a taste number. ⭐ That paragraph then said *"do not try it again without
 * new evidence"* — and on 2026-08-18 the evidence arrived, in the form of a RULE rather than another
 * vote. See {@link HAIRPIN_LINE_SPACES}. The convergence is real and unfixed either way; the lever
 * for it is the MOUTH (`hairpinShape`'s `HAIRPIN.APERTURE`, which did move, 1.33 → 1.5) or a minimum
 * opening angle, **not the stroke**.
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

/**
 * ⭐⭐ **A HAIRPIN IS DRAWN AT THE WEIGHT OF A STAFF LINE — 0.13 spaces, and it is the FONT's
 * `staffLineThickness`, not a number anybody chose.**
 *
 * His report, 2026-08-18, comparing our render against Gould's page: *"why her hairpin looks
 * better? maybe because of the stroke of my hairpin that is too thick"*. He was right, and the
 * reason is a row nobody had looked at.
 *
 * ## ⭐⭐ Both treatises state it, by name
 *
 * **Gould, *Behind Bars*, printed p. 103**, the opening line of *Crescendo/diminuendo signs*:
 *
 * > "Hairpins are the thickness of a stave-line. The open end should not be more than two
 * > stave-spaces wide."
 *
 * **Ross, *The Art of Music Engraving*, printed p. 187**, independently:
 *
 * > "Each of the lines that form the wedge shape is no thicker than a staff line. The width of the
 * > open end of the wedge is no more than a space and a half."
 *
 * ⭐ So the hairpin was never in the thin-BARLINE family. It is in the STAFF-LINE family, which has
 * one other member. That is why leaving is a rule and not a taste number: `THIN_LINE_SPACES` remains
 * the one weight for barlines, ledger lines, octave lines and tuplet brackets, and both weights stay
 * transcriptions of the font.
 *
 * ## ⭐⭐ And her drawing agrees — MEASURED, 11 wedges over three figures
 *
 * Printed pp. 105 and 107 rendered at 450 dpi, integrated ink per column, staff lines sampled only
 * where a column carried exactly five isolated runs and arms only where the two were ≥13 px apart
 * (so noteheads, the tip and the mouth are all excluded):
 *
 * | figure | staff line | hairpin arm | ratio |
 * |---|---|---|---|
 * | p. 105 *THROUGH BARLINES* | 0.1116 sp | 0.1122 sp | **1.005** |
 * | p. 105 *HORIZONTAL ALIGNMENT* | 0.1129 sp | 0.1160 sp | **1.028** |
 * | p. 107 *INTERIM DYNAMICS* | 0.116 sp | 0.113 sp | **0.967** |
 *
 * ⚠️ The ABSOLUTE swings by 2× with the anti-aliasing threshold (0.09–0.18 sp); **the RATIO does
 * not** — 0.97–1.03 at every threshold. So what her page proves is the relation, not the number,
 * which is exactly what the two sentences above say.
 *
 * ## 🚨 The row that made ours look heavy: OUR STAFF LINE IS NOT THE FONT'S
 *
 * VexFlow never sets a stroke width for a stave, so a staff line is the SVG context default — **1
 * px**, i.e. 0.10 spaces at `STAVE_LINE_DISTANCE = 10`. The hairpin, meanwhile, converted 0.16
 * spaces against the stave: **1.6 px**. So the drawn ratio was **1.60**, where Gould is 1.00 and the
 * widest engine (Verovio) is 1.33 — outside the whole field, and against the one thing an eye
 * compares a hairpin to. ⭐ `layoutConfig.ts` had already caught this exact trap for the LEDGER LINE
 * and written it down; it was never applied here.
 *
 * ⚠️ It also explains why 0.10 and 0.12 read *"too thin"* when they were tried: a staff line is
 * pixel-HINTED onto the device grid and stays solid, while a DIAGONAL hairpin cannot be and smears
 * into grey. Same cause, opposite symptom.
 *
 * ⏭️ **THE REAL FIX IS TO RAISE THE STAFF LINE, NOT TO LOWER THE HAIRPIN** (his call, 2026-08-18:
 * *"we should somehow at some point in the future take control of the staff line width, so
 * everything looks neat"*).
 *
 * ✅ **HALF DONE, 2026-09-01 — and the number is not the one this note assumed.** P5a took control of
 * the staff line (`engine/engrave/staff/staffLines`), and he then chose **Gould's measured 0.11 sp**
 * over Bravura's 0.13 (decision A, `docs/research/staff-line-research.md` §8), because **no treatise states a
 * thickness at all** and her own engraved staves measure 0.110–0.111.
 *
 * ⇒ ⭐ the gap this comment is about **narrowed from 1.30× to 1.18×**, ⛔ but did not close: a hairpin
 * is still heavier than the staff line it is supposed to EQUAL (Gould p. 103, Ross p. 187, and her
 * plate at ratio 0.97–1.03).
 *
 * ## ✅ AND HE CLOSED IT THE OTHER WAY — decision D, 2026-09-01: **KEEP 0.13**
 *
 * ⛔ **So the 1.18× is now DELIBERATE, ⛔ not a leftover, and ⛔ not something to "finish" later.**
 * Presented with *"make them equal, which is what both books say and what she draws"* against
 * *"keep the difference"*, he took the difference. ⭐ The reason is in this file already and it is
 * about OUR OUTPUT rather than her page: **his eye rejected 0.10 and 0.12 as "too thin"**, because a
 * horizontal staff line hints onto the device grid and stays solid while a DIAGONAL hairpin cannot
 * and smears into grey. A plate cannot overrule a measurement of what this editor actually renders.
 *
 * 🚨 **Do NOT re-open this by citing Gould p. 103 or Ross p. 187.** Both were read, quoted and
 * weighed when the decision was made (`docs/research/staff-line-research.md` §8 D). ⏳ The question that IS
 * still open is **F — screen versus paper**, which is the real cause; if that is ever settled with
 * separate weights for the two media, this row is worth revisiting THEN.
 *
 * ⭐ And per his standing directive, this is a HOUSE STYLE'S answer: the user will be able to set a
 * different hairpin weight (`project_engraving_defaults_are_a_house_style`).
 */
export const HAIRPIN_LINE_SPACES = engravingDefault('staffLineThickness')
