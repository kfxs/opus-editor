/**
 * Core music types for the score editor
 */

import type { Fraction } from '../utils/fraction'
export type { Fraction }

/**
 * Note duration types supported by the editor
 */
export type NoteDuration = 'w' | 'h' | 'q' | '8' | '16' | '32'

/**
 * Tuplet definition (e.g., triplet = 3 notes in space of 2)
 */
export interface Tuplet {
  /** Unique identifier for the tuplet */
  id: string
  /** Beat position where the tuplet starts (exact rational) */
  startBeat: Fraction
  /** Base note duration for the tuplet (e.g., 'q' for quarter note triplet) */
  baseDuration: NoteDuration
  /**
   * Dots on that base duration — a triplet of DOTTED quarters. Absent = 0, which keeps every
   * existing score byte-identical.
   *
   * The unit is a note VALUE, and a note value can be dotted; Finale's two dropdowns list "Dotted
   * Quarter(s)" beside "Quarter(s)", and MusicXML carries `<tuplet-dot>` for the same reason. Without
   * it the dot has nowhere to go and cannot be worked around — `numNotes` counts NOTES, so respelling
   * the group in undotted units would change the ratio into a different tuplet.
   *
   * ⚠️ It must reach every span calculation: `getTupletTotalBeatsFrac` and `getTupletNoteDurationFrac`
   * both take it, and a site that forgets it computes a span a third short, silently.
   */
  baseDots?: number
  /** Number of notes in the tuplet (e.g., 3 for triplet) */
  numNotes: number
  /** Number of base notes the tuplet occupies (e.g., 2 for triplet) */
  notesOccupied: number
  /**
   * Explicit bracket/number placement override. When undefined the side is
   * auto-derived from stem direction (bracket opposite the stems); setting this
   * forces the side, e.g. via the `x` flip. 'above' = LOCATION_TOP, 'below' = LOCATION_BOTTOM.
   */
  placement?: 'above' | 'below'
  /** Staff this tuplet belongs to (a {@link StaffInfo} id); absent = staff 0. See
   *  docs/multi-staff-plan.md §4. Orthogonal to voice (the owning slots carry it). */
  staffId?: string
}

/**
 * Accidental types
 */
export type Accidental = '#' | 'b' | 'n'

/**
 * Diatonic step name (letter name of the note, independent of accidental)
 */
export type PitchStep = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B'

/**
 * Chromatic alteration in semitones.
 * -2 = double-flat (bb), -1 = flat (b), 0 = natural, 1 = sharp (#), 2 = double-sharp (##)
 */
export type PitchAlter = -2 | -1 | 0 | 1 | 2

/**
 * Enharmonic-aware pitch spelling: step + alteration + scientific octave.
 *
 * This is the industry-standard representation (MusicXML, music21).
 * Unlike a bare MIDI integer, it distinguishes enharmonic equivalents:
 *   C#4 = { step: 'C', alter:  1, octave: 4 }  — MIDI 61
 *   Db4 = { step: 'D', alter: -1, octave: 4 }  — MIDI 61
 *
 * MIDI is always *derived* from this, never primary.
 * Use spellingToMidi() to compute the MIDI value.
 */
export interface PitchSpelling {
  step: PitchStep
  alter: PitchAlter
  /** Scientific octave number — C4 is middle C (MIDI 60) */
  octave: number
}

/**
 * Articulation types
 */
export type ArticulationType = 'accent' | 'staccato' | 'tenuto'

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
 * **The mark IS its `text`** (docs/dynamics-text-as-truth-plan.md). The text mixes SMuFL dynamics
 * glyphs — the `f`/`p`/… drawn in the music font, which ARE the levels — with plain expression
 * words (`dolce`), e.g. `f con brio` or `più f`. There is deliberately NO `kind`/`level` field:
 *  - glyph vs word is decided per character by whether it's a dynamics glyph (the FONT, not the
 *    spelling — a typed plain `p` is a letter, a glyph `𝆏` is piano); see `utils/dynamics`.
 *  - meaning — the played level is DERIVED from the glyph runs (`dynamicLevelOf`), never stored.
 *  - scope — `voice` it governs, until the next dynamic in that voice.
 */
export interface Dynamic {
  /** Unique identifier */
  id: string
  /** Beat position within the measure (lands on a slot boundary, like clefs) */
  beat: Fraction
  /** The whole printed string, verbatim: SMuFL dynamics glyphs for the levels + plain words for
   *  expression text. The level and glyph/word split are both derived from this (utils/dynamics). */
  text: string
  /** Governed voice/stream; default 0. See {@link Note.voice}. */
  voice?: 0 | 1 | 2 | 3
  /** Vertical placement relative to the staff; default 'below'. */
  placement?: 'above' | 'below'
  /** Staff this dynamic belongs to (a {@link StaffInfo} id); absent = staff 0. See
   *  docs/multi-staff-plan.md §4. Orthogonal to {@link Dynamic.voice}. */
  staffId?: string
}

/**
 * A tempo mark: a verbal indication ('Allegro'), a metronome mark (♩ = 120), or both
 * ('Allegro (♩ = 120)'). ONE object — not three types.
 *
 * SYSTEM-level: it governs the clock, not a staff, so unlike {@link Dynamic} it has
 * **no `staffId` and no `voice`**. It rides the shared measure spine (measure-owned,
 * beat-anchored, exactly like `clefs`/`dynamics`), which is what makes it system-level
 * for free. See docs/tempo-marks-plan.md.
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
   * engraving and the renderer just draws it (utils/tempoText, engine/rendering/TempoLayout).
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
   * costs a rewrite. See docs/tempo-marks-research.md §7.
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
 * freely. See docs/slur-plan.md.
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
   * model. Absent override = the auto arch. See docs/engraving-overrides-plan.md.
   */
  /**
   * Reserved for future nested/overlapping-slur disambiguation (MusicXML `number`).
   * Unused in this pass.
   */
  number?: number
}

/**
 * One authored engraving adjustment on a score element — an entry in the
 * **engraving-overrides compartment** (see docs/engraving-overrides-plan.md).
 *
 * An override is *authored geometry*: continuous, measured, hand-positioned data
 * that is deliberately kept OUT of the musical content model, so transposition,
 * playback and re-barring never trip over pixels. Positional kinds store
 * **staff-spaces**, relative to the element's natural (auto) position — never raw
 * pixels, never an absolute canvas coordinate — so a tweak renders correctly at any
 * font/zoom/spacing and rides along when the music reflows.
 *
 * Open-ended by design: each entry is tagged by `kind`; adding a new kind later is
 * additive (a new tagged member), never a teardown. Phase 0 ships the compartment
 * with no concrete kinds yet — the first kind (`curveShape`, migrating today's
 * {@link Slur.cps}) lands in Phase 1. Distinct from *semantic* side/direction flips
 * (`stemDirection`, `*.placement`, `tieDirection`), which are notational meaning and
 * stay on the content model above — only continuous geometry lives here.
 */
export interface EngravingOverride {
  /** Discriminator: which kind of adjustment this is. Concrete kinds are introduced
   *  incrementally; see docs/engraving-overrides-plan.md §4. */
  kind: string
}

/**
 * Two cubic Bézier control-point **deltas** fed to VexFlow `Curve.renderCurve` — the
 * editable "handle" data for a slur/curve shape. Each `{x,y}` is an offset on top of
 * the spacing-based base control point, so an edit rides along when the anchor notes
 * move. See docs/slur-plan.md §6–§7 and {@link CurveShapeOverride}.
 */
export type CurveControlPointDeltas = [{ x: number; y: number }, { x: number; y: number }]

/**
 * Client #1 of the engraving-overrides compartment (Phase 1): a hand-edited curve
 * shape, migrated from the former `Slur.cps`. The two control-point deltas are stored
 * in **staff-spaces**, anchor-relative — NOT pixels (the old `Slur.cps` flaw: a pixel
 * offset is tied to the current font/zoom/spacing). The renderer converts staff-spaces
 * → pixels at draw time against the live stave; absent = the auto arch.
 */
export interface CurveShapeOverride extends EngravingOverride {
  kind: 'curveShape'
  /** Control-point deltas in **staff-spaces**, anchor-relative. */
  cps: CurveControlPointDeltas
}

/**
 * Per-segment shape for a **cross-system** slur (one drawn as `BEGIN + k×MIDDLE + END`,
 * see docs/multisystem-slur-segment-shape-plan.md). A same-line slur is a single arc and
 * uses {@link CurveShapeOverride} instead — this is a deliberately SEPARATE kind, so the
 * single↔multi boundary needs no special logic (a collapsed-to-one-line slur reads its
 * empty `curveShape` and draws the default).
 *
 * Unlike every other override, this one is **deliberately layout-ephemeral**: a MIDDLE
 * segment is anchored to nothing but its system's margins (a pure layout artifact), so its
 * shape is meaningful only while that middle exists. `begin`/`end` are tied to the real
 * start/end notes and are durable. The reset signature is {@link spanCount}: when the live
 * system count (`toLine − fromLine + 1`) differs from the authored `spanCount`, the
 * `middles` are stale and ignored at read time (begin/end still apply). See
 * `reconcileSegmentShape` for the read-only apply rule.
 */
/**
 * Addresses ONE segment of a cross-system slur for a shape edit: a role-keyed BEGIN/END
 * (durable, note-anchored) or an ordinal-keyed MIDDLE (layout-bound). Used by the handle
 * drag → `setSlurSegmentShape` write path. A same-line slur has no address (its whole arc
 * is the single-arc `curveShape`).
 */
export type SlurSegmentAddress =
  | { role: 'begin' | 'end' }
  | { role: 'middle'; ordinal: number }

export interface SegmentCurveShapeOverride extends EngravingOverride {
  kind: 'segmentCurveShape'
  /** System count this was authored against (`toLine − fromLine + 1`). The reset
   *  signature: a live count differing from this means the `middles` are stale. */
  spanCount: number
  /** BEGIN segment cps (staff-spaces, anchor-relative). Role-keyed → durable. */
  begin?: CurveControlPointDeltas
  /** END segment cps (staff-spaces, anchor-relative). Role-keyed → durable. */
  end?: CurveControlPointDeltas
  /** MIDDLE segment cps keyed by **ordinal** among middles (0-based, NOT lineNumber) —
   *  survives a same-count reflow, dropped on a count change via `spanCount`. */
  middles?: Record<number, CurveControlPointDeltas>
}

/**
 * Client #3 of the engraving-overrides compartment: a free positional nudge of a slur's
 * in/out endpoint(s), on top of its note anchor (see docs/slur-endpoint-offset-plan.md).
 * Each offset is in **staff-spaces**, anchor-relative — added to the auto endpoint
 * position at render against that end's own stave. Unlike {@link CurveShapeOverride} /
 * {@link SegmentCurveShapeOverride}, this is **durable across a re-anchor**: both ends are
 * note-anchored on same-line AND cross-system slurs (no `spanCount` staleness), and the
 * relative nudge rides onto the new anchor. Read straight through (no reconcile rule);
 * cleared only when the slur is deleted.
 */
export interface SlurEndpointOffsetOverride extends EngravingOverride {
  kind: 'endpointOffset'
  /** Start (in) point offset in staff-spaces, relative to the start anchor. */
  start?: { x: number; y: number }
  /** End (out) point offset in staff-spaces, relative to the end anchor. */
  end?: { x: number; y: number }
}

/**
 * Addresses ONE open join of a cross-system slur for an endpoint-offset nudge (the
 * point where the slur leaves one system and resumes on the next). BEGIN has only an
 * open RIGHT end and END only an open LEFT end (so no `side`); a MIDDLE has both.
 * Distinct from {@link SlurSegmentAddress} (shape edits never carry a side). The two
 * TRUE note-anchored ends are addressed by `'start'`/`'end'` (see
 * {@link SlurEndpointOffsetOverride}), not here.
 */
export type SlurSegmentEndpointAddress =
  | { role: 'begin' }
  | { role: 'end' }
  | { role: 'middle'; ordinal: number; side: 'left' | 'right' }

/**
 * Client #4 of the engraving-overrides compartment: free positional nudges of the OPEN
 * join points of a cross-system slur (see docs/multisystem-slur-segment-endpoint-offset-plan.md).
 * Each offset is in **staff-spaces**, margin-relative — added to the auto open-end position
 * at render against that segment's own stave. Structurally parallel to
 * {@link SegmentCurveShapeOverride}: `begin`/`end` are durable (their system margins are
 * stable references), `middles` reset on a `spanCount` change. The two TRUE note-anchored
 * ends use {@link SlurEndpointOffsetOverride} instead — deliberately a SEPARATE kind, just
 * as `curveShape` (single arc) is separate from `segmentCurveShape` (per segment).
 */
export interface SegmentEndpointOffsetOverride extends EngravingOverride {
  kind: 'segmentEndpointOffset'
  /** System count this was authored against (`toLine − fromLine + 1`). Reset signature:
   *  a live count differing from this means the `middles` are stale. */
  spanCount: number
  /** BEGIN segment's open RIGHT end offset (staff-spaces). Role-keyed → durable. */
  begin?: { x: number; y: number }
  /** END segment's open LEFT end offset (staff-spaces). Role-keyed → durable. */
  end?: { x: number; y: number }
  /** MIDDLE open-end offsets keyed by **ordinal** among middles (0-based, NOT lineNumber):
   *  `left` and/or `right`. Survives a same-count reflow, dropped on a count change. */
  middles?: Record<number, { left?: { x: number; y: number }; right?: { x: number; y: number } }>
}

/**
 * Client #5 of the engraving-overrides compartment: a manual vertical shift of a rest,
 * in whole **staff-steps** (signed, +up), added on top of the automatic multi-voice
 * placement (see docs/rest-shift-plan.md). A rest is pitchless, so its vertical position
 * carries no musical meaning — this is pure engraving/clarity geometry, not content, and
 * staff-steps keep it resolution-independent (no pixels in the model, principle 3).
 *
 * Unlike every other client, this one is **position-keyed, not element-id-keyed**: rests
 * are regenerated (fresh ids) on every edit, so the override hangs off the rest's
 * position address (`restPositionKey`, `{measureId}:v{voice}:b{num}/{den}`) instead. The
 * shift travels with the music across paste/rebar via `captureRestShifts`/`restoreRestShifts`.
 */
export interface RestShiftOverride extends EngravingOverride {
  kind: 'restShift'
  /** Whole staff-steps, signed. Added on top of the default voice shift. +up. */
  steps: number
}

/**
 * Client #6 of the engraving-overrides compartment: a hidden rest (Sibelius-style
 * Ctrl+Shift+H — see docs/rest-hide-plan.md). The rest is still real content (an empty
 * beat stays filled); this only suppresses its normal engraving. The override carries no
 * payload — **presence = hidden, absence = visible** — so JSON stays clean and absent
 * degrades to the default (drawn) just like every other client.
 *
 * Like {@link RestShiftOverride}, it is **position-keyed, not element-id-keyed** (rests get
 * fresh ids on every edit): the key is the rest's position address (`restPositionKey`). It
 * travels with the music across paste/rebar via `captureRestShifts`/`restoreRestShifts`.
 */
export interface RestHiddenOverride extends EngravingOverride {
  kind: 'restHidden'
}

/**
 * Client #8 of the engraving-overrides compartment: this meter change ALLOWS a courtesy
 * (cautionary) time signature. Payloadless — presence alone means allowed. Keyed by the id of the
 * measure the change starts at ({@link cautionaryKey}), because a meter change has no id of its own.
 *
 * A property of the CHANGE, and there is no score-wide default to reconcile it with: a cautionary
 * can only ever exist where a meter changes, so every one of them has a change to belong to. The
 * rule is one condition in two halves — this flag, and then whether the change happens to open a
 * system (`MeasureLayout`). Nothing is ever drawn and then hidden; a courtesy that is not allowed is
 * simply never produced.
 *
 * It lives in the compartment rather than beside `Measure.timeSignatureHidden` because it is an
 * authored engraving decision about a position, not part of what the music says — the meter, the
 * bars and the playback are identical either way (docs/time-signature-window-plan.md §1).
 */
export interface CautionaryOverride extends EngravingOverride {
  kind: 'cautionary'
}

/**
 * Client #9: the same decision for a CLEF change — this change allows a courtesy clef at the end of
 * the previous system. Payloadless; presence = allowed. Keyed by {@link cautionaryClefKey}, which is
 * (measure, staff) and NOT a beat: a courtesy only ever warns about the clef that OPENS the next
 * system, so a mid-measure change has nothing to warn about.
 *
 * Its own kind rather than sharing the meter's, so the two can never be read for one another and a
 * Properties dump names which is which.
 */
export interface CautionaryClefOverride extends EngravingOverride {
  kind: 'cautionaryClef'
}

/**
 * Client #7 of the engraving-overrides compartment: extra vertical space ABOVE a staff
 * (Sibelius "space above staff" — see docs/staff-spacing-plan.md). Stored in STAFF-SPACES,
 * signed (+ = push the staff and everything below it in its system downward). Absent =
 * default spacing.
 *
 * Unlike the position-keyed rest clients, this is **element-id-keyed** in the usual way —
 * the key is the durable `staffId`, so single-staff is just the N=1 case (its "space above"
 * is the top-margin gap). Phase 1 is global-per-staff (applies on every system); a future
 * per-system refinement anchors to the system's opening measure and falls back to this value.
 */
export interface StaffSpacingOverride extends EngravingOverride {
  kind: 'staffSpacing'
  /** Extra space above the staff, in staff-spaces. Signed; + pushes down. */
  above: number
}

/**
 * Client #8 of the engraving-overrides compartment: a free positional nudge of a dynamic
 * off its note anchor (the ←→↑↓ / Ctrl+arrow keyboard fine-positioning — see
 * docs/dynamic-offset-plan.md). Each component is in **staff-spaces**, anchor-relative —
 * added to the dynamic's auto placement (below/above the staff, under its anchor note) at
 * render. `x` is +right, `y` is +down (screen), matching {@link SlurEndpointOffsetOverride}.
 *
 * **Element-id-keyed** in the usual way — a dynamic has a durable id, so this reads straight
 * through (no position-key or `spanCount` staleness, unlike the rest clients / segment
 * offsets). Returning to (0,0) clears the entry so "absent = default" holds. Does not yet
 * travel across paste (a pasted dynamic mints a fresh id); deferred, like slur `curveShape`.
 */
export interface DynamicOffsetOverride extends EngravingOverride {
  kind: 'dynamicOffset'
  /** Horizontal offset in staff-spaces, relative to the anchor. +right. */
  x: number
  /** Vertical offset in staff-spaces, relative to the anchor. +down (screen). */
  y: number
}

/**
 * The engraving-overrides compartment: a keyed table of authored geometry held
 * as a sub-tree of {@link Score} (so it clones / serializes / undoes with the score
 * value — principle 1). Usually keyed by the *element id* an override hangs off (a note /
 * chord-pitch / slur / dynamic id…), each value an open-ended list of
 * {@link EngravingOverride} (an element may be nudged *and* reshaped).
 *
 * **Not every key is an element id.** {@link RestShiftOverride} (client #5) is
 * position-keyed (`restPositionKey`) because rests have no durable id — a future reader
 * must not assume a key resolves to an element. Safe to mix: position keys contain `:`/`/`
 * so they can never collide with a uuid; nothing enumerates the table assuming id-keys.
 *
 * Absent/empty = no overrides (backward-compatible JSON); every kind degrades to its
 * render-time default when no entry exists. Stored as a plain object — NOT a Map — so
 * it round-trips through `JSON.stringify` (undo snapshots, export) unchanged.
 */
export type EngravingOverrides = Record<string, EngravingOverride[]>

/**
 * Stem direction for notes
 * - 'auto': Calculate based on pitch and clef (default)
 * - 'up': Force stem up
 * - 'down': Force stem down
 */
export type StemDirection = 'auto' | 'up' | 'down'

/**
 * Explicit beaming override for a note.
 * - 'auto':     automatic beaming (default — uses beat-boundary rules)
 * - 'single':   force no beam (isolate this note)
 * - 'begin':    start an explicit beam group
 * - 'continue': continue the beam across a boundary (bridge two auto groups)
 * - 'end':      close the current explicit beam group
 */
export type BeamMode = 'auto' | 'single' | 'begin' | 'continue' | 'end'

/**
 * Represents a single musical note (or rest).
 *
 * Pitch is stored as step + alter + octave (PitchSpelling), NOT as a raw MIDI integer.
 * These fields are undefined for rests (isRest === true).
 * Use spellingToMidi(step!, alter!, octave!) to derive the MIDI value when needed.
 */
export interface Note {
  /** Unique identifier for the note */
  id: string
  /** Diatonic step name — undefined for rests */
  step?: PitchStep
  /** Chromatic alteration: -2=bb  -1=b  0=natural  1=#  2=## — undefined for rests */
  alter?: PitchAlter
  /** Scientific octave (C4 = middle C) — undefined for rests */
  octave?: number
  /** Note duration */
  duration: NoteDuration
  /** Measure number (1-indexed) */
  measure: number
  /** Beat position within the measure (0-indexed, exact rational fraction) */
  beat: Fraction
  /** If true, always show the accidental sign even when measure rules would suppress it */
  forceAccidental?: boolean
  /** Whether this note is a rest */
  isRest?: boolean
  /** True for a whole-bar measure rest (its `duration` is the nominal `'w'`, not
   *  a real chosen value). Mirrors {@link Rest.isMeasureRest} on the flat view. */
  isMeasureRest?: boolean
  /** Stem direction override (default: 'auto' - calculated from pitch and clef) */
  stemDirection?: StemDirection
  /** ID of the note this note is tied TO (forward tie) */
  tiedTo?: string
  /** ID of the note this note is tied FROM (backward tie) */
  tiedFrom?: string
  /** Number of dots (0=none, 1=dotted, 2=double-dotted) */
  dots?: number
  /** ID of the tuplet this note belongs to */
  tupletId?: string
  /**
   * Exact sounding duration as a rational fraction (in beats).
   * For regular notes equals durationToFraction(duration, dots).
   * For tuplet notes equals that value × (notesOccupied / numNotes).
   * Stored explicitly so all timing comparisons can be exact — no epsilon.
   */
  actualDuration?: Fraction
  /** Articulations applied to this note */
  articulations?: ArticulationType[]
  /**
   * Explicit side for this slot's articulations (above/below the note).
   * Omitted = auto (derived from stem direction, the common-case default).
   * Set only when the user flips the side (the `x` shortcut).
   */
  articulationPlacement?: 'above' | 'below'
  /** Explicit beaming override */
  beam?: BeamMode
  /**
   * Voice index (0–3) this note belongs to. Voices are independent rhythmic
   * streams within a bar. Only voice 0 is populated today (no multi-voice
   * editing yet); the field exists so collision/fill/read paths are voice-ready.
   */
  voice?: 0 | 1 | 2 | 3
  /**
   * 0-based index of this note's staff in {@link Score.staves} (default 0). This is the
   * **positional** projection of the internal `staffId` back-pointer (mirrors `measure`
   * being an ordinal), for staff-aware addressing in the flat public API. Note-**id**
   * lookups stay global and are unaffected. See docs/multi-staff-plan.md §4.
   */
  staff?: number
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
 * Internal pitch-only object stored inside a Chord.
 *
 * Pitch is stored as step + alter + octave (MusicXML / music21 convention),
 * NOT as a raw MIDI integer. This makes enharmonic spelling explicit:
 *   C#4 = { step:'C', alter:1,  octave:4 }
 *   Db4 = { step:'D', alter:-1, octave:4 }
 * Use spellingToMidi() from pitchSpelling.ts to derive the MIDI value.
 */
export interface NotePitch {
  id: string
  /** Diatonic step name */
  step: PitchStep
  /** Chromatic alteration: -2=bb  -1=b  0=natural  1=#  2=## */
  alter: PitchAlter
  /** Scientific octave — C4 is middle C */
  octave: number
  /** Show accidental sign even when measure context would suppress it */
  forceAccidental?: boolean
  tiedTo?: string      // ID of another NotePitch in another Chord
  tiedFrom?: string
  /**
   * Explicit tie-curve direction override on the tie that STARTS at this pitch:
   * -1 = curve up/over, +1 = curve down/under. Omitted = auto (derived from the
   * note's staff position / its place in a chord, see VexFlowRenderer.getTieDirection).
   * Set by flipping a selected tie with `x`. Unlike a slur a tie stays flat and
   * anchored to the noteheads, so flipping only inverts the arc direction.
   */
  tieDirection?: -1 | 1
}

/** A rhythmic slot containing one or more pitches */
export interface Chord {
  id: string
  type: 'chord'
  beat: Fraction
  duration: NoteDuration
  dots?: number
  measure: number
  voice?: 0 | 1 | 2 | 3
  stemDirection?: StemDirection
  beam?: BeamMode
  tupletId?: string
  actualDuration?: Fraction
  articulations?: ArticulationType[]
  /** Explicit side for articulations (above/below); omitted = auto (stem-derived). */
  articulationPlacement?: 'above' | 'below'
  /**
   * Staff this chord belongs to (a {@link StaffInfo} id). Absent = staff 0 (the first
   * staff), mirroring absent {@link Note.voice} = voice 0. Orthogonal to voice: a slot's
   * vertical identity is the pair `(staffId, voice)`. See docs/multi-staff-plan.md §4.
   */
  staffId?: string
  notes: NotePitch[]
}

/** An empty rhythmic slot (silence) */
export interface Rest {
  id: string
  type: 'rest'
  beat: Fraction
  duration: NoteDuration
  dots?: number
  measure: number
  voice?: 0 | 1 | 2 | 3
  tupletId?: string
  actualDuration?: Fraction
  tiedFrom?: string
  /**
   * Staff this rest belongs to (a {@link StaffInfo} id); absent = staff 0. Orthogonal
   * to voice, exactly like {@link Chord.staffId}. See docs/multi-staff-plan.md §4.
   */
  staffId?: string
  /**
   * True for the single rest that fills an entire empty bar (a measure rest).
   * Rendered as a centred whole rest regardless of bar length (Phase 3); the
   * stored `duration` is `'w'` and `actualDuration` carries the true bar length.
   */
  isMeasureRest?: boolean
}

export type ChordRest = Chord | Rest

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
   * render voice capacity (resolved via utils/musicUtils `measureCapacityFrac`).
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
  /** Bracket/brace symbol; rendering DEFERRED, default 'brace' when drawn. */
  symbol?: 'brace' | 'bracket'
}

/**
 * Represents a complete musical score
 */
export interface Score {
  /** Unique identifier for the score */
  id: string
  /** Title of the score */
  title: string
  /** Composer name */
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
   * NOTE: there is deliberately **no `keySignature` field** (and none on {@link Measure}).
   * The editor has no key-signature feature yet; when one is built, a key signature is
   * positional AND per-staff — a modulation is a positional event like a clef change, and
   * a transposing instrument's key differs from the score's. It will therefore land as
   * `Measure.keys?: KeyChange[]` carrying a `staffId` (the shape of `clefs` / `dynamics` /
   * `tempos`), resolving positionally to a constant "no accidentals" — never to a value
   * stored on the score. A global key would be, implicitly, "the key at bar 1 beat 0"; that
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
   * Authored engraving overrides — hand-positioning that is NOT musical content: an
   * id-keyed compartment of staff-space, anchor-relative geometry. A sub-tree of
   * `Score` so it clones / serializes / undoes with the score value. Optional/absent
   * = none (backward-compatible JSON). See {@link EngravingOverrides} and
   * docs/engraving-overrides-plan.md.
   */
  engravingOverrides?: EngravingOverrides
}

/**
 * Ghost note preview shown while hovering before note entry.
 * Pitch is stored as spelling (step/alter/octave) — same as NotePitch.
 */
export interface GhostNote {
  step: PitchStep
  alter: PitchAlter
  octave: number
  duration: NoteDuration
  measure: number
  beat: number
  /** 0-based staff index the preview renders on (multi-staff; absent = staff 0). */
  staff?: number
  rawX?: number
  rawY?: number
  dots?: number
  articulations?: ArticulationType[]
  /** Show a natural (♮) even though `alter` is 0 — the preview for an armed natural accidental,
   *  which otherwise has no glyph (alter 0 draws nothing). Sharp/flat carry their own sign via alter. */
  forceAccidental?: boolean
  /** The armed tuplet's number ('3', '5:4'), drawn above the ghost — the preview for "this click
   *  starts a tuplet". Absent = no tuplet armed, and the ghost is an ordinary note. */
  tupletLabel?: string
  /** Ghost paint colour = the active voice's colour (V1 blue, V2 green). Defaults
   *  to the app's blue when omitted. See utils/voiceColors. */
  fillColor?: string
  strokeColor?: string
}

/**
 * Pixel coordinates
 */
export interface PixelCoordinates {
  x: number
  y: number
}

/**
 * Parameters for creating or updating a note.
 *
 * Pitch is specified as step + alter + octave (PitchSpelling).
 * All three pitch fields should be provided together for non-rests;
 * they are omitted (or undefined) for rests.
 */
export interface NoteParams {
  /** Diatonic step name — omit for rests */
  step?: PitchStep
  /** Chromatic alteration — omit for rests, defaults to 0 (natural) when step is provided */
  alter?: PitchAlter
  /** Scientific octave — omit for rests */
  octave?: number
  duration: NoteDuration
  measure: number
  beat: Fraction
  forceAccidental?: boolean
  isRest?: boolean
  dots?: number
  tupletId?: string
  actualDuration?: Fraction
  articulations?: ArticulationType[]
  /** Explicit side for articulations (above/below); omitted = auto (stem-derived). */
  articulationPlacement?: 'above' | 'below'
  tiedTo?: string
  tiedFrom?: string
  stemDirection?: StemDirection
  beam?: BeamMode
  /** Voice index (0–3). Defaults to 0. See {@link Note.voice}. */
  voice?: 0 | 1 | 2 | 3
  /** 0-based staff index in {@link Score.staves}. Defaults to 0. See {@link Note.staff}. */
  staff?: number
}
