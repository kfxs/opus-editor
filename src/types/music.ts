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
 * Interpreted dynamic levels — the marks that drive playback loudness.
 *
 * EXTEND THIS UNION to add more standard dynamics (ppp…fff, sf, sfz, …). Every
 * member needs a matching row in DYNAMIC_VELOCITY (utils/dynamics.ts) and a
 * glyph in the render layer; nothing else hardcodes this list.
 */
export type DynamicLevel = 'p' | 'mp' | 'mf' | 'f'

/**
 * A dynamic marking positioned within a measure, mirroring {@link ClefChange}:
 * a beat-anchored, measure-owned, selectable/deletable marking.
 *
 * Three independent axes (see docs/dynamics-plan.md §5):
 *  - glyph    — `level` (a SMuFL dynamics glyph) or `text` (custom italic)
 *  - meaning  — interpreted level → velocity via DYNAMIC_VELOCITY; text is silent
 *  - scope    — `voice` it governs, until the next dynamic in that voice
 */
export interface Dynamic {
  /** Unique identifier */
  id: string
  /** Beat position within the measure (lands on a slot boundary, like clefs) */
  beat: Fraction
  /** 'level' = interpreted (drives playback); 'text' = custom italic, silent */
  kind: 'level' | 'text'
  /** The dynamic level when kind === 'level' */
  level?: DynamicLevel
  /** User-editable italic text when kind === 'text' (never interpreted) */
  text?: string
  /** Governed voice/stream; default 0. See {@link Note.voice}. */
  voice?: 0 | 1 | 2 | 3
  /** Vertical placement relative to the staff; default 'below'. */
  placement?: 'above' | 'below'
  /** Staff this dynamic belongs to (a {@link StaffInfo} id); absent = staff 0. See
   *  docs/multi-staff-plan.md §4. Orthogonal to {@link Dynamic.voice}. */
  staffId?: string
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
  /** Optional key signature (number of sharps/flats, positive = sharps, negative = flats) */
  keySignature?: number
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
 * Key signature representation
 */
export interface KeySignature {
  /** Key name (e.g., 'C', 'G', 'Dm') */
  key: string
  /** Number of sharps (positive) or flats (negative) */
  accidentals: number
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
  /** Default tempo in BPM */
  tempo: number
  /** Key signature for the score */
  keySignature: KeySignature
  /** Default time signature */
  defaultTimeSignature: TimeSignature
  /** Clef for the score (default: 'treble') */
  clef?: Clef
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
 * Position in the score (for cursor, selection, etc.)
 */
export interface Position {
  /** Measure number (1-indexed) */
  measure: number
  /** Beat position (0-indexed, exact rational fraction) */
  beat: Fraction
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
