/**
 * MARKS outside the notes — dynamics, hairpins, ottavas, pedals, tempo marks, slurs, trills.
 *
 * One chapter of the score's types — import it through the barrel, `@/types/music`.
 */
import type { NoteDuration, Fraction } from './duration'

/**
 * Interpreted dynamic levels — the marks that drive playback loudness. Ordered quietest → loudest;
 * DYNAMIC_VELOCITY (utils/dynamics.ts) must keep a row for every member, and the tests assert the
 * ladder rises monotonically in THIS order. Nothing else hardcodes the list.
 *
 * ⚠️ A LEVEL IS A SUSTAINED STATE — it governs every note from its beat until the next one. That is
 * why `sf` / `sfz` / `fp` / `rf` are deliberately NOT here: they are momentary instructions (an
 * accent on one note; loud-then-immediately-soft), and modelling them as a level would mean
 * "everything from here on is sfz-loud", which is wrong. They engrave fine and stay silent —
 * `parseDynamicText` matches a run's WHOLE letters, so `sfz` names no level and carries the
 * previous one forward. Accents need their own mechanism.
 */
export type DynamicLevel = 'ppp' | 'pp' | 'p' | 'mp' | 'mf' | 'f' | 'ff' | 'fff'

/**
 * A dynamic marking positioned within a measure, mirroring {@link ClefChange}:
 * a beat-anchored, measure-owned, selectable/deletable marking.
 *
 * **The mark IS its `text`** (docs/plans/dynamics-text-as-truth-plan.md). The text mixes SMuFL dynamics
 * glyphs — the `f`/`p`/… drawn in the music font, which ARE the levels — with plain expression
 * words (`dolce`), e.g. `f con brio` or `più f`. There is deliberately NO `kind`/`level` field:
 *  - glyph vs word is decided per character by whether it's a dynamics glyph (the FONT, not the
 *    spelling — a typed plain `p` is a letter, a glyph `𝆏` is piano); see `utils/dynamics`.
 *  - meaning — the played level is DERIVED from the glyph runs (`dynamicLevelOf`), never stored.
 *  - scope — the `voice` it governs (⭐ absent = ALL of its staff's), until the next dynamic that
 *    governs the same lane; see `utils/dynamicScope`.
 */
export interface Dynamic {
  /** Unique identifier */
  id: string
  /** Beat position within the measure (lands on a slot boundary, like clefs) */
  beat: Fraction
  /** The whole printed string, verbatim: SMuFL dynamics glyphs for the levels + plain words for
   *  expression text. The level and glyph/word split are both derived from this (utils/dynamics). */
  text: string
  /**
   * ⭐⭐ **The voice this mark GOVERNS — and ABSENT means ALL of them**, every voice of its own
   * {@link staffId}. ⚠️ That is the opposite of the `voice ?? 0` rule every other kind follows
   * ({@link Note.voice}, `utils/lanes`), and it is deliberate: a dynamic is not addressed by a
   * lane, it speaks FOR lanes, and the common case is the whole staff. ⛔ So `voiceOf()` is the
   * wrong reader here — use `utils/dynamicScope` (docs/plans/dynamic-voice-scope-plan.md).
   */
  voice?: 0 | 1 | 2 | 3
  /** Vertical placement relative to the staff; default 'below'. */
  placement?: 'above' | 'below'
  /** Staff this dynamic belongs to (a {@link StaffInfo} id); absent = staff 0. See
   *  docs/plans/multi-staff-plan.md §4. Orthogonal to {@link Dynamic.voice} — the staff says WHERE the
   *  mark is, the voice which of that staff's streams it governs. */
  staffId?: string
}

/**
 * A HAIRPIN — the crescendo (open) or diminuendo (close) wedge. A member of the dynamics
 * family: it lives on the same line as the letters and the expression words, and it rides the
 * measure spine exactly as a {@link Dynamic} does. See docs/plans/dynamics-line-and-hairpins-plan.md.
 *
 * ⭐ **It is addressed POSITIONALLY — a start plus an AMOUNT OF MUSIC — never by note identity.**
 * That is what every standard does (MusicXML pairs a wedge with a separate stop, MEI uses a
 * relative `@tstamp2`, MuseScore and Dorico both store tick/position + duration), and here it is
 * load-bearing rather than a fidelity point: a re-bar re-mints every slot id, which is why
 * `repairDanglingSlurs` has to exist. A slur severed by a re-bar is tolerable; a dynamic-family
 * mark severed by one is not. Stored this way it simply travels with its measure, and the only
 * thing that needs re-anchoring is the START — {@link length} is invariant under a re-bar,
 * because the region's total music is unchanged.
 *
 * ⭐ **Nothing here names another bar.** No end-measure number to renumber on insert, no measure
 * id to dangle on delete. The honest cost of that: deleting a bar *inside* the span does NOT
 * shorten the count, so the end lands on different music (clamped to the score's end when it
 * runs past it) — the same clamp `restoreBeatAnchors` already applies to an over-running offset.
 *
 * ⛔ **No `y`, no aperture, no angle, no stored break point.** How the wedge LOOKS is derived from
 * the render (the dynamics line, the columns it spans) or authored into the engraving-overrides
 * compartment keyed by this id — never a field here (DESIGN-PRINCIPLES §3; the resolved `Slur.cps`
 * boundary case). The mouth's opening angle in particular is *derived* from the aperture and the
 * length in every engine, so there is nothing to store even when it becomes a user control.
 */
export interface Hairpin {
  /** Unique identifier. ⚠️ NOT stable across a re-bar — `rebarOps` re-creates the hairpin with a
   *  fresh id at the re-anchored position, exactly as it does for a {@link Dynamic}. */
  id: string
  /** Which wedge: 'cresc' opens to the right, 'dim' closes to the right. */
  type: 'cresc' | 'dim'
  /** Start beat within the owning measure (lands on a slot boundary, like clefs/dynamics). */
  beat: Fraction
  /** How much music the wedge covers, in quarter-note beats — the same unit as {@link beat}.
   *  Always > 0. The drawn pixel length is derived from this every render, never stored. */
  length: Fraction
  /** ⭐⭐ The voice this wedge GOVERNS — **absent = ALL voices of its staff**, exactly as
   *  {@link Dynamic.voice} (whose note carries the rule and the ⛔ about `voiceOf`). */
  voice?: 0 | 1 | 2 | 3
  /** Vertical placement relative to the staff; default 'below' (as {@link Dynamic}). */
  placement?: 'above' | 'below'
  /** Staff this hairpin belongs to (a {@link StaffInfo} id); absent = staff 0. */
  staffId?: string
}

/**
 * An OTTAVA — the octave line: `8va` / `8vb` (and `15ma` / `22ma`), the numeral plus its dashed
 * bracket. See docs/plans/ottava-plan.md.
 *
 * ⭐ **It is a CLEF-shaped statement wearing a {@link Hairpin}'s address.** What it *says* is what a
 * clef says: it governs a REGION of a STAFF — every voice in it, and every note typed into it
 * afterwards. That last clause is why it cannot be note-anchored: a pair of note ids has no way to
 * mean *"and whatever else lands in here"*. How it is STORED is the hairpin's answer — measure-owned,
 * beat-anchored, carrying its own extent — because that is the shape that survives a re-bar
 * ({@link Hairpin}'s note on why, verbatim: only the START needs re-finding, {@link length} is
 * invariant because the region's total music is unchanged).
 *
 * ⭐ **The written pitch is the stored pitch, here as everywhere.** An ottava does not change what
 * `octave: 5` means; it changes what that notehead SOUNDS. The octave lives in exactly one place —
 * the point where written pitch becomes sound (`soundingShiftAt`, docs/plans/ottava-plan.md §6) — which is
 * the answer `docs/plans/octave-clefs-plan.md` already gave for octave clefs, and it must be the same
 * answer or one score has two rules for where an octave lives. Dorico, LilyPond and MusicXML store
 * the sounding pitch instead; Sibelius and MuseScore store the written one, and so do we.
 * (Dorico's nicer *gesture* — press 8va and watch the noteheads drop an octave — is still available,
 * as a COMMAND that writes the span and re-spells the notes in one batch. ⛔ Not a stored flag.)
 */
export interface Ottava {
  /** Unique identifier. ⚠️ NOT stable across a re-bar — `rebarOps` re-creates the ottava with a
   *  fresh id at the re-anchored position, exactly as it does for a {@link Hairpin}. */
  id: string
  /** Start beat within the owning measure (lands on a slot boundary, like clefs/dynamics). */
  beat: Fraction
  /** How much music the line covers, in quarter-note beats — the same unit as {@link beat}.
   *  Always > 0. ⚠️ This is the span's MUSICAL extent, not the drawn one: Gould's rule is that the
   *  bracket stops at the last NOTEHEAD inside it rather than at the end of that note's duration,
   *  so where the ink ends is derived by the render (docs/plans/ottava-plan.md §1 rule 2). */
  length: Fraction
  /**
   * ⭐ **THE WHOLE STATEMENT: octaves of shift.** +1 = 8va, −1 = 8vb, +2 = 15ma, −3 = 22mb.
   *
   * One signed number, and deliberately not three fields. The SIDE of the staff is derived from its
   * sign (up → above), because the side is half of what tells a reader the direction and a stored
   * side could contradict the stored shift; the NUMERAL is derived from `|shift|` (8 / 15 / 22),
   * never stored as a printed string — Gould warns about the French `16`, and a score that stores
   * both a size and a shift is `score.clef`'s mistake in miniature.
   */
  shift: -3 | -2 | -1 | 1 | 2 | 3
  /**
   * Staff this ottava governs (a {@link StaffInfo} id); absent = staff 0.
   *
   * ⭐ **There is no `voice`, and that is the one place this differs from every other span we
   * store.** {@link Hairpin}, {@link Slur} and {@link Trill} all carry one; an octave line governs
   * the STAFF, so a voice field would let one voice of a staff sound an octave from another under a
   * single bracket.
   */
  staffId?: string
}

/**
 * A SUSTAIN PEDAL — the damper, drawn `Ped. … ✻`. See docs/plans/pedal-plan.md.
 *
 * ⭐ **{@link Ottava}'s twin in shape and its opposite in effect.** Both are CLEF-shaped statements
 * wearing a {@link Hairpin}'s address — measure-owned, beat-anchored, carrying their own extent,
 * governing a REGION rather than a set of notes, so notes typed into one afterwards are governed
 * too. What they differ in is which half of a sounding note they touch: an ottava moves the PITCH
 * (`soundingShiftAt`), a pedal moves the RELEASE (docs/plans/pedal-plan.md §9). Neither is stored on the
 * notes it governs.
 *
 * ⛔ **No `type`, no `style`, no `placement`, no retake, no `endNoteId`** — each refused for its own
 * reason in docs/plans/pedal-plan.md §3.1, and the one worth repeating here is `style`: `Ped.✻` vs the
 * bracket vs mixed is PRESENTATION (DESIGN-PRINCIPLES §3), so the day the bracket arrives it is a
 * renderer's default and an engraving preset, and no JSON written today becomes wrong. Sostenuto and
 * una corda, when they come, add ONE optional field (`type?`, absent = sustain), additively.
 */
export interface Pedal {
  /** Unique identifier. ⚠️ NOT stable across a re-bar — `rebarOps` re-creates the pedal with a
   *  fresh id at the re-anchored position, exactly as it does for a {@link Hairpin}. */
  id: string
  /** Start beat within the owning measure (lands on a slot boundary, like clefs/dynamics) — where
   *  the foot goes DOWN. */
  beat: Fraction
  /**
   * How much music it holds, in quarter-note beats — the same unit as {@link beat}. Always > 0.
   *
   * ⭐ **`beat + length` is the LIFT, and the lift is a point in TIME** — not a note, which is why
   * there is no end id to store. It is also the one thing a reader has to get right: Gould's rule
   * puts the release at or before the barline, never after it, and a lift landing exactly on a
   * barline belongs to THAT bar's end (docs/plans/pedal-plan.md §5.2).
   */
  length: Fraction
  /**
   * Staff this pedal is ATTACHED to (a {@link StaffInfo} id); absent = staff 0.
   *
   * ⚠️⚠️ **ATTACHED is not GOVERNS, and it is not DRAWN-UNDER either.** One damper serves a whole
   * instrument, so a real piano pedal sustains every staff of it and is drawn below the BOTTOM one —
   * neither of which is knowable while `Score.staffGroups` is unrendered content. So both questions
   * are asked of `utils/pedalScope` (`pedalStavesAt` / `pedalDrawStaff`), which today answer with
   * this field and change together the day the piano exists. ⛔ Never read this field directly at a
   * playback or a draw site (docs/plans/pedal-plan.md §3.2).
   *
   * ⭐ **There is no `voice`** — the {@link Ottava}'s exception, harder: an octave line governs a
   * staff because a bracket says so, a pedal governs it because there is only one foot.
   */
  staffId?: string
}

/**
 * A tempo mark: a verbal indication ('Allegro'), a metronome mark (♩ = 120), or both
 * ('Allegro (♩ = 120)'). ONE object — not three types.
 *
 * SYSTEM-level: it governs the clock, not a staff, so unlike {@link Dynamic} it has
 * **no `staffId` and no `voice`**. It rides the shared measure spine (measure-owned,
 * beat-anchored, exactly like `clefs`/`dynamics`), which is what makes it system-level
 * for free. See docs/plans/tempo-marks-plan.md.
 *
 * Three rules the model encodes deliberately:
 * - **The mark IS its text.** {@link text} is the whole printed string, verbatim — brackets,
 *   word order, a trailing 'sempre' and all. Nothing re-composes it from pieces, so nothing can
 *   lose what you typed. (It used to store `{word} + {unit,dots,bpm} + showMetronome` and rebuild
 *   the string on every render, which silently threw away deleted brackets and any text after the
 *   number: the string couldn't say what the fields couldn't hold.)
 * - **The number can sound without being printed.** {@link bpm} is a separate field, so the word
 *   'Allegro' really does speed playback up even though its 144 appears nowhere in the text — what
 *   every real program does. Printed ⟺ the text contains a metronome; there is no flag for it.
 * - **The beat unit is half the meaning.** `♩ = 60`, `♩. = 60` and `𝅗𝅥 = 60` are three
 *   different speeds, so `{unit, dots, bpm}` is stored and quarter-notes-per-minute is
 *   DERIVED (utils/tempoMap `markToQpm`).
 */
export interface TempoMark {
  /** Unique identifier */
  id: string
  /** Beat position within the measure (lands on a slot boundary, like clefs/dynamics) */
  beat: Fraction
  /**
   * **The mark exactly as printed** — `Allegro`, `♩ = 120`, `Allegro (♩ = 120)`, `Moderato ♩ = 112
   * sempre`. Free text, never an enum: the palette words pre-fill it, they are not the legal
   * values. The note is a real character (`♩`), so the string is the whole truth about the
   * engraving and the renderer just draws it (utils/tempoText, engine/rendering/marks/tempo/TempoLayout).
   *
   * Speed is NOT read from here at playback time — {@link bpm} is. The two are kept in step by
   * parsing the text on every edit (utils/tempoText `parseTempoText`).
   */
  text?: string
  /** Metronome beat unit. Defaults to 'q'. Derived from {@link text} when it shows a metronome. */
  unit?: NoteDuration
  /** Dots on the metronome beat unit (♩. = 60 is not ♩ = 60). */
  dots?: number
  /**
   * BPM **of the unit** (not of a quarter) — what the mark SOUNDS. Usually parsed out of
   * {@link text}, but it can be set with no metronome in the text at all: that is the word
   * 'Allegro' quietly meaning 144. Absent = the mark makes no speed statement (a phrase like
   * 'sempre più mosso' prints and changes nothing).
   */
  bpm?: number
  /**
   * Which clock this mark governs. ABSENT = the whole system (v1 marks are always
   * absent). Reserved for polytempo (Stockhausen, *Gruppen*: three orchestras, three
   * simultaneous tempi) — it would name a {@link StaffGroup} id. The insurance costs one
   * optional field now; retrofitting "the number of clocks is a parameter, not 1" later
   * costs a rewrite. See docs/research/tempo-marks-research.md §7.
   */
  scopeId?: string
}

/**
 * A phrasing slur spanning a run of note events within one voice.
 *
 * A slur is a PHRASING mark and is fundamentally different from a tie (a
 * DURATION mark on a notehead, see {@link NotePitch.tiedTo}). It is modeled as a
 * first-class span object anchored to a start and end note event — never as note
 * attributes — mirroring MusicXML `<slur>` and MuseScore's Spanner. Stored
 * top-level on {@link Score.slurs} because slurs cross barlines and systems
 * freely. See docs/plans/slur-plan.md.
 */
export interface Slur {
  id: string
  /** Anchor: the start note's head id (a {@link NotePitch} id, as used by selection). */
  startNoteId: string
  /** Anchor: the end note's head id. */
  endNoteId: string
  /** Voice this slur belongs to; both anchors share it. Default 0. See {@link Note.voice}. */
  voice?: 0 | 1 | 2 | 3
  /** Vertical placement; default auto (derived from stem direction). */
  placement?: 'above' | 'below'
  /**
   * A user-edited curve shape no longer lives here. As of Phase 1 of the
   * engraving-overrides plan, the hand-tuned arc is stored in the
   * {@link EngravingOverrides} compartment (`score.engravingOverrides[slur.id]` as a
   * {@link CurveShapeOverride}, in staff-spaces) — keeping pixels out of the content
   * model. Absent override = the auto arch. See docs/plans/engraving-overrides-plan.md.
   */
  /**
   * Reserved for future nested/overlapping-slur disambiguation (MusicXML `number`).
   * Unused in this pass.
   */
  number?: number
}

/**
 * A TRILL — the `tr` sign plus the wavy extension line it may carry. Top-level (`score.trills`),
 * beside {@link Slur} and for the same reason: it is anchored to NOTES and crosses barlines and
 * systems freely, so a measure-owned span would have to be split and re-joined by every re-bar.
 * See docs/plans/trill-plan.md.
 *
 * ⭐ **A trill is TWO things in every format** — a sign on a note and a span — and this models both
 * with one object. MusicXML pairs `<trill-mark/>` with a separate `<wavy-line>`; LilyPond has
 * `\trill` against `\startTrillSpan`; MuseScore's `Trill` is an `SLine` carrying an `Ornament*`.
 * Here an **absent {@link endNoteId} is the trill on one note** and a present one is the span, so
 * "does it get a line?" is answered by the span rather than by a flag.
 *
 * ⭐ **Note identity, not position — the opposite of {@link Hairpin}, and the difference is real.**
 * A hairpin covers an AMOUNT of music from a start beat, so it survives a re-bar untouched. A
 * trill's ends are notes ("there is no trill without a note"), which is what MusicXML and LilyPond
 * both anchor to. The cost is that a re-bar re-mints every id — paid by `rebarOps`' capture/restore
 * pass, exactly as it is paid for a slur (docs/plans/trill-plan.md §2.1). ⛔ It is NOT paid by dropping
 * the trill: that would delete every trill in the region on any meter change.
 *
 * ⛔ **Nothing else here.** No length in beats (a trill's ends are notes), no interval — the
 * auxiliary is the diatonic step above, DERIVED against the key in force and the bar's accidentals
 * (docs/plans/trill-plan.md §3), so storing it would be a second answer that goes stale on a
 * transposition. No y, no angle, no wiggle count, no stored break point: how it LOOKS is derived
 * from the render or authored into the engraving-overrides compartment keyed by this id
 * (DESIGN-PRINCIPLES §3), never a field here.
 */
export interface Trill {
  /** Unique identifier. ⚠️ Stable across a re-bar (the object is re-anchored in place, not
   *  re-created) — unlike a {@link Hairpin}'s, which is re-minted. */
  id: string
  /** Anchor: the note the sign sits on (a {@link NotePitch} id, as used by selection).
   *  ⛔ Never a rest, and never a FANNED MEMBER — `trillOps.addTrill` refuses both. */
  startNoteId: string
  /**
   * The LAST trilled note. **ABSENT = the start note's own sounding duration, through ties** —
   * which is the engraving rule as well as the model's simplest case: a single note needs no wavy
   * line, and on tied notes the line runs to the last tied note. The line exists exactly when the
   * reader must know how long to keep trilling.
   */
  endNoteId?: string
  /** Voice; both anchors share it. Default 0. See {@link Note.voice}. (Slur's field, same meaning —
   *  and kept in step by `voiceOps` when a move changes an anchor's voice.) */
  voice?: 0 | 1 | 2 | 3
  /** Vertical side; default 'above'. `'below'` is the multi-voice case: a trill goes above the
   *  notes unless the staff carries more than one voice. Flipped by `x`, like a slur's. */
  placement?: 'above' | 'below'
  /**
   * ⭐ **How a CONTINUATION system labels this trill** when it crosses a break. Absent =
   * `'parenthesised'`.
   *
   * The three real behaviours in the field, and there is no single right one — which is exactly why
   * this is a stored choice rather than a constant (his call, 2026-08-13, after seeing all three
   * researched):
   *
   *  - `'parenthesised'` — `(tr)`. **Our default.** *G. Schirmer's Manual of Style and Usage*:
   *    "When a trill is tied onto another line, use parentheses: (tr)." A 20th-century American
   *    publisher house style, and the clearest for the reader, which is why he picked it.
   *  - `'plain'` — a bare `tr`. **What the engraved tradition does** (Beethoven Op. 111, Cotta
   *    1892: the sign repeated plain above the first note) and what **LilyPond** does.
   *  - `'none'` — no sign; only the wavy line continues. **What MuseScore 4 does.**
   *
   * ⚠️ **PER TRILL, not per score — for now.** Dorico puts the same three choices in *Engraving
   * Options → Ornaments → Trills → "Label for start of new system"*, i.e. score-wide, which is the
   * shape a house style really has. ⏭️ When engraving presets land, the preset sets the DEFAULT and
   * this field stays as the per-trill OVERRIDE — absent meaning "whatever the score says". The two
   * layer; neither replaces the other. See docs/plans/trill-plan.md §1 rule 6.
   */
  continuationLabel?: 'parenthesised' | 'plain' | 'none'
  /**
   * ⭐⭐ **THE BARE `tr` — no wavy line at all.** Absent = the line draws, which is our default and
   * HIS OWN CALL of 2026-08-13, overruling docs/plans/trill-plan.md §1 rule 5 (*"a single note needs no
   * wavy line"*, which was Gould's and LilyPond's): *a bare `tr` leaves the duration implied; show it
   * on one note as much as on twenty.* This field is the per-trill exception to that default — his
   * ask, 2026-08-18: *"there are cases where the user wants to have `tr` without the line"*.
   *
   * ⭐ `continuationLabel`'s shape, and for its reason: a per-trill OVERRIDE now, and when engraving
   * presets arrive the preset sets the default and this stays the exception. Absent means *whatever
   * the score says*, which today is "draw it".
   *
   * ⛔⛔ **`'none'` and an `endNoteId` CONTRADICT each other, and the model refuses to hold both.**
   * If a trill covers more than one note, the wavy line is what tells the reader how long to keep
   * trilling — so `setTrillExtension('none')` clears the end, and re-anchoring an end clears this.
   * {@link addTrill} already normalises an end equal to the start away for the same reason: one
   * statement, one spelling.
   */
  extension?: 'none'
}

/** How a continuation system labels a resumed trill — see {@link Trill.continuationLabel}. */
export type TrillContinuationLabel = NonNullable<Trill['continuationLabel']>
