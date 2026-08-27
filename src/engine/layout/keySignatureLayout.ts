/**
 * ⭐⭐ **WHERE A KEY SIGNATURE'S SIGNS GO — the two questions, both answered by a TABLE.**
 *
 * *How much room does the signature take* ({@link keySignatureExtent}) and *which row does each sign
 * sit on* ({@link keySignatureLines}). Pure: staff spaces and staff lines out, no VexFlow, no DOM —
 * `headerInk.ts`'s neighbour, and it takes the `key` part that file prices.
 *
 * ⭐ **`stave.addKeySignature` is never called** (docs/key-signature-plan.md §4). The boundary test —
 * *take a decision from VexFlow only when there is a rule we want to state and cannot* — is passed
 * twice over here: a placement table and a spacing row are rules we can state outright, and SMuFL
 * hands us neither (it defines no key-signature glyphs and no `engravingDefaults` mentioning one, so
 * a signature is drawn with the ordinary accidentals and the distance between them is OURS to say).
 *
 * @see docs/key-signature-research.md §9.4.1b — the table, measured
 * @see docs/key-signature-research.md §9.4.2, §9.4.2b — the spacing, measured twice
 */
import type { Clef, KeySignature, PitchAlter, PitchStep } from '@/types/music'
import { accidentalGlyph, glyphBox } from '@/engine/fonts/fontMetrics'
import { alterToString } from '@/utils/pitchSpelling'
import { staffLineForSpelling } from '@/utils/clefUtils'
import { keysEqual, type StaffKeys } from '@/utils/keySignature'

/**
 * ⭐⭐ **THE GAP BETWEEN TWO SIGNS OF A SIGNATURE — one number, 0.25 staff spaces**, and the reason it
 * is one number rather than a per-glyph pair is the whole argument.
 *
 * Three sources give three flat pitches and two sharp pitches (sign-origin to sign-origin):
 *
 * | | flat → flat | sharp → sharp |
 * |---|---|---|
 * | Ross (stated *and* engraved) | 1.00 | **1.25** |
 * | Gerou & Lusk (measured) | 1.08 | 1.08 |
 * | Gould (measured, 450 dpi) | 1.12 | **1.25** |
 *
 * ⭐ Subtract Bravura's advances (sharp 0.996, flat 0.904) and a single number appears: Gould's pair
 * implies 0.216 and 0.254, Ross's 0.096 and 0.254. **One gap of 0.25 reproduces the twice-confirmed
 * sharp pitch exactly (1.25) and Gould's measured flat to within 0.03 (1.15).**
 *
 * ⭐ Which makes the flat/sharp difference **fall out of the glyph** instead of being two hand-set
 * constants — and that is exactly the cause Ross names: sharps *"expand until the bar-ends align
 * rather than overlap"*. A rule, not a pair of numbers.
 *
 * ⚠️⚠️ **IT IS A PREDICTION, and it is owed his eye.** Ross would call these flats loose by a sixth
 * of a space. It is ONE line to flip to Gould's measured 1.12 or Ross's 1.00 — ⛔ but nobody flips it
 * from a treatise number alone, because the arithmetic above is *why* it is 0.25.
 *
 * ⏳ **The NATURAL's gap is NOT settled by this.** Gould measures naturals at 1.13 pitch over a 0.672
 * advance — a gap of ≈0.46 — and MuseScore and Verovio both give naturals their own larger constant.
 * Naturals appear in a signature only as CANCELLATION (P6); when they do, expect this to need a
 * second row rather than to stretch.
 */
export const KEY_ACCIDENTAL_GAP = 0.25

/**
 * ⭐⭐ **CLEF INK → FIRST SIGN INK: 0.82 staff spaces — and THREE sources land on it independently.**
 *
 * | source | says | in our unit |
 * |---|---|---|
 * | **LilyPond** `define-grobs.scm`, `Clef.space-alist` | `(key-signature . (extra-space . 0.82))` | **0.82** |
 * | **MuseScore** `styledef.cpp` | `styleDef(clefKeyDistance, 0.75_sp)` | **0.75** |
 * | **Ross** p. 143, stated *and* engraved | clef → 1st sharp = 3½ sp **origin to origin**, measured 3.35–3.63 | 3.5 − gClef's 2.684 of ink = **0.82** |
 *
 * ⭐ Ross's is the one that had to be CONVERTED, and the conversion is the repo's standing move for
 * him: his numbers are origin-to-origin **with his own plate's glyph widths**, so they do not
 * transfer to Bravura as-is (`BarlineRenderer` records the same trap, where his 3½ to a repeat left
 * only 0.6 sp before the note). Restated as a gap from the clef's INK edge, his engraving agrees
 * with both engines to two decimal places.
 *
 * 🚨🚨 **THIS WAS 1.5 FOR ONE COMMIT, AND HIS EYE CAUGHT IT: *"isn't the first accidental too far
 * from the clef?"*** The 1.5 came from Gould's p. 42 label (1–1¼) plus §9.4.2b's ink correction
 * (+0.3) — a chain of two inferences, against three sources that state the number outright. ⛔ When a
 * treatise label needs correcting before it can be used, and an engine states the same gap directly,
 * the engine wins.
 */
export const CLEF_TO_KEY_INK = 0.82

/**
 * ⭐⭐ **LAST SIGN INK → TIME SIGNATURE INK: 1.15 staff spaces.**
 *
 * | source | says |
 * |---|---|
 * | **LilyPond** `KeySignature.space-alist` | `(time-signature . (extra-space . 1.15))` |
 * | **MuseScore** `styledef.cpp` | `styleDef(keyTimesigDistance, 1.0_sp)` |
 * | **Gould** p. 42 (figure) | key → time signature "1–1½" |
 *
 * ⭐ All three agree on the band and two of them on the number; LilyPond's is taken because it is
 * stated to the hundredth and it is the same source the gap on the OTHER side comes from — so the
 * two sides of a signature are spaced by one engine's judgement rather than by two.
 *
 * 🚨 **What it replaces was not a decision at all**: before this, the meter simply kept whatever gap
 * VexFlow's own header layout had put between the clef and the meter (≈1.6 sp of ink), and the
 * signature was inserted in front of it. *"Isn't the last accidental too far from the time
 * signature?"* — it was, by half a space, and nobody had chosen the number.
 */
export const KEY_TO_METER_INK = 1.15

/**
 * ⭐ **BARLINE → FIRST SIGN INK: 1.0 staff space** — for a mid-line key change, where no clef stands
 * in front of the signature.
 *
 * **Quoted twice**: research §9.4.2, measured off Gould's own drawing (*mid-system: barline → key =
 * **1.00 sp***), and **MuseScore** `styleDef(keyBarlineDistance, 1.0_sp)`, which `BarlineRenderer`
 * already cites for the other direction.
 *
 * ⚠️ Deliberately NOT {@link CLEF_TO_KEY_INK}: a barline is a thin line and a clef is a tall glyph,
 * and every source measures them separately (LilyPond gives the clef 0.7 to a `staff-bar` and the
 * key signature 1.1).
 */
export const BARLINE_TO_KEY_INK = 1.0

/**
 * ⚠️ **NOT an engraving number — a MODEL correction, labelled as one so nobody quotes it.**
 *
 * `headerExtent` sums PART EXTENTS, and a part measured off VexFlow's drawing carries its own left
 * air inside its extent: `meterExtent` charges **2.4** for a one-digit meter whose ink is **1.88**
 * wide, so the rest of that extent sits before the digit's ink. A key signature's extent is pure INK
 * (summed from the font's advances), so the box gap between them must be the ink gap LESS that air,
 * or the model would reserve more room than the drawing uses.
 *
 * ⚠️ **MEASURED, not derived — 0.6, where the arithmetic says 0.52.** The extra ≈0.08 is
 * `meterExtent`'s own slack: it is itself a measurement written down (2.4 for a `4/4` whose drawn
 * box is nearer 2.3), and this constant absorbs that rather than pretending the two agree. ⛔ Do not
 * "correct" it to 2.4 − 1.88; `e2e/keySignature.e2e.ts` pins the reserved room against the drawn
 * position, and that assertion is what this number answers to.
 *
 * ⭐ The invariant to keep: **`KEY_TO_METER_INK − METER_PART_LEFT_AIR` is what the model charges,
 * and `KEY_TO_METER_INK` is what the reader sees.** Change one and the other follows.
 */
export const METER_PART_LEFT_AIR = 0.6

/** The glyph a signature member is drawn with — the ORDINARY accidentals, per SMuFL. */
function signGlyph(alter: PitchAlter): ReturnType<typeof accidentalGlyph> {
  return accidentalGlyph(alterToString(alter))
}

/**
 * ⭐⭐ **DOES THIS BAR DRAW A SIGNATURE AT ITS HEAD, and which one?** — the ONE owner of that
 * question, because three readers ask it and they must not disagree: the width path (which reserves
 * the room), the stave assembly (which pushes the meter past it) and the drawing pass (which puts
 * the glyphs there). Two of the three answering differently is the two-sets-of-numbers problem
 * `headerInk.ts` was written to end.
 *
 * The rule is the CLEF's, exactly:
 *  - **at a system start, restated** — a reader arriving on a new line is told the key again;
 *  - **mid-line, only where it CHANGES** across the barline: this bar's opening signature against
 *    the previous bar's ending one.
 *
 * ⚠️ Returns the key, not a boolean, and ⛔ does not judge whether it has ink: a change **to** C
 * major is a real change that draws nothing today and will draw cancelling naturals at P6. Emptiness
 * is `keySignatureExtent`'s question, asked once, in `headerExtent`.
 */
export function headerKeyAt(
  keys: StaffKeys, measureNumber: number, isFirstInLine: boolean,
): KeySignature | undefined {
  const opening = keys.opening.get(measureNumber)
  if (!opening) return undefined
  if (isFirstInLine) return opening
  const previousEnding = keys.ending.get(measureNumber - 1)
  if (previousEnding === undefined) return undefined
  return keysEqual(opening, previousEnding) ? undefined : opening
}

/**
 * ⭐ **How wide the signature's ink is, in staff spaces** — `Σ advances + gap × (n − 1)`.
 *
 * ⚠️ **It is COMPUTED FROM THE FONT, not measured off VexFlow's drawing** — the first header part of
 * which that is true, and the direction `font-metrics-plan.md` wants. Which means the browser check
 * that pairs with it is confirming **our arithmetic**, not re-measuring someone else's: it can only
 * catch us drawing the signs somewhere other than where we said they would be.
 *
 * 🚨 **An EMPTY signature must cost NOTHING** — not a gap, not a padding, nothing. C major and an
 * open key draw no glyphs, and `headerExtent` charges a `BETWEEN_PARTS` for every part it is handed:
 * a `key` part that returned 0 instead of being ABSENT would widen the header of every bar of every
 * C-major score, which is every score today.
 */
export function keySignatureExtent(key: KeySignature): number {
  const advances = key.alterations
    .map(a => signGlyph(a.alter))
    .map(g => (g ? glyphBox(g).advance : 0))
  if (advances.length === 0) return 0
  return advances.reduce((sum, w) => sum + w, 0) + KEY_ACCIDENTAL_GAP * (advances.length - 1)
}

/**
 * ⭐⭐ **THE PLACEMENT TABLE — in STAFF STEPS ABOVE THE BOTTOM LINE**, which is the unit it was
 * measured in, so every number here can be checked against the source without arithmetic.
 * `0` = bottom line, `8` = top line, `9` = the space above it, `−1` = the space below.
 *
 * ⭐ **Keyed by LETTER and by DIRECTION, never by position in the list**, and that is what makes a
 * custom signature work: F sharpened sits at 8 in treble while F flattened sits at 1 (F♯5 against
 * F♭4), so a mixed B♭+F♯ takes B from the flat row and F from the sharp row and each lands where a
 * traditional signature would have put it.
 *
 * ✅ **Three independent sources agree on all 56 signs** — Gerou & Lusk pp. 80–81 measured at 400 dpi,
 * Gould's four-clef figure on p. 91 measured, and MuseScore's `ClefInfo::m_lines` read as code. ⛔ So
 * this is not a taste call and does not need one.
 *
 * The rule underneath it, for a reader checking the numbers: **bass = treble − 2, alto = treble − 1,
 * tenor flats = treble + 1** — and 🚨 **tenor SHARPS are the sole exception**: treble + 1 would put
 * G♯ at 10, needing a ledger line, so **F♯ and G♯ alone drop an octave** (to 2 and 3) while the other
 * five stay. ⛔ There is **no alto exception** — if one ever appears in our code it did not come from
 * Gould. And the constraint the drawings actually obey is the weak one, *never needs a ledger line*,
 * ⛔ not "keep the signs inside the staff": her own bass 7-flat puts F♭2 below the bottom line.
 *
 * ⚠️ Written out per clef rather than derived from treble plus an offset. The derivation is real but
 * it has an exception, and a table of 56 numbers that can be read straight off the source beats four
 * lines of arithmetic that hide one — the same choice all three engines made.
 */
const SHARP_STEPS: Record<Clef, Record<PitchStep, number>> = {
  //        F♯ C♯ G♯ D♯ A♯ E♯ B♯
  treble: { F: 8, C: 5, G: 9, D: 6, A: 3, E: 7, B: 4 },
  bass: { F: 6, C: 3, G: 7, D: 4, A: 1, E: 5, B: 2 },
  alto: { F: 7, C: 4, G: 8, D: 5, A: 2, E: 6, B: 3 },
  // 🚨 F and G alone drop an octave from treble + 1 — see the note above.
  tenor: { F: 2, C: 6, G: 3, D: 7, A: 4, E: 8, B: 5 },
}

const FLAT_STEPS: Record<Clef, Record<PitchStep, number>> = {
  //        B♭ E♭ A♭ D♭ G♭ C♭ F♭
  treble: { B: 4, E: 7, A: 3, D: 6, G: 2, C: 5, F: 1 },
  bass: { B: 2, E: 5, A: 1, D: 4, G: 0, C: 3, F: -1 },
  alto: { B: 3, E: 6, A: 2, D: 5, G: 1, C: 4, F: 0 },
  tenor: { B: 5, E: 8, A: 4, D: 7, G: 3, C: 6, F: 2 },
}

/**
 * Convert this file's measured unit into the one a `Stave` speaks: the line number a `NoteHead` and
 * `Stave.getYForNote` use, where **1 is the bottom line, 5 the top**, and a step is half of one —
 * `staffLineForSpelling`'s convention.
 *
 * 🚨 **Both counts run UPWARD, and the first draft of this got it backwards** (`5 − steps/2`), which
 * agrees with itself everywhere: the table's own numbers came out mirrored through the middle line,
 * so a treble F♯ landed on the BOTTOM line and every test written against it passed. The one
 * assertion that caught it was the {@link KeyAlteration.octave} override, because that path goes
 * through `staffLineForSpelling` itself and the two conventions then had to agree. ⛔ Do not test
 * this file's placement only against its own arithmetic — name the PITCH each line is.
 *
 * ⚠️ It is NOT VexFlow's `Stave.getYForLine`, which counts 0 at the TOP and downward. Three
 * conventions live within one call chain here; this is the one that has a note on it.
 */
function stepsToStaffLine(steps: number): number {
  return 1 + steps / 2
}

/**
 * ⭐ **Where each sign of a signature is drawn** — one VexFlow staff line per alteration, in the
 * list's own (authored) order.
 *
 * ⚠️ {@link KeyAlteration.octave} is a PLACEMENT override and this is the only place it is read: it
 * moves the glyph, and it never changes which octaves the signature governs (that is `keyAlterOf`,
 * and it is per-letter in all octaves — Gould pp. 93–94). An override resolves through
 * `staffLineForSpelling`, so it is stated as the MUSICAL octave the sign is drawn at and the clef
 * converts, exactly as LilyPond and MusicXML both express it.
 *
 * A letter altered by nothing (`alter: 0`) has no row of its own — it is not a signature member but
 * a cancellation, which is drawn at the OUTGOING signature's position (P6) and not here.
 */
export function keySignatureLines(key: KeySignature, clef: Clef): number[] {
  return key.alterations.map(a => {
    if (a.octave !== undefined) return staffLineForSpelling(a.step, a.octave, clef)
    const table = a.alter >= 0 ? SHARP_STEPS : FLAT_STEPS
    return stepsToStaffLine(table[clef][a.step])
  })
}
