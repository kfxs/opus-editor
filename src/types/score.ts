/**
 * The CONTAINERS — `Measure`, the staves and their groups, the `Score`, and its playback compartment.
 * `getScore()` / `exportJSON()` serialize these directly.
 *
 * One chapter of the score's types — import it through the barrel, `@/types/music`.
 */
import type { Fraction } from './duration'
import type { Tuplet } from './tuplet'
import type { ChordRest } from './notes'
import type { ClefChange, KeyChange, TimeSignature, BarlineStatement, RepeatStart, RepeatEnd } from './signs'
import type { Dynamic, Hairpin, Ottava, Pedal, TempoMark, Slur, Trill } from './marks'
import type { EngravingOverrides } from './engravingOverrides'

/**
 * Represents a measure in the score
 */
export interface Measure {
  /** Unique identifier for the measure */
  id: string
  /** Measure number (1-indexed) */
  number: number
  /** Rhythmic slots (chords and rests) in this measure */
  slots: ChordRest[]
  /** Time signature in effect for this measure (propagated from the last change). */
  timeSignature: TimeSignature
  /**
   * True when this measure begins an explicit time-signature change (a TS glyph
   * is drawn here). Always true for measure 1. Measures without this marker
   * inherit `timeSignature` from the most recent change. Resolution helpers live
   * in utils/meter (effectiveTimeSignature, isTimeSignatureChange).
   */
  timeSignatureChange?: boolean
  /**
   * When true, the time-signature glyph is NOT drawn for this measure even though
   * a meter is still in effect (capacity / playback / rest-fill use `timeSignature`
   * as normal). Used when the user deletes the displayed signature on measure 1:
   * a score must always have a meter, so the glyph is hidden rather than removed.
   * Display-only; `drawsTimeSignature` gates on it. Cleared by `setTimeSignature`.
   */
  timeSignatureHidden?: boolean
  /**
   * Actual playable length of this bar in quarter-note beats, when it differs
   * from the nominal time signature — i.e. a pickup / anacrusis bar (shorter
   * than nominal). When undefined the bar uses its time signature's full length.
   * Honoured by rest-fill, coordinate mapping, collision, playback and the
   * render voice capacity (resolved via utils/measureCapacity `measureCapacityFrac`).
   */
  actualDurationOverride?: Fraction
  /**
   * Clef changes within this measure, sorted ascending by beat.
   * A change at beat 0 is the measure's opening clef; changes at beat > 0 are
   * mid-measure changes rendered as inline clefs. When empty/undefined, the
   * measure inherits the effective clef from earlier measures.
   * Resolution helpers live in utils/clefUtils (effectiveClefAt, measureOpeningClef).
   */
  clefs?: ClefChange[]
  /**
   * Key changes within this measure, sorted ascending by beat (mirrors the `clefs` convention).
   * A change at beat 0 is the measure's opening signature; when empty/undefined the measure
   * inherits the signature in force from earlier measures **on its own staff**, bottoming out in
   * C major. Resolution helpers live in utils/keySignature (`keyAt`).
   *
   * ⚠️ **Per-staff, like `clefs`** — see {@link KeyChange.staffId}. Which means the per-staff LANE
   * filter (`engine/models/staffContent`) must name it; a measure-level array it does not name
   * rides the spread onto every staff unfiltered.
   *
   * ⏭️ **Rebar has not been told about this field yet, and that is safe only while nothing writes
   * one** (P2). `clearMeasureForRebar` deletes every *beat-anchored* array before a bar is re-tiled,
   * precisely so a missed re-anchor is a visible loss rather than a mark pointing at music that
   * moved. A beat-0 signature is a boundary fact and rides its measure like the meter does; a
   * beat > 0 one would need capturing. See docs/key-signature-plan.md §1.2.
   */
  keys?: KeyChange[]
  /**
   * Dynamic markings within this measure, sorted ascending by beat (mirrors the
   * `clefs` convention). Multiple dynamics MAY share a (beat, voice) — they stack
   * and are rendered side-by-side (e.g. `p dolce`); placement order is preserved
   * within a beat. Optional/absent = no dynamics (backward-compatible JSON).
   * Resolution helpers live in utils/dynamics (resolveActiveLevel).
   */
  dynamics?: Dynamic[]
  /**
   * Tempo marks within this measure, sorted ascending by beat (mirrors the `clefs`
   * convention — at most ONE mark per beat, last wins). SYSTEM-level, so there is no
   * per-staff list: this one array governs every staff. Optional/absent = no marks;
   * the score's speed then falls back to `DEFAULT_TEMPO`.
   * Resolution helpers live in utils/tempoMap (buildTempoMap, effectiveTempoAt).
   */
  tempos?: TempoMark[]
  /**
   * Hairpins (crescendo / diminuendo wedges) STARTING in this measure, sorted ascending by
   * beat. A hairpin is stored on the bar its start lands in and carries its own extent
   * ({@link Hairpin.length}), so it may run past this bar's end. Multiple hairpins may share a
   * (beat, voice) — nothing is replaced. Optional/absent = none.
   * See docs/dynamics-line-and-hairpins-plan.md §5; ops in `engine/models/hairpinOps`.
   */
  hairpins?: Hairpin[]
  /**
   * Octave lines (8va / 8vb / 15ma …) STARTING in this measure, sorted ascending by beat. Stored
   * on the bar its start lands in and carrying its own extent ({@link Ottava.length}), exactly as
   * a hairpin is, so it may run past this bar's end. ⚠️ At most ONE per (beat, staff) — the CLEF
   * rule, not the hairpin's: two wedges on a beat are two readable marks, two octave shifts
   * governing one staff from one beat are a contradiction. Optional/absent = none.
   * See docs/ottava-plan.md §4; ops in `engine/models/ottavaOps`.
   */
  ottavas?: Ottava[]
  /**
   * Sustain pedals STARTING in this measure, sorted ascending by beat. Stored on the bar its start
   * lands in and carrying its own extent ({@link Pedal.length}), exactly as a hairpin is, so it may
   * run past this bar's end. ⚠️ At most ONE per (beat, staff) — the CLEF rule, as for an
   * {@link Ottava}, and here the reason is physical: one damper, one foot. ⚠️ Overlap that does not
   * share a start beat is NOT policed by the model (docs/pedal-plan.md §3.3) — the entry door
   * truncates, and playback resolves positionally. Optional/absent = none.
   * See docs/pedal-plan.md §3; ops in `engine/models/pedalOps`.
   */
  pedals?: Pedal[]
  /**
   * **The kind of line that ENDS this bar.** Absent = a plain single line, by rule — there is no
   * stored default and no automatic final barline on the last bar of the score (plan §3.3: MNX and
   * MuseScore add one, LilyPond and Verovio decline, and Gould's final barline marks *"the actual
   * end of the piece"*, which is a statement a composer makes rather than a property of whichever
   * bar happens to be last in the file).
   *
   * ⛔ Repeats are NOT styles — see {@link repeatStart} / {@link repeatEnd} and {@link BarlineStyle}.
   * Ops in `engine/models/barlineOps`; see docs/barline-types-plan.md §3.
   */
  barline?: BarlineStatement
  /** **This bar OPENS a repeat** ( `|:` ). The one sign filed under the bar it begins rather than the
   *  bar it ends — see {@link RepeatStart} for why that is what keeps the picture unambiguous. */
  repeatStart?: RepeatStart
  /** **This bar CLOSES a repeat** ( `:|` ). ⛔ Ink only — it does not change what Play does
   *  ({@link RepeatEnd}, plan §7). */
  repeatEnd?: RepeatEnd
  /** Tuplets in this measure */
  tuplets: Tuplet[]
}

/**
 * One staff in the vertical **staff axis** — a single lane of five lines (the concrete
 * thing "+ Staff Above/Below" adds). Ordered top→bottom in {@link Score.staves}; a
 * single-staff score has exactly one. See docs/multi-staff-plan.md.
 *
 * Identity is a **stable string id**, never a positional index: "add staff above"
 * prepends to `Score.staves` with no mass-renumber of back-pointers (contrast measure
 * insert, which renumbers). The 0-based index is *derived* from `Score.staves` order at
 * projection time (that is what flat {@link Note.staff} carries).
 *
 * Deferred by design (not modeled here): name, transposition, timbre — timbre is a
 * *playback* concern, never content. See docs/multi-staff-plan.md §1, §10.
 */
export interface StaffInfo {
  /** Stable identity. Slot/clef/dynamic/tuplet `staffId` back-pointers use this. */
  id: string
  /**
   * **How big this staff is drawn**, as a ratio of the score's staff size — `1` full size, `0.7`
   * a small staff (a cue-size violin part over a full-size piano). Absent = 1, by rule.
   *
   * ⛔ Deliberately a **ratio, not a `small: true` flag**: a boolean would write the feature's
   * ceiling into the model on day one. And deliberately **here rather than in an engraving
   * object**: principle 6's test is *can it vary at a point in the score?* — size varies per
   * staff (and later per system), so it is positional and belongs to the thing it varies at.
   * It is NOT part of the layout {@link Surface}; a canvas has no millimetres and still has a
   * staff size. Read it through `resolveStaffSize` (engine/models/staffSize.ts), never directly —
   * that is where per-system size will arrive. See docs/staff-size-plan.md §2, §3.
   */
  size?: number
  /**
   * ⭐⭐ **"My barlines continue into the gap BELOW me"** — whether a barline is drawn unbroken
   * through the space between this staff and the next one down. Absent = **NOT joined**, his call
   * of 2026-08-28 (*"default should be not joined"*); what joins "all barlines" is the default
   * reach of the GESTURE, not the state a score starts in. The last staff has no gap below it, so
   * the field is meaningless there.
   *
   * ⭐ **Keyed by the GAP, via the staff above it** — 1:1 with the thing a user drags and with
   * MuseScore's own field (`Staff::m_barLineSpan`, a bool meaning exactly this). ⛔ Not on
   * {@link Score} (principle 6: a `Score.barlineJoin` would silently mean "the join at bar 1"), and
   * ⛔ not a boolean on {@link StaffGroup} — the bracket does not own the join (LilyPond's
   * `GrandStaff` and `ChoirStaff` differ in the delimiter and the span bar *independently*), and a
   * group-wide flag cannot say "staves 2–3 joined while staff 1 stands alone".
   *
   * ⚠️ Read it through `barlineJoinsBelow` (engine/models/barlineJoin.ts), **never directly** — that
   * function takes the BOUNDARY as well, which is where the contemporary per-boundary mix will
   * arrive without a single caller moving. See docs/barline-join-plan.md §2.4.
   */
  barlineJoinBelow?: boolean
}

/**
 * An optional **grouping overlay**: an ordered set of staves forming one unit (a piano
 * = one group of two staves). Genuine *content* — it is what will later gate cross-staff
 * legality (allowed within a group, never between groups) and drive the brace/bracket —
 * so it lives in the model, but its rendering is DEFERRED. A sketch has no groups
 * (`Score.staffGroups` absent). See docs/multi-staff-plan.md §1, §4.
 */
export interface StaffGroup {
  id: string
  /** Ordered member staff ids of this unit (a piano = its two staff ids). */
  staffIds: string[]
  /**
   * ⭐⭐ **The sign drawn at the system's left edge for this group — and ABSENT means NO SIGN.**
   *
   * ⛔ **There is no default.** An absent `symbol` is not "draw a brace"; it is *nobody has asked for
   * a sign*, which is the whole safety of the feature: `models/staffGroups.groupsAt` gates on it, so
   * a group that exists for another reason (a future cross-staff legality scope, a MusicXML
   * `<group-symbol>none</group-symbol>`) draws nothing. ⚠️ This field said *"default 'brace' when
   * drawn"* until 2026-08-29, which would have put a brace on every multi-staff score the day
   * anything drew.
   *
   * ⭐ `subBracket` is the thin secondary sign that groups a subset inside a bracket — divisi
   * strings under the section's own bracket. ⛔ It has **no SMuFL glyph** and is not a thinner rod:
   * Gould draws it as a hairline `[` — see `engine/rendering/systemStart.drawSubBracket`.
   */
  symbol?: 'brace' | 'bracket' | 'subBracket'
}

/**
 * Represents a complete musical score
 */
export interface Score {
  /** Unique identifier for the score */
  id: string
  /**
   * Title of the score.
   *
   * ⭐ **OPTIONAL, and absent means there is none** — an untitled score, not an empty one. A fresh
   * model seeds the default label (`ScoreModel`'s `DEFAULT_FRAGMENT_TITLE`), and
   * `scoreTextOps.clearScoreText` DELETES the key rather than writing `''`: what is exported then
   * has no `title` at all, which is the honest serialization of "this score does not say". ⛔ Do not
   * reintroduce a required field with `''` as its "none" — that is the same conflation `Score`
   * avoids everywhere else (an empty string is a title you happened to type nothing into).
   *
   * ⚠️ Every reader must handle its absence; `utils/scoreFile.scoreFilename` and the PDF's filename
   * already did (`title ?? ''`), and 🚧 `rendering/ScoreHeaderPass` draws nothing when it is missing.
   * ⭐ {@link composer} is its twin — one family, one table (`engine/models/scoreTextOps`).
   */
  title?: string
  /** Composer name. ⭐ {@link title}'s twin in every respect — absent means there is none, blank is
   *  not a value, and the two are written and cleared through one table
   *  (`engine/models/scoreTextOps`). 🚧 Drawn by `rendering/ScoreHeaderPass`, which is a sketch. */
  composer?: string
  /** Measures in the score — the shared horizontal spine (barlines, meter), aligned
   *  across all staves. See docs/multi-staff-plan.md §4. */
  measures: Measure[]
  /**
   * The **staff axis**: staves ordered top→bottom. Length 1 for a single-staff score
   * (the default, not a special case). A live model always has this populated (the
   * constructor seeds one; {@link fromJSON} defaults it when absent in hand-written JSON).
   * Content back-references a staff by its {@link StaffInfo.id}; absent `staffId` on a
   * slot/clef/dynamic/tuplet means staff 0. See docs/multi-staff-plan.md §1, §4.
   */
  staves?: StaffInfo[]
  /**
   * Optional **grouping overlay** (a piano = one group of two staves). Genuine content
   * (gates future cross-staff legality + brace), but its rendering is DEFERRED; absent =
   * no groups (a sketch). See {@link StaffGroup} and docs/multi-staff-plan.md §1.
   */
  staffGroups?: StaffGroup[]
  /**
   * NOTE: there is deliberately **no `tempo` field**. Tempo is resolved positionally from
   * {@link Measure.tempos}, falling back to the engine constant `DEFAULT_TEMPO` (utils/
   * tempoMap) — never to a value stored on the score. A global "default tempo" would also
   * be, implicitly, "the tempo at bar 1 beat 0"; that exact conflation is what made
   * `score.clef` bleed across staves (docs/clef-model-plan.md). One way to state a tempo,
   * not two. See docs/tempo-marks-plan.md §0.
   */
  /**
   * NOTE: there is deliberately **no `keySignature` field** — and ✅ the prediction this note used
   * to make has come true exactly: a key signature is positional AND per-staff (a modulation is a
   * positional event like a clef change, and a transposing instrument's key differs from the
   * score's), so it landed as {@link Measure.keys} carrying a `staffId`, resolving positionally
   * through `utils/keySignature`'s `keyAt` and bottoming out in C major — never to a value stored
   * on the score. A global key would be, implicitly, "the key at bar 1 beat 0"; that
   * conflation is what made `score.clef` bleed across staves (docs/clef-model-plan.md).
   *
   * Nor is there a **`defaultTimeSignature`**, for the same reason (it was, in truth,
   * "the meter at bar 1"). Meter is resolved positionally from the `timeSignatureChange`
   * markers — {@link effectiveTimeSignature} in utils/meter — falling back to the constant
   * `DEFAULT_TIME_SIGNATURE`. It also has to go before per-staff meters / polymeter can
   * land (docs/multi-staff-plan.md §10).
   */
  /**
   * Phrasing slurs spanning runs of note events. Top-level (not measure-owned)
   * because a slur spans barlines and systems. Optional/absent = no slurs
   * (backward-compatible JSON). See {@link Slur} and docs/slur-plan.md.
   */
  slurs?: Slur[]
  /**
   * Trills — the `tr` sign and its wavy extension. Top-level for {@link Slur}'s reason (a span
   * anchored to notes, crossing barlines and systems), and stored beside it rather than on a
   * measure. Optional/absent = no trills (backward-compatible JSON). See {@link Trill} and
   * docs/trill-plan.md; ops in `engine/models/trillOps`.
   */
  trills?: Trill[]
  /**
   * Authored engraving overrides — hand-positioning that is NOT musical content: an
   * id-keyed compartment of staff-space, anchor-relative geometry. A sub-tree of
   * `Score` so it clones / serializes / undoes with the score value. Optional/absent
   * = none (backward-compatible JSON). See {@link EngravingOverrides} and
   * docs/engraving-overrides-plan.md.
   */
  engravingOverrides?: EngravingOverrides
  /**
   * How the score SOUNDS — the third compartment, beside content and
   * {@link Score.engravingOverrides}. Optional/absent = nothing has been chosen and every note
   * plays `DEFAULT_SOUND` (`engine/models/soundOps`), which is why a fresh sketch's JSON gains no
   * key at all. See {@link ScorePlayback} and docs/instruments-plan.md.
   */
  playback?: ScorePlayback
}

/**
 * WHAT A SOUND IS, to the score: an opaque reference another layer knows how to realise.
 *
 * ⛔ **Never a bare `program: number`.** General MIDI is ONE kind of sound and not THE kind — an
 * electroacoustic sketch's timbre may be a sample or a synth patch, and a model that had baked in a
 * GM integer could not say so without a migration (docs/instruments-plan.md §4, *Forbidden*).
 *
 * ⚠️ The score does not know what a `program` IS. Resolving one to audio is the
 * `InstrumentPlayer` seam's job, on the other side of principle 5's line: the score layer imports no
 * audio, so the GM catalogue (names, the picker's list) lives in `engine/audio/` and never here.
 */
export type SoundRef =
  | { kind: 'gm'; program: number }
  // ⏭️ 'sample' / 'synth' — the electroacoustic future (docs/instruments-plan.md §4). A `kind` this
  // build does not know is KEPT on load and ignored at playback: report-never-repair, and a file
  // written by a later version must not come back damaged.

/**
 * "From here on, this sounds like that" — a positional statement, exactly like a clef change.
 *
 * ⭐⭐ **POSITIONAL, never a `Score.sound` field.** A field would be, in truth, "the sound at bar 1
 * beat 0" — the conflation that made `score.clef` bleed across staves and cost `score.tempo`,
 * `keySignature` and `defaultTimeSignature` their places (principle 6; see the NOTEs above).
 *
 * ⭐ **Anchored by measure ID, not by measure number.** A number is a position in a list that
 * renumbers itself the moment a bar is inserted, which would silently move every sound change in
 * the score. Ids are what every other detached-but-anchored thing here keys by
 * (`engravingOverrides`), and this compartment is detached for the same reason.
 *
 * ⏭️ **WHAT ARRIVES LATER: the LANE — `staffId` and `voice`** (docs/instruments-plan.md P2). Their
 * absence is what an assignment written today means, so the rule has to be fixed now, before there
 * is a second reading to argue with:
 *
 * > ⭐⭐ **An absent lane field means EVERY lane — not staff 0.** These fields are a SCOPE, not a
 * > position, which is the same distinction a dynamic's `voices` already makes (absent = all of its
 * > staff, and `voiceOf()` is the wrong question to ask of it — docs/dynamic-voice-scope-plan.md).
 * > Read as a note's lane, an absent `staffId` would mean staff 0, and the day a second staff
 * > appeared it would fall silent — a bug the file itself could not explain.
 */
export interface SoundAssignment {
  /** The measure this takes effect in — {@link Measure.id}, never `Measure.number`. */
  measureId: string
  /** Where in that measure. Today always 0; the field is what makes bar-40-beat-3 expressible. */
  beat: Fraction
  sound: SoundRef
}

/**
 * The playback compartment. A sub-tree of `Score` so it clones / serializes / undoes with the score
 * value — `engravingOverrides`' status exactly, and for the same reason: the user expects a choice
 * they made to still be there tomorrow, and it is not content.
 */
export interface ScorePlayback {
  /**
   * Sound assignments in score order. Resolved by walking BACK from a note's position to the most
   * recent one — the walk `Measure.clefs` and `Measure.tempos` already do, over a list rather than
   * per measure because playback is not content and does not travel inside the music.
   */
  sounds: SoundAssignment[]
}
