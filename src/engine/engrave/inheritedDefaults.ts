/**
 * ⭐⭐ **THE NUMBERS WE INHERITED — one table, each row today's value and where it came from.**
 * S1b of `docs/history/vexflow-removal-map.md`.
 *
 * Every number below used to be read out of the drawing library at run time (`Tables.STEM_WIDTH`,
 * `Metrics.get('Stave.padding')`…). They are the defaults the editor has always drawn with, so they
 * are copied here EXACTLY — no pixel moves — and attributed, because the drawing library is MIT and
 * its notice travels with what we took (`docs/plans/own-engraving-engine.md` §6.7).
 *
 * ## ⭐ These are ROWS of one house style, not laws (`docs/plans/own-engraving-engine.md` rule 13)
 *
 * Each is a default a user will one day be able to change, and several already have their
 * alternatives researched — the future preset menu:
 *
 * | row | research |
 * |---|---|
 * | {@link STEM_THICKNESS_PX} | `docs/research/stem-thickness-research.md` (Gould's plates ≈0.11 sp, fonts 0.08–0.20) |
 * | {@link STEM_LENGTH_PX} | `docs/research/stem-length-research.md` — ⭐ the one row the research CONFIRMS rather than disputes |
 * | {@link LEDGER_OVERHANG_PX} | `docs/research/ledger-line-length-research.md` (Gould's and Ross's plates ≈0.40 sp) |
 * | {@link TREMOLO_STROKE_STEP_PX} | `docs/research/tremolo-tuplet-research.md` (Gould 0.75 sp, MuseScore 0.8) |
 *
 * ⛔ Gathering them into one house-style object is agreed and deferred (§0.2). ⚠️ And while the
 * drawing library still formats and draws beams, a row it ALSO reads internally must keep its value
 * (the stem thickness enters its `getStemX()`; the note-area padding its `getAbsoluteX()`) — changing
 * one before steps S2–S7 would move our ink off its own geometry.
 */
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'
import { engravingDefault, ratioToDefault } from '@/engine/fonts/fontMetrics'
import type { NoteDuration } from '@/types/music'

/** A stem's stroke — 0.15 staff spaces. Taken from `Tables.STEM_WIDTH` = 1.5 (`tables.js:595`). */
export const STEM_THICKNESS_SPACES = 0.15

/**
 * ⭐ A FUNCTION since the music face became a choice (`docs/plans/music-font-switch-plan.md`,
 * follow-up 2): 0.15 sp is the weight AGAINST BRAVURA (whose `stemThickness` is 0.12), and another
 * face keeps that proportion of its own — Leipzig's 0.076 draws at 0.095 sp, Sebastian's 0.125 at
 * 0.156. Exactly 1.5 px for Bravura. ⛔ Never freeze it in a module constant.
 */
export function stemThicknessPx(): number {
  return ((STEM_THICKNESS_SPACES * 100 * STAFF_SPACE_PX) / 100) * ratioToDefault(() => engravingDefault('stemThickness'))
}

/**
 * ⭐⭐ **A STEM'S DEFAULT LENGTH — 3.5 staff spaces, measured from the notehead the stem stands on.**
 * Taken from `Tables.STEM_HEIGHT` = 35 (`tables.js:597`), and ⭐ **unusually for this table, the
 * inherited number is also the RESEARCHED one**: `docs/research/stem-length-research.md` §1 found all four
 * treatises saying the same thing in the same words — *a stem is one octave long, 3½ stave-spaces,
 * measured from the CENTRE of the notehead* (Gould p. 14, Ross p. 83, Stone p. 47, Gerou & Lusk
 * p. 137; four for four, no dissent). ⚠️ Ross's footnote explains the engravers' alternative phrasing
 * — *"the stem length is three spaces, measured from the end of the stem to the nearest point on the
 * notehead"* — and 3½ from the centre is the same rule seen from the other end.
 *
 * ⛔ **This is still a ROW, not a law** (rule 13): the research's remaining open questions are the
 * ATTACHMENT point and the short-note minimums, ⛔ neither of which this number decides.
 */
export const STEM_LENGTH_PX = (35 * STAFF_SPACE_PX) / 10

/**
 * How far a ledger line runs past the notehead on each side — 0.3 staff spaces. Taken from
 * `StaveNote.LEDGER_LINE_OFFSET` = 3 (`stavenote.js:34`). ⚠️ Beside an accidental it is trimmed to
 * `rendering/format/ledgerAccidentalClearance`'s own `LEDGER_OVERHANG_BESIDE_ACCIDENTAL`, which is decided.
 */
export const LEDGER_OVERHANG_PX = (3 * STAFF_SPACE_PX) / 10

/**
 * The blank the note area starts after — 1.2 staff spaces. Taken from `Stave.padding` = 12
 * (`metrics.js:132`), which `getAbsoluteX()` adds to every note while `getNoteStartX()` does not.
 */
export const NOTE_AREA_PADDING_PX = (12 * STAFF_SPACE_PX) / 10

/** Between a notehead and the accidental in front of it — `Accidental.noteheadAccidentalPadding` = 1 (`metrics.js:74`). */
export const ACCIDENTAL_NOTEHEAD_PADDING_PX = 1

/** VexFlow's own fixed line distance, px (`Tables.STAVE_LINE_DISTANCE` = 10) — what its modifier rules divide a height by to count it in staff spaces, whatever the stave's real spacing. */
export const STAVE_LINE_DISTANCE_PX = 10

/** The least room beside a notehead an annotation keeps on its left — `NoteHead.minPadding` = 2 (`metrics.js:106`). */
export const NOTEHEAD_MIN_PADDING_PX = 2

/** Added after each accidental's width when signs are packed along one line — `Accidental.accidentalSpacing` = 3 (`metrics.js:76`). */
export const ACCIDENTAL_SPACING_PX = 3

/** The room left past a chord's outermost accidental column — `Accidental.leftPadding` = 2 (`metrics.js:75`). */
export const ACCIDENTAL_LEFT_PADDING_PX = 2

/** Where every LEFT modifier begins, before its own padding — the literal `-1 * 2` in `StaveNote.getModifierStartXY`. */
export const MODIFIER_LEFT_OFFSET_PX = 2

/** Where every RIGHT modifier begins past the head and the note's own shift — the literal `+ 2` in `StaveNote.getModifierStartXY`. */
export const MODIFIER_RIGHT_GAP_PX = 2

/** `Dot.format`'s own dot-to-dot gap — a literal `dotSpacing = 1` in VexFlow. Here beside its sibling so
 *  the grace's dots (`layout/graceRoom`) run the same rule the notes' do (`rendering/format/dotPlacement`). */
export const VEXFLOW_DOT_SPACING = 1

/**
 * How far a modifier's y moves off a REST's own line, in staff spaces, by the rest's glyph — the switch in
 * `StaveNote.getModifierStartXY`. ⚠️ Keyed by codepoint (`restWhole` U+E4E3 …), because that switch keys by
 * the head's drawn text; a head absent from the table moves 0.
 */
export const REST_MODIFIER_LINE_SHIFT: Readonly<Record<string, number>> = {
  '': 0.5,   // restDoubleWhole
  '': 0.5,   // restWhole
  '': -0.5,  // restHalf
  '': -0.5,  // restQuarter
  '': -0.5,  // rest8th
  '': -0.5,  // rest16th
  '': -1.5,  // rest32nd
  '': -1.5,  // rest64th
  '': -2.5,  // rest128th
}

/** One tremolo stroke to the next — `Tremolo.spacing` = 7 (`metrics.js:212`). */
export const TREMOLO_STROKE_STEP_PX = 7

/**
 * What each written duration carries — VexFlow's `Tables.durationCodes` rows (`tables.js`), the fields the
 * note reads (S12j-d2): whether it has a STEM (⚠️ a rest's row says yes too — `isRest` overrules it),
 * whether it has a FLAG, how many BEAMS it takes, and how far a beamed stem is extended (`stemBeamExtension`,
 * px). ⚠️ A quarter, half and whole have NO beam count (VexFlow's field is absent, read as `undefined`).
 *
 * ⭐ docs/plans/other-durations-plan.md P1: the BREVE has no stem (VexFlow's `'1/2'` row); the LONGA HAS
 * one — the stem is what tells a longa from a breve, and it follows the normal stem rule (his call, §2.3).
 * The 64th and 128th are VexFlow's own rows; the 256th and 512th continue its step, +7.5 px (¾ space)
 * per beam — the same per-flag figure MuseScore takes from Bravura (`docs/research/durations-engines.md`).
 * ⚠️ PROVISIONAL: how a stem grows past three beams is P3's row, default Sibelius's where known.
 */
export const NOTE_DURATION_ROWS: Readonly<Record<NoteDuration, { stem: boolean; flag: boolean; beamCount?: number; stemBeamExtension?: number }>> = {
  longa: { stem: true, flag: false },
  breve: { stem: false, flag: false },
  w: { stem: false, flag: false },
  h: { stem: true, flag: false },
  q: { stem: true, flag: false },
  '8': { stem: true, flag: true, beamCount: 1, stemBeamExtension: 0 },
  '16': { stem: true, flag: true, beamCount: 2, stemBeamExtension: 0 },
  '32': { stem: true, flag: true, beamCount: 3, stemBeamExtension: 7.5 },
  '64': { stem: true, flag: true, beamCount: 4, stemBeamExtension: 15 },
  '128': { stem: true, flag: true, beamCount: 5, stemBeamExtension: 22.5 },
  '256': { stem: true, flag: true, beamCount: 6, stemBeamExtension: 30 },
  '512': { stem: true, flag: true, beamCount: 7, stemBeamExtension: 37.5 },
}

/** The room a note keeps above/below per text line — `Note.renderOptions.annotationSpacing` = 5 (`note.js:154`). */
export const NOTE_ANNOTATION_SPACING_PX = 5

/** How far a tuplet mark stands off its own reach, in px — `Tuplet.yOffset` = 0 (`metrics.js:215`). */
export const TUPLET_Y_OFFSET_PX = 0

/** How far the tuplet NUMBER sits past its bracket line, in px — `Tuplet.textYOffset` = 2 (`metrics.js:216`). */
export const TUPLET_TEXT_Y_OFFSET_PX = 2

/** A tremolo stroke's glyph size, in points — `Tremolo` sets none, so it is the root `fontSize` = 30 (`metrics.js:63`). */
export const TREMOLO_FONT_SIZE = 30

/**
 * A note's glyph scale — `fontScale`, looked up per category (`element.js:63`): 1.0 by default
 * (`metrics.js:64`), 2/3 only for `GraceNote` and `GraceTabNote` (`metrics.js:100,103`). ⚠️ This
 * editor has no grace notes, so every note it draws is at 1; a grace note would be a second row.
 */
export const NOTE_GLYPH_SCALE = 1

/**
 * How far a staff's bottom EDGE hangs below its last line, for the boxes measured against it — the
 * `getStyle().lineWidth ?? 1` in `Stave.getBottomLineBottomY` (`stave.js:110`). ⚠️ The library's staff
 * line, ⛔ not ours (`engrave/staff/staffLines.STAVE_LINE_WIDTH_PX`, 1.1 px since P5c): kept for the
 * key signature's hit box and the flat slur's baseline, which were placed against it.
 */
export const STAFF_BOTTOM_EDGE_PX = 1

/**
 * The blank a stave sign asks for in front of itself — `StaveModifier.padding` = 10 (`stavemodifier.js:23`).
 * ⚠️ The sign walk grants it only from the THIRD sign on (`getPadding(index)` answers 0 below 2), so a
 * clef right after the opening barline gets none (`engrave/staff/signWalk`).
 */
export const STAVE_SIGN_PADDING_PX = 10

/** A time signature's own padding in that walk — `TimeSignature`'s `customPadding` default 15 (`timesignature.js:18`). */
export const METER_PADDING_PX = 15

/**
 * Whether two voices' heads of ONE pitch may share a notehead instead of standing side by side —
 * `Tables.UNISON` = true (`tables.js:593`), which nothing in this editor ever set. Read by
 * `engrave/notes/voiceStack` (S9g).
 */
export const UNISON_SHARES_HEAD = true
