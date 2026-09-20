/**
 * The SIGNS a bar opens and ends with — clef, key, meter, barline, repeats — each stated
 * POSITIONALLY on a `Measure`, never globally on the `Score`.
 *
 * One chapter of the score's types — import it through the barrel, `@/types/music`.
 */
import type { Fraction } from './duration'
import type { PitchStep, PitchAlter } from './pitch'

/**
 * Clef types
 */
export type Clef = 'treble' | 'bass' | 'alto' | 'tenor'

/**
 * A clef change positioned within a measure.
 *
 * Anchored to a beat that lands on a slot boundary (MusicXML / MuseScore model):
 * the clef applies to all slots with beat >= this beat, until the next change.
 * A change at beat 0 is the measure's opening clef (drawn at the barline / line
 * start); changes at beat > 0 render as inline (small) clefs before that slot.
 */
export interface ClefChange {
  /** Unique identifier */
  id: string
  /** Beat position within the measure (0 = opening clef) */
  beat: Fraction
  /** Clef that takes effect at this beat */
  clef: Clef
  /**
   * Staff this clef change belongs to (a {@link StaffInfo} id). Clef is per-staff.
   * Absent = staff 0 (the first staff), mirroring absent {@link Note.voice} = voice 0.
   * See docs/multi-staff-plan.md §4.
   */
  staffId?: string
}

/**
 * ONE altered letter of a key signature — the letter, what it is altered to, and optionally where
 * the sign is DRAWN.
 *
 * ⚠️⚠️ **SCOPE and PLACEMENT are two different things, and `octave` is the second one.** A key
 * signature alters its letter in **all octaves** (Gould, *Behind Bars* pp. 93–94 — it is what makes
 * a key signature a key signature); `octave` overrides only the staff position the glyph is printed
 * at, which is otherwise derived from the letter and the clef. ⛔ It never restricts which octaves
 * are governed — see `utils/keySignature.ts` for the sourcing and for why per-octave *scope* is not
 * modelled.
 *
 * `alter` is in SEMITONES, MusicXML's unit and {@link PitchAlter}'s, ⛔ not LilyPond's fraction of a
 * whole tone.
 */
export interface KeyAlteration {
  step: PitchStep
  alter: PitchAlter
  /** PLACEMENT override — the octave the sign is printed at. Absent = the clef's standard row. */
  octave?: number
}

/**
 * ⭐⭐ **A KEY SIGNATURE IS AN ORDERED SET OF ALTERED LETTERS — never a position on the circle of
 * fifths.** The traditional keys are the subset of this shape whose letters happen to be a
 * cycle-of-fifths prefix; `fifthsOf` names those and returns `null` for the rest, which is the
 * honest answer for a signature mixing sharps and flats.
 *
 * ⛔ The full argument, its four-engine sourcing and the repertoire evidence live in
 * `utils/keySignature.ts`'s header — read it before changing this shape. The short form:
 *
 *  - **the ORDER of `alterations` is authored data**, defaulted from the cycle of fifths at
 *    creation, because a signature that is not a cycle position has no rule to derive an order from;
 *  - **`mode` is three-valued.** `'open'` (atonal) is NOT `'major'` with no accidentals: both have
 *    an empty `alterations`, and they differ in transposition (Stone p. 174) and in whether a change
 *    *to* them draws cancelling naturals. ⚠️ Any `switch` over `mode` must stay total.
 */
export interface KeySignature {
  alterations: KeyAlteration[]
  mode?: 'major' | 'minor' | 'open'
}

/**
 * A key change within a measure — `ClefChange`'s shape, field for field, because it is the same kind
 * of thing: a positional statement that governs everything after it until the next one.
 *
 * `beat` 0 is the measure's opening signature and is what the dev palette writes. A change at
 * beat > 0 is permitted by the model (MuseScore allows one, reached through its list selections) and
 * nothing writes one yet.
 */
export interface KeyChange {
  /** Unique identifier */
  id: string
  /** Beat position within the measure (0 = the measure's opening signature) */
  beat: Fraction
  /** The signature that takes effect at this beat */
  key: KeySignature
  /**
   * Staff this key change belongs to (a {@link StaffInfo} id). A key is per-staff: Bartók writes
   * four sharps in one hand against four flats in the other (Bagatelle op. 6 no. 1), and a
   * transposing instrument's written key differs from the score's. Absent = staff 0, the
   * {@link ClefChange.staffId} convention.
   */
  staffId?: string
}

/**
 * Time signature representation
 */
export interface TimeSignature {
  /** Number of beats per measure */
  numerator: number
  /** Note value that gets the beat (4 = quarter note, 8 = eighth note) */
  denominator: number
  /**
   * Optional additive beat grouping in denominator units (e.g. `[2,2,3]` for
   * `2+2+3 / 8`). Must consist of positive integers summing to `numerator`.
   * Drives beaming and rest-fill; when omitted, grouping is derived
   * algorithmically (see utils/meter `getMeterInfo`).
   */
  grouping?: number[]
  /**
   * How the meter is PRINTED, when that is not its numbers: `common` draws **C**, `cut` draws
   * **¢**. Display only — 4/4 and common time are the same meter, and `numerator`/`denominator`
   * stay 4/4 and 2/2, so capacity, rest-fill, beaming and playback neither know nor care.
   *
   * On the meter and NOT in the engraving-overrides compartment, because it is not a tweak to how
   * something is positioned: it is which of two accepted spellings of the same meter the score uses,
   * the way a pitch carries its own enharmonic spelling. It also has to travel with the meter
   * through a rebar, a paste and JSON, which being a field gives for free. MusicXML models it the
   * same way (`<time symbol="common"|"cut">`).
   *
   * Absent = print the numbers. Only `common` on 4/4 and `cut` on 2/2 mean anything; the renderer
   * honours what it is given, so whoever sets it owns that pairing.
   */
  symbol?: 'common' | 'cut'
}

/**
 * **The KIND of line drawn at a measure's end** — a barline STYLE, and nothing else.
 *
 * ⛔ **A REPEAT IS NOT A STYLE** ({@link RepeatStart} / {@link RepeatEnd}), and that is the one
 * decision this whole family rests on (docs/barline-types-plan.md §3.2). MNX's `barline-type` list
 * carries no repeat value; SMuFL puts barlines at U+E030–E039 and repeats at U+E040–E04D; MusicXML,
 * which does merge them, needs two fields kept consistent (`light-heavy` **and**
 * `<repeat direction="backward"/>`), and MEI, which merged them harder, had to invent `rptboth` for
 * "end repeat then start repeat" because one slot could not hold two statements.
 *
 * ⭐ **Two members, and they are different KINDS of statement about the same line** — which is what
 * makes them both styles rather than one style and one flag:
 *
 *  - **`final`** — thin + thick, the end of a movement (Gould p. 39).
 *  - **`invisible`** — the line is still there and still divides the bars; it is simply not
 *    engraved. 🚨 His ask, 2026-08-26: *"probably we should add also Invisible, and what we do on
 *    screen we use the same colour of hidden we are using for rest, and not printing it on PDF
 *    export."* ⭐ Which is the HIDDEN-ELEMENT rule already in the editor, arriving at its second
 *    client: `engine/rendering/hiddenElements.ts` — tinted for the `editor` audience so it stays
 *    clickable, OMITTED for `print`. ⛔ It is NOT "no barline": the bar still ends, the spine is
 *    untouched, the room is unchanged. What disappears is the INK (plan §10.0's whole point).
 *
 * ⚠️ **`invisible` is our spelling; MusicXML's is `<bar-style>none</bar-style>`** and MEI's is
 * `@bar.method="invis"`. Recorded because a MusicXML export will have to translate, and because
 * "none" reads as *"there is no barline here"*, which is the misreading the paragraph above exists
 * to prevent.
 *
 * The family's remaining members (`double`, `heavy`, `dashed`, `dotted`, `tick`, `short`) each cost
 * one member here plus one drawing case; ⛔ none is added until it is asked for (plan §0) — a value
 * with no drawing behind it is a lie the compiler cannot catch.
 */
export type BarlineStyle = 'final' | 'invisible'

/**
 * **A barline statement: the line that ENDS this measure.**
 *
 * The measure the line ends is unanimous across the standards — MNX (*"the barline drawn at the end
 * of this measure"*), MusicXML (`location` defaults to `right`), MEI (`@right` *"structurally
 * important"*, `@left` legacy) and Finale — and it is already both our selection identity
 * (`{ kind: 'barline', measure: N }`) and our drawing rule (a bar draws only the line that ends it).
 *
 * ⭐ **`staffId` is the SCOPE, and absent means the WHOLE SYSTEM** — the `Dynamic.voice` /
 * `Hairpin.voice` rule one axis over (`utils/dynamicScope`), the deliberate inverse of `utils/lanes`'
 * "absent = the first one". Classical notation states a barline for the system; contemporary music
 * mixes system-wide and per-staff, so the scope is stored from day one and **nothing reads it yet**
 * (plan §2). ⛔ Do not read it as "which staves the line spans" — span is a property of the STAFF
 * everywhere (MuseScore `Staff::barLineSpan`, LilyPond's `SpanBar` grob, Verovio `@bar.thru`), never
 * of the line.
 *
 * ⚠️ **A boundary fact, not a beat anchor.** There is no `beat`: this names the bar's end, which is
 * why it rides its measure object through a rebar rather than travelling by offset the way a clef
 * change, a dynamic or a hairpin does.
 */
export interface BarlineStatement {
  /** The kind of line. */
  style: BarlineStyle
  /** Which staff this governs; **absent = the whole system**. Stored, not yet read (plan §2). */
  staffId?: string
  /** ⭐ The flared tips at the top and bottom of the thick line. See {@link RepeatStart.winged}.
   *  ⚠️ Meaningless on an `invisible` line, which has no ink to flare. */
  winged?: boolean
}

/**
 * **This measure OPENS a repeat** ( `|:` ) — a statement about the line that BEGINS the bar, and the
 * one member of this family that is not filed under the bar it ends.
 *
 * ⭐ **ONE OWNER PER LINE.** The start repeat belongs to the FOLLOWING measure and the end barline to
 * the preceding one, so no two measures ever name the same line — MuseScore's shape, and the reason
 * it needs none of Verovio's ~60 lines of `SetDrawingBarLines` conflict resolution (plan §3.2).
 * Back-to-back repeats therefore need no vocabulary of their own: bar *N* carries {@link RepeatEnd},
 * bar *N+1* carries this, and the DRAWING combines them.
 *
 * `staffId`: the scope, absent = the whole system — see {@link BarlineStatement}.
 */
export interface RepeatStart {
  /** Which staff this governs; **absent = the whole system**. Stored, not yet read (plan §2). */
  staffId?: string
  /**
   * ⭐⭐ **WINGS** — the flared tips at the top and bottom of this sign's thick line (his ask,
   * 2026-08-26: *"I remember Sibelius had barline wings for repeats"*).
   *
   * Absent = none, which is every engine's default. A **house-style decoration, not a convention**:
   * checked against the four treatises on disk and all four are silent — Gould pp. 38–39 and
   * 233–235, Ross p. 147 and pp. 151–152 and Gerou & Lusk pp. 110–111 decompose the repeat sign in
   * detail and none of them names or draws a tip. What every program HAS is a switch for it: Finale
   * (*"Wing Styles: None / Curved / Single / Double"*), Sibelius (Engraving Rules ▸ Barlines),
   * Dorico (*"Wings on repeat barlines"*), MuseScore (*"Show repeat barline tips"*).
   *
   * ⛔ **SMuFL has no wing glyph.** The shape is the STAFF BRACKET's own flared tip — his own
   * identification (*"similar to Bravura `\uE002`"*), and exactly what MuseScore's `drawTips` stamps:
   * `bracketTop`/`bracketBottom` where the sign grows rightward, the mirrored `reversedBracket*`
   * where it grows left. Sibelius names its two symbols *"End Bracket Top / Bottom"*, which is the
   * independent corroboration.
   *
   * ⚠️ **A boolean, where MusicXML has five values** (`winged`: `none | straight | curved |
   * double-straight | double-curved`). Ours is the curved single, which is what the bracket tips are
   * and what MuseScore exports as `winged="curved"`. ⛔ If the other four are ever wanted this
   * becomes MusicXML's union and not a second flag — recorded so nobody adds `doubleWinged`.
   *
   * ⚠️ Only a sign with a THICK line can carry them (`barlineSign.wingsAllowed`): a plain single line
   * and an invisible one have nothing to flare. His rule, and ⭐ note it differs from MuseScore's,
   * which wings the two repeats and never the final bar — he asked for the final too.
   */
  winged?: boolean
}

/**
 * **This measure CLOSES a repeat** ( `:|` ) — the sign at the end of this bar.
 *
 * ⛔ **Drawing `:|` is INK; playing bars twice is a play ORDER**, and nothing in this model expresses
 * one (plan §7). Playback walks `score.measures` straight through and must keep doing so: a repeat
 * that silently changed what Play does, with no way to see or edit the resulting order, is worse than
 * one that only draws. A future play order READS this field as one input among several (voltas,
 * jumps, `times`) — MuseScore's `RepeatList` never reads the barline at all.
 */
export interface RepeatEnd {
  /**
   * How many times the passage is played in total (*"play 3 times"*). Absent = twice, the default
   * every reader assumes. Stored for the sign's text; **nothing plays it** (see above).
   */
  times?: number
  /** Which staff this governs; **absent = the whole system**. Stored, not yet read (plan §2). */
  staffId?: string
  /** ⭐ The flared tips at the top and bottom of the thick line. See {@link RepeatStart.winged}. */
  winged?: boolean
}
