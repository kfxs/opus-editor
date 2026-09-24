/**
 * NOTES — what a slot holds (`Chord` / `Rest`, the voice-ready shape in `Measure.slots`), what a note
 * wears (articulation, tremolo, fan, beam statements), and the flat `Note` / `NoteParams` the public
 * note API speaks.
 *
 * One chapter of the score's types — import it through the barrel, `@/types/music`.
 */
import type { NoteDuration, Fraction } from './duration'
import type { PitchStep, PitchAlter } from './pitch'

/**
 * Articulation types
 */
export type ArticulationType = 'accent' | 'staccato' | 'tenuto'

/**
 * A single-note tremolo — the strokes that ride a note's stem and say "repeat this note, this
 * finely". One to five strokes, or the Penderecki sign (SMuFL `pendereckiTremolo`, E22B).
 *
 * ⚠️ The number is **how the mark is written, not how it is performed**. The measured /
 * unmeasured split is NOT `typeof === 'number'`: four and five strokes are numbers and are
 * never measured, and even three usually is not. The reading is *derived* from the stroke count
 * plus the note's own flags at playback time (docs/plans/tremolo-plan.md §5) — nothing is stored for
 * it, because nothing about the notation says it.
 *
 * The Penderecki sign is a member of the same field rather than a flag beside it because a note
 * carries ONE tremolo: "three strokes AND unmeasured" has no meaning to write down.
 */
export type TremoloMark = 1 | 2 | 3 | 4 | 5 | 'penderecki'

/**
 * A FANNED (feathered) beam — a group that speeds up or slows down **within a fixed total
 * duration**. Gould: it "indicates free accelerando or rallentando *within the duration*" of the
 * group; the beams converge at the slowest point and are fully feathered at the fastest. It is not
 * a tempo change — nothing after the group is affected and the clock never moves.
 *
 * ⭐ **The assertion, not its consequence.** You type one ordinary note that already fills the bar
 * — a blanca — and say "play this as an accelerando"; what is stored is that sentence. The N notes
 * it is played and drawn as are a *projection*, produced by `fanMembers` (utils/fannedBeam) and
 * never written back. Assertion → consequence is a function; the reverse is not. See
 * docs/plans/fanned-beams-plan.md §0.
 *
 * ⭐ **The RHYTHM is a projection; the PITCHES are not.** {@link members} is the one thing inside a
 * fan that is stored, because a pitch cannot be derived from anything — see
 * docs/plans/fanned-beam-pitches-plan.md §0-§1. It does not make the group divisible: this is still ONE
 * slot, of one written duration, and no pipeline that walks slots sees anything new.
 *
 * ⚠️ Every number here is PROVISIONAL — see docs/plans/fanned-beams-plan.md §1. They are not considered
 * engraving or performance decisions, and tuning them is ongoing hand work.
 */
export interface FanMark {
  direction: 'accel' | 'rit'
  /** How many notes the group is played and drawn as. */
  count: number
  /** Beam lines at the WIDE end. The narrow end is always 1 (Dorico's model, and its limit). */
  beams: number
  /**
   * ⭐ **How long the gesture LASTS, when that is not the slot's own written value.** Absent — the
   * only spelling of the default — means "exactly this note's duration", which is what every fan
   * marked on a note you typed says, and what the feature meant on day one.
   *
   * It exists because a fan can also be made the OTHER way round: type the notes, select them, and
   * collapse the passage into one fanned gesture (`engine/models/fanCollapse.ts`). Seven sixteenths
   * span 7/16 — a real length in time, and one no single notehead spells (a dotted quarter TIED to a
   * sixteenth). The slot keeps ONE written duration regardless, because that is what the fan model
   * is (see above); the length the group actually occupies is stored here instead.
   *
   * ⭐ **On the MARK, so `actualDuration` stays derived.** A slot's sounding length is cached on the
   * slot (`ChordRest.actualDuration`) and RECOMPUTED — `ScoreModel.computeActualDurationForSlot`, and
   * `fromJSON` deliberately recomputes every slot's rather than trust the wire. A span stored on the
   * slot would therefore be erased by its own load. Stored on the mark it is authored data like
   * `count`, the recompute reads it, and removing the fan gives the slot its written length back with
   * no cleanup step to forget — the same shape as every other number here: an assertion, with the
   * sounding length as its consequence.
   *
   * ⚠️ In quarter-note beats, exact ({@link Fraction}) — the unit `slotLength` answers in.
   */
  length?: Fraction
  /**
   * ⭐ Which member the feathering STARTS on and which it ENDS on — 0-based member indices,
   * **inclusive**, and `rampFrom` is always the LEFT one (`0 ≤ rampFrom < rampTo ≤ count-1`). Absent
   * on both means the whole group, which is what every fan drawn before this existed says.
   *
   * ⭐ **Named for the RAMP, not for the beam lines, because they govern both.** A note outside the
   * mark sounds at the steady base speed and carries ONE beam, so the sounding weights, the head
   * spacing and the drawn levels are one fact with three readers — `fanWeights` (utils/fannedBeam) is
   * the reader, and the only place these two numbers are interpreted. Picture and playback are the
   * same function here, as they have been since day one (docs/plans/fan-ramp-range-plan.md §0).
   *
   * ⚠️ **ABSENT IS THE ONLY SPELLING OF THE DEFAULT.** `normalizeFan` drops them both when they come
   * out equal to `0`/`count-1` (and when `count ≤ 1`, where the inequality cannot hold at all), so
   * `{rampFrom: 0, rampTo: 5}` never reaches the model. Not tidiness: `laneFingerprint` — the width
   * cache key — stringifies the whole slot, so the two spellings would mint two cache keys for one
   * piece of music.
   *
   * ⚠️ Readers still CLAMP rather than trust: `normalizeFan` runs from `ScoreModel.setFan` alone, and
   * `fromJSON` and the undo restore do not go near it — the same reason `members` has a fallback.
   */
  rampFrom?: number
  rampTo?: number
  /**
   * ⭐ **Does the beam SUBDIVIDE where this fan joins the group on its left?** Absent = yes, which is
   * what every fan says unless someone turned it off; `false` draws every level straight through the
   * boundary, as the join did before this existed.
   *
   * His report, with a screenshot of four 16ths beamed into a fan (`beam: 'continue'`): *"the fan is
   * not distinguishable from semicorcheas"*. Every level ran through, and at an accel.'s narrow end
   * the wedge's own lines still sit on the primary, so the eye met one thick band that thinned —
   * the fan began somewhere inside it, unmarked. Breaking the secondary levels there leaves the
   * primary carrying the group and a gap where the gesture starts, which is what a subdivision says
   * everywhere else in notation.
   *
   * ⚠️ **On the MARK and not on `Chord.secondaryBreak`**, which is the obvious home and cannot hold
   * the answer: `ScoreModel.updateNote` stores that flag as absent when false (*"the default costs
   * nothing in JSON"*), so under a default-ON rule "do not subdivide" reads back as "subdivide".
   * Making it storable would mint a second spelling of "no break" for every ordinary note in the
   * score, and `laneFingerprint` — the width cache key — stringifies the whole slot. Here the
   * inversion is free, because absence already means the default.
   *
   * ⚠️ Like {@link spread} and the ramp range, **absent is the only spelling of the default**:
   * `normalizeFan` drops a `true`. Only the refusal is ever written.
   *
   * ⛔ It says nothing about a fan standing ALONE — a subdivision breaks the second beam between two
   * groups, and a lone fan's beam lines are its ramp (how many it feathers out to is {@link beams}).
   */
  joinSubdivide?: boolean
  /**
   * ⭐ How far apart the beam lines sit at the WIDE end, as a MULTIPLE of the gap ordinary stacked
   * beams use (`beamWidth × 1.5`, VexFlow's own step). Absent = 1 = that gap exactly, which is what
   * every fan drawn before this says — and it is the FLOOR, since any less and the lines overlap. `2`
   * is twice the air, for a wedge that reads as a wedge across a room.
   *
   * ⚠️ **The one fan control that does NOT move the sound**, and the exception is deliberate. Count,
   * beams, direction and range are all read by `fanWeights` (utils/fannedBeam) because a reader hears
   * what they see; spread is not, because what a reader COUNTS is lines — 1 at the narrow end, `beams`
   * at the wide one — and that count is the same whether the lines touch or stand apart. It is an
   * engraving dial, like a note offset, not a claim about speed. Bar width does not move either: this
   * is entirely vertical.
   *
   * ⚠️ **Three readers must agree or it breaks silently**: the wedge itself, `fanStemExtension` (the
   * room the inward lines eat out of every stem — miss it and the innermost line runs through the
   * noteheads), and `fanJoinQuads` (the lines crossing to a joined neighbour). A PREFIX's own beams
   * are never spread: a 16th group joined to a fan is an ordinary beamed group, and spreading its
   * lines stops it being one.
   *
   * ⚠️ Absent is the only spelling of 1 — `normalizeFan` deletes it, for {@link rampFrom}'s reason.
   */
  spread?: number
  /**
   * Members 1…`count-1` — **member 0 IS the slot's own {@link Chord.notes}** and is deliberately not
   * repeated here. That is what makes "remove the fan and the note you typed is still there"
   * literally true rather than reconstructed.
   *
   * ⚠️ The invariant is therefore `members.length === count - 1`, and exactly ONE function is
   * allowed to get that off-by-one right: `normalizeFan` (utils/fannedBeam), called by
   * `ScoreModel.setFan`. Readers never repair it — a mark that has never been through `setFan` (an
   * older JSON file, a freshly built `{direction, count, beams}`) simply has no `members`, and a
   * reader falls back to the slot's own pitches.
   */
  members?: FanMemberChord[]
}

/**
 * ⭐⭐ **AN ATTACK — the thing a MARK attaches to.**
 *
 * A written slot is one attack. A FANNED slot is N of them: a fan is how you write six accelerating
 * notes with one note, and every one of the six is struck, so every one can be marked, flipped and
 * selected on its own.
 *
 * The type exists because that was being re-solved rather than named. Marks arrived on members one
 * at a time — articulations, then their side — and each one landed as a `found.member ? … : …` fork
 * whose two arms were the SAME code on two objects (`markOps.flipArticulationPlacement` had six
 * duplicated lines; `ScoreModel.updateNote` had its own copy). That fork is what a missing type
 * looks like: the slot is the RHYTHMIC unit, and everything that belongs to the rhythm — the bar's
 * arithmetic, rebar, the clipboard, undo, JSON, playback's clock — kept working on members for free
 * from the day they existed. Everything that cost was attack-level, and there was no attack.
 *
 * ⭐ So a mark feature adds a field HERE and both carriers get it. `attackOf` (engine/models/
 * slotLookup) resolves an id to the one that owns it — the member when the id is a member's, the
 * chord otherwise — and the operation is written once against this.
 *
 * ⚠️ Only what a mark needs. The rhythm (`duration`, `beat`, `dots`, `tupletId`) is deliberately NOT
 * here: a member has none of its own, its length comes from the ramp, and that is the property the
 * one-slot model exists to protect. A field that would tempt someone to give a member a duration
 * belongs on {@link Chord} alone.
 */
export interface Attack {
  /** The marks struck with this attack. Absent, never `[]` — see the note on the fan member's. */
  articulations?: ArticulationType[]
  /** Explicit side for them (above/below); absent = auto, stem-derived and voice-aware. */
  articulationPlacement?: 'above' | 'below'
}

/**
 * ⭐ **One member of a fan — a CHORD in its own right**, which is what this feature had already
 * concluded in prose (`docs/plans/fanned-beam-pitches-plan.md`: *"inside a fan the chord is the MEMBER,
 * not the slot"*) before the type said it. It was `NotePitch[]`, a bare array, and that shape could
 * only ever hold pitches.
 *
 * Real {@link NotePitch}es, with ids, because a member IS a note: a click has to select one, and
 * `getNote` / the arrows / `a`–`g` all address a pitch by id. Dense rather than sparse for the same
 * reason — half the heads carrying real ids and half synthetic ones would double every command that
 * resolves one (plan §1).
 */
export interface FanMemberChord extends Attack {
  /** The member's pitches — one for an ordinary member, several when the head is a chord. */
  pitches: NotePitch[]
  /**
   * ⭐ **This member's OWN articulations** (his ask, after using it — the same correction that made
   * slurs an exception to the "attaches to the SLOT" rule).
   *
   * The plan refused these on the reasoning that an articulation attaches to the whole gesture, and
   * the drawing followed: one staccato on a fan marked member 0 and playback shortened all six. But
   * a fan is how you write six ATTACKS, and an attack is exactly the thing an articulation belongs
   * to — so marking the sixth note alone has to be sayable, and it now is, through the ordinary
   * `toggleArticulation` on the member's own id.
   *
   * Member 0's marks stay where they always were, on {@link Chord.articulations}: member 0 IS the
   * slot's chord, so it needs no second home and the shape stays honest.
   *
   * ⚠️ Absent, not `[]`, when there are none — `laneFingerprint` stringifies the whole slot for the
   * width cache key, so two spellings of "no articulations" would mint two keys for one piece of
   * music. `markOps` deletes the field rather than leaving it empty.
   */
  articulations?: ArticulationType[]
  /**
   * ⭐ Which side THIS member's marks sit on, when it has been flipped away from the group's default
   * (`x`). Absent = follow the group, which is what {@link Chord.articulationPlacement} says for
   * member 0 and what the stem says for everyone.
   *
   * Its own field for the same reason the articulations are: *"every articulation of the member
   * should be selectable, deletable and flipped independently"*. Flipping the owner used to flip
   * all six, because there was one side for the whole gesture — and a fan is six attacks, not one.
   *
   * ⚠️ Absent is the only spelling of "follow the group", so a flip back to the default DELETES it
   * rather than pinning the value it happened to resolve to. That is what lets a member flipped and
   * flipped back go on following the voice-aware default when a second voice is added later — the
   * same rule, and the same reason, as the slot's own flip (`markOps.flipArticulationPlacement`).
   */
  articulationPlacement?: 'above' | 'below'
}

/**
 * ⭐ **One GRACE NOTE — or grace chord: an ATTACK with a written value and NO counted duration.**
 * `docs/plans/grace-notes-plan.md` §1 (D1, decided 2026-09-22).
 *
 * A sibling of {@link FanMemberChord}, not a reuse of it. Both are attacks that are not slots — real
 * pitch ids, so a click selects one and the arrows re-pitch it through `attackOf` — and they differ
 * in the one thing the fan model exists to forbid its members: a fan member has NO written value
 * (its length is the ramp's), a grace HAS one and no sounding one.
 *
 * ⚠️ What it does NOT have — `beat`, `voice`, `staffId`, `tupletId`, `beam` — it inherits from its
 * main chord. Nothing rhythmic ever counts it: not the bar, not rebar, not the columns.
 */
export interface GraceNote extends Attack {
  /** Real NotePitches with ids — one for a grace note, several for a grace chord. */
  pitches: NotePitch[]
  /** What it is DRAWN as. ⛔ Never counted. */
  duration: NoteDuration
  /** Absent, never 0 — `laneFingerprint` stringifies the slot for the width-cache key. */
  dots?: number
  /**
   * ⭐ **Drawn at CUE size** — a cue grace, whose size is its own preset (C4) (docs/plans/cue-size-plan.md C1, C2). **ABSENT = full
   * size**, the only spelling of it (the width-cache key stringifies the slot), so switching it off DELETES
   * the field. Write it through `engine/models/cueOps`. The SIZE is not here: it is a house-style preset
   * (`layout/cueSize`). ⛔ It moves nothing but the drawing — the note is counted and PLAYED (C3).
   */
  cue?: true
  /**
   * ⭐ Its authored BEAM statement within its group — the beam keys' four, as a note's (his report,
   * 2026-09-23: *"the grace group is not responding to the beaming of the beam palette"*). Absent = auto:
   * consecutive flagged graces share a beam (`engrave/notes/graceBeam.graceBeamRuns`). `single` never beams,
   * `begin` starts a beam here, `end` closes it here, `continue` joins the grace before it — even across a
   * bracketed grace, which otherwise splits the beam (B4).
   */
  beam?: Exclude<BeamMode, 'auto'>
  /** ⭐ The BRACKETED graces bent into THIS grace — the pre-bend into the first appoggiatura
   *  (`docs/plans/bracketed-grace-plan.md` B2). BEFORE only on a grace (B5). ⚠️ Inside a group, a grace
   *  carrying one starts a new beam run: the split is DRAWN, not stored (B4). Absent, never `[]`. */
  bracketedBefore?: BracketedGrace[]
}

/**
 * ⭐ **A BRACKETED GRACE — a pitch shown as INFORMATION, not an attack**: a black head in round
 * brackets, no stem, no flag (`docs/plans/bracketed-grace-plan.md` B1). Sibelius's "pre-bend note", and
 * the same form a trill uses to say which note to trill to — the reader of the context decides.
 *
 * ⛔ NOT a {@link GraceNote} and never a member of a {@link GraceGroup} (Gould p. 139: *"Do not use a
 * grace note for the trilling pitch"*). It belongs to its TARGET (B2) — a main {@link Chord}
 * (`bracketedBefore` / `bracketedAfter`) or a grace (`GraceNote.bracketedBefore`) — as a LIST, left to
 * right, the array being the only order stored (B3).
 *
 * ⭐ It HAS a written value — what its HEAD is drawn as: a half's hollow head is not a quarter's black
 * one (B7 REVISED, his call 2026-09-23: *"it should have case a half notehead is different than a quater
 * notehead (in this sense the grace do it write)"*). ⛔ Never counted, as a grace's is not.
 * ⚠️ What it does NOT have, on purpose: a stem, a beam, a dot, and a sound (B6). Nothing rhythmic ever
 * counts it.
 */
export interface BracketedGrace {
  /** Real NotePitches with ids — one head, or several (a double-stop pre-bend): one bracket pair each. */
  pitches: NotePitch[]
  /** What its HEAD is drawn as (B7). ⛔ Never counted. */
  duration: NoteDuration
  /** ⭐ Drawn at CUE size — the cue GRACE's size (cue-size-plan C4). Absent = its ordinary size; see {@link Chord.cue}. */
  cue?: true
}

/** Which side of its main chord a grace group stands on (D2: an AFTER group is stored on the note it
 *  FOLLOWS — Stone p. 140, *"grace notes belong to a main note"*). */
export type GraceSide = 'before' | 'after'

/**
 * ⭐ **The graces on ONE side of ONE main chord** — Dorico's *"mini-score at a rhythmic position"*.
 * The array IS the order, left to right (⛔ no index field: MuseScore's is admitted *"not well-
 * maintained"*). A group with no notes is DELETED, never stored as `{ notes: [] }`.
 *
 * ⚠️ Absent is the only spelling of every default, for the width-cache key's reason.
 */
export interface GraceGroup {
  notes: GraceNote[]
  /** Acciaccatura — ONE flag for the group (Gould p. 126). Absent = appoggiatura. */
  slash?: true
  /** Absent = UP, whatever the pitches (all four books, all three engines — research §0.4). */
  stemDirection?: 'up' | 'down'
  // ⛔ No slur flag: a grace draws NO slur of its own — a slur is the user's, a real one (his call,
  // 2026-09-22, reversing D3; docs/plans/grace-notes-plan.md).
}

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
 * A SECONDARY BEAM BREAK on a note: the note starts a new group at the 16th level and below,
 * while the primary (8th) beam runs straight through it.
 *
 * Six sixteenths beamed as one group, subdivided 3+3:
 * ```
 *   ┌─────────────────┐        one primary beam over all six
 *   ├─────┐   ┌───────┤        the secondary breaks in the middle
 * ```
 * A separate field from {@link BeamMode}, not a sixth member of it, because it is a separate
 * statement: it says nothing about WHICH notes are beamed (that is the mode's job, and the note
 * above is `auto`) — only about how many beam LINES join them. The two are set independently, and
 * MusicXML keeps them apart the same way: `<beam number="1">` carries the mode, `<beam number="2">`
 * the subdivision.
 *
 * It sits on the note that STARTS the new group (the break is in front of it), which is the reading
 * `begin` already has, and the note MusicXML puts its `<beam number="2">begin</beam>` on.
 */

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
  /** The head's brackets (`NotePitch.enclosure`); absent = none. */
  enclosure?: HeadEnclosure
  /** Drawn at cue size — its SLOT's (or grace's) `cue`; absent = full size. */
  cue?: true
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
  /**
   * When true, articulations that land on the STEM side align to the stem
   * (modern convention) instead of the notehead (traditional default). No
   * effect on notehead-side marks, which are notehead-centered either way.
   * Omitted/false = the traditional notehead alignment. Per-note (Properties).
   */
  articulationStemAlign?: boolean
  /** Explicit beaming override */
  beam?: BeamMode
  /** Secondary beams break in front of this note; the primary beam runs through. */
  secondaryBreak?: boolean
  /**
   * ⭐ **Which way this note's FRACTIONAL BEAM points** — the short stub of secondary beam that
   * belongs to one note only (Gould pp. 157–158; `docs/research/beam-hook-research.md`).
   *
   * **Omitted = AUTO**, and auto is the four treatises' rule: the beam points at the beat, or
   * division of the beat, that the note belongs to (`engine/engrave/beams/fractionalBeam`). Set only
   * when the user overrides that by hand, from Properties.
   *
   * ⚠️ It is a decision about ONE note's stub and ⛔ not about the group's beaming — {@link BeamMode}
   * is the field that says where a beam starts and stops.
   */
  fractionalBeamSide?: FractionalBeamSide

  /** REST only: beam over this rest instead of breaking at it. See {@link Rest.beamOver}. */
  beamOver?: boolean
  /** Single-note tremolo on this note's slot. See {@link Chord.tremolo}. */
  tremolo?: TremoloMark
  /**
   * Two-note tremolo on this note's slot. See {@link Chord.tremoloPair}.
   *
   * ⚠️ The raw FLAG, not the validated relation — a pair can go stale, and only `pairIsValid`
   * (utils/tremoloPair) reading the whole lane can say whether it is still a notation. Enough to
   * toggle the mark off; not enough to decide it is drawn.
   */
  tremoloPair?: true
  /** How a two-note tremolo's strokes meet the stems. See {@link Chord.tremoloPairStyle}. */
  tremoloPairStyle?: 'joined' | 'open'
  /** Fanned (feathered) beam on this note's slot. See {@link Chord.fan}. */
  fan?: FanMark
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
   * lookups stay global and are unaffected. See docs/plans/multi-staff-plan.md §4.
   */
  staff?: number
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
   * stems as drawn / its place in a chord / the clef's middle line — see
   * `engine/rendering/curves/tieDirection.ts`).
   * Set by flipping a selected tie with `x`. Unlike a slur a tie stays flat and
   * anchored to the noteheads, so flipping only inverts the arc direction.
   */
  tieDirection?: -1 | 1
  /**
   * ⭐⭐ **THE STAFF THIS HEAD IS WRITTEN ON, when that is not its chord's own** — cross-staff
   * notation (docs/plans/cross-staff-plan.md). A {@link StaffInfo} id; **ABSENT = the chord's own
   * staff**, which is every head that has not crossed.
   *
   * ⭐ It is per HEAD, not per chord, because the chord it was built for is split: Satie's
   * *Gymnopédie No. 1* keeps B2 on the bass staff and writes D4 + F♯4 on the treble, on one stem
   * (Gould p. 305). MusicXML's `<staff>` and MEI's `@staff` are per note for the same reason.
   *
   * ⛔ **It moves NOTHING but where the head is written.** The chord's {@link Chord.staffId} and
   * `voice` still own rhythm, rest fill, rebar, paste and playback. It is CONTENT, not an engraving
   * override: it decides the clef the head is read in, and it holds no pixels.
   *
   * 🚨 **A REAL id, always — ⛔ NOT the slot convention.** On a slot an absent `staffId` means the
   * FIRST staff; here absent means HOME, so a bass-staff head written on the first staff carries
   * the first staff's real id. Write it only through `engine/models/crossStaffOps`, which also
   * guarantees it never names the home staff (that is spelled by deleting the field).
   */
  displayStaffId?: string
  /**
   * ⭐ **The BRACKETS this head is drawn in** — a parenthesised note (docs/plans/parenthesised-note-plan.md).
   * **ABSENT = none**, the only spelling of it (the width-cache key stringifies the slot), so taking the
   * brackets off DELETES the field. Write it through `engine/models/enclosureOps`.
   *
   * ⭐ A SHAPE, ⛔ not a boolean (N2): `'square'` is the next member, and `true` could not have grown
   * into it. Per HEAD (N1), so a chord's heads, a grace's and a fan member's all carry their own.
   *
   * ⛔ **It moves nothing but the drawing**: the note is counted, played (N6) and read by the
   * running-accidental rule (N7) exactly as without it. ⛔ Never on a BRACKETED grace's pitch — that is
   * already in brackets, and the op refuses it.
   */
  enclosure?: HeadEnclosure
}

/**
 * The brackets a head can be drawn in (docs/plans/parenthesised-note-plan.md N2). One member today;
 * a new shape is a new member plus one row in the drawing's table.
 */
export type HeadEnclosure = 'round'

/**
 * ONE PITCH ON ITS WAY INTO A MEASURE — the payload `ScoreModel.insertPitch` takes.
 *
 * A `NotePitch` (what is stored on the chord) plus the SLOT statements the pitch arrives carrying:
 * where it lands (`beat`, `voice`), how long it is, and the marks that belong to the whole event
 * rather than to the head — beam, tremolo, fan, articulations. The insert merges it into a chord
 * already at that beat in that voice, or makes a new slot from these fields.
 *
 * Named because it crosses a module boundary: `voiceOps` builds one when a note changes voice and
 * hands it back to the model to insert (docs/history/modularity-plan-2026-07-28.md Phase 3). It is model
 * vocabulary, not a public API shape — nothing outside `engine/models` builds one.
 */
export interface PitchInsert {
  id: string
  step: PitchStep
  alter: PitchAlter
  octave: number
  forceAccidental?: boolean
  tiedTo?: string
  tiedFrom?: string
  tieDirection?: -1 | 1
  /** {@link NotePitch.displayStaffId}, travelling with the head it belongs to. */
  displayStaffId?: string
  /** `NotePitch.enclosure`, verbatim — the head's brackets travel with it. */
  enclosure?: HeadEnclosure
  duration: NoteDuration
  dots?: number
  beat: Fraction
  voice: number
  /**
   * The staff lane the pitch lands in — **absent = the first staff**, the same rule every
   * `staffId` follows. A voice move is a move along the VOICE axis only, so the note's own
   * staff has to travel with it; leaving it out silently dropped a staff-1 note onto staff 0.
   */
  staffId?: string
  articulations?: Chord['articulations']
  articulationStemAlign?: boolean
  beam?: BeamMode
  secondaryBreak?: boolean
  fractionalBeamSide?: FractionalBeamSide
  tremolo?: TremoloMark
  tremoloPair?: true
  tremoloPairStyle?: 'joined' | 'open'
  fan?: FanMark
  /** The chord's GRACES — carried only when the pitch takes the WHOLE slot with it (`voiceOps`):
   *  one head leaving a chord leaves the graces on the chord they were played into. */
  graceBefore?: GraceGroup
  graceAfter?: GraceGroup
  /** The chord's BRACKETED graces — carried on the graces' terms (the whole slot, `voiceOps`). */
  bracketedBefore?: BracketedGrace[]
  bracketedAfter?: BracketedGrace[]
  /** `Chord.cue` — the slot's size travels with it, as its articulations do. */
  cue?: true
}

/**
 * ⭐ Which side of its stem a note's FRACTIONAL BEAM lies — the stub of secondary beam belonging to
 * one note. ⛔ Absent means AUTO (the metric rule), never a default side.
 */
export type FractionalBeamSide = 'left' | 'right'

/** A rhythmic slot containing one or more pitches */
export interface Chord extends Attack {
  id: string
  type: 'chord'
  beat: Fraction
  duration: NoteDuration
  dots?: number
  measure: number
  voice?: 0 | 1 | 2 | 3
  stemDirection?: StemDirection
  beam?: BeamMode
  /** Secondary beams break in front of this slot — see the type note on {@link BeamMode}. */
  secondaryBreak?: boolean
  /**
   * ⭐ **Which way this note's FRACTIONAL BEAM points** — the short stub of secondary beam that
   * belongs to one note only (Gould pp. 157–158; `docs/research/beam-hook-research.md`).
   *
   * **Omitted = AUTO**, and auto is the four treatises' rule: the beam points at the beat, or
   * division of the beat, that the note belongs to (`engine/engrave/beams/fractionalBeam`). Set only
   * when the user overrides that by hand, from Properties.
   *
   * ⚠️ It is a decision about ONE note's stub and ⛔ not about the group's beaming — {@link BeamMode}
   * is the field that says where a beam starts and stops.
   */
  fractionalBeamSide?: FractionalBeamSide
  /**
   * ⭐ **One pair of brackets round the WHOLE chord**, not one per head (docs/plans/parenthesised-note-plan.md
   * N3/P5 — his call: both drawable, a Properties switch, default per head). **Absent = per head**, the only
   * spelling of the default.
   *
   * ⭐ His rule (2026-09-23): it is IN FORCE only when EVERY head of the chord wears brackets — a head is
   * selected and bracketed on its own, so one bracketed head says nothing about the chord. Otherwise the
   * heads keep their own pairs, and the switch waits (it is not erased: bracket the last head and the
   * chord's pair returns). Read it through `engine/models/enclosureOps.chordEnclosureSpan`, ⛔ never raw.
   */
  enclosureSpan?: 'chord'
  /**
   * ⭐ **Drawn at CUE size** — a real note, small (docs/plans/cue-size-plan.md C1, C2). **ABSENT = full
   * size**, the only spelling of it (the width-cache key stringifies the slot), so switching it off DELETES
   * the field. Write it through `engine/models/cueOps`. The SIZE is not here: it is a house-style preset
   * (`layout/cueSize`). ⛔ It moves nothing but the drawing — the note is counted and PLAYED (C3).
   */
  cue?: true
  tupletId?: string
  actualDuration?: Fraction
  /** Stem-side articulations align to the stem (modern) not the notehead (default). */
  articulationStemAlign?: boolean
  /**
   * Single-note tremolo: one to five stem strokes, or the Penderecki sign. See
   * {@link TremoloMark} for why the number is notation and not a performance instruction.
   *
   * On the SLOT, not the pitch, for the reason {@link articulations} is: a tremolo is a property
   * of the *event*. A chord tremolos as a chord — "tremolo one notehead of a chord" has no
   * representation. Rests refuse it outright (you cannot tremolo silence), the same way
   * {@link Chord.beam} has no counterpart on {@link Rest}.
   *
   * Inside a slot, so it needs no `MEASURE_RENDER_ROLE` entry: `laneFingerprint` stringifies
   * `lane.slots` whole and `measureShapeKey` reuses that string, so redraw is correct for free.
   * That is *conservative* rather than exact — the mark costs no horizontal space, yet riding in
   * `slots` puts it in the WIDTH key too — which is the safe direction. See docs/plans/tremolo-plan.md §1.
   */
  tremolo?: TremoloMark
  /**
   * TWO-NOTE tremolo: this slot's tremolo alternates with the **NEXT** slot in its lane, and both
   * noteheads are drawn at DOUBLE their written value. The stroke count stays in {@link tremolo};
   * this field only says "the strokes go between two notes instead of on one stem".
   *
   * ⚠️ ONE field, on the FIRST slot — the second carries nothing. "Mark just the first note" is
   * true in the data too, and the renderer looks ahead: one less thing to keep in step, and
   * deleting the second note cannot leave a dangling half-mark (the pair simply stops being one).
   *
   * ⚠️ It is a **RELATION**, not a property, which is what makes it different from every other slot
   * field: every pipeline that reorders slots can break it after the fact (delete the partner,
   * insert between, change a duration, a meter change, a paste that re-bars them apart). So the flag
   * alone is NOT the notation — {@link pairIsValid} (utils/tremoloPair) is asked by the button, the
   * renderer, the beam grouper and playback alike, and a broken pair is DROPPED by the relay rather
   * than carried. See docs/plans/two-note-tremolo-plan.md §1.
   *
   * ⚠️ Durations are NOT rewritten: the model keeps two half notes, only the *drawing* doubles them.
   * That is the whole reason the feature is cheap — rebar, rest-fill, meter changes, clipboard,
   * JSON, collision and undo never see a note claiming a length it does not have.
   */
  tremoloPair?: true
  /**
   * How a two-note tremolo's strokes MEET the stems — only read when {@link tremoloPair} is set.
   * `'open'` (the default, and what absent means) floats them clear of both stems; `'joined'` runs
   * them stem tip to stem tip, like a beam.
   *
   * ⭐ A SETTING, not a house rule we pick. Both readings are in use — the engraved half-note example
   * and LilyPond join them, plenty of editions float them — so Dorico ships exactly this choice
   * (Engrave ▸ Engraving Options ▸ Tremolos, "multi-note half note tremolos") and MuseScore the same
   * styles in Properties.
   *
   * ⚠️ **Offered on the drawn BLANCA and nowhere else** — the same restriction MuseScore states, and
   * the restriction is the point rather than an omission. On a drawn NEGRA, strokes touching two
   * FILLED stems read as two beamed corcheas — a different rhythm. On a corchea or shorter the
   * joining line is a real beam and not ours to style. A redonda has no stems to join. So the field
   * is read in one case and ignored in the rest (`pairAcceptsJoined`).
   *
   * ⏭️ Per mark now, project-wide later: the field rides the slot, so the toggle acts on the selected
   * tremolo. A global default has no home yet and inventing one would collide with the positional
   * rule (docs/DESIGN-PRINCIPLES) unless it lands in a real engraving-options compartment beside
   * {@link Score.engravingOverrides}. When that exists, this becomes the per-mark override — which is
   * Dorico's shape too. See docs/plans/two-note-tremolo-plan.md §2.
   */
  tremoloPairStyle?: 'joined' | 'open'
  /**
   * Fanned (feathered) beam: play this ONE event as {@link FanMark.count} notes that speed up or
   * slow down across exactly its own duration. See {@link FanMark}.
   *
   * ⚠️ Like {@link tremoloPair}, the durations are NOT rewritten — `duration` stays `'h'` and the
   * slot stays one event, so rebar, rest-fill, meter changes, clipboard, JSON, collision and undo
   * see ONE slot however many notes are drawn. Only the drawing and the playback expand it, and
   * removing the field IS "go back to the note I typed".
   *
   * ⚠️ What the slot IS is `duration` + `dots`; what it LASTS is `slotLength` — and since a passage
   * can be collapsed into a fan (`engine/models/fanCollapse.ts`), those two can differ here: seven
   * sixteenths span a length no notehead spells, so the span rides {@link FanMark.length} and the
   * written value is a carrier. Every reader of a fan already asks `slotLength`; a new one must not
   * reach for `duration` and call it the answer.
   *
   * ⚠️ Unlike `tremoloPair` it is a PROPERTY, not a relation — nothing about a neighbouring slot can
   * invalidate it — so it rides `RebarEvent` and survives a meter change or a paste. The one place
   * that is not enough: a tie-split keeps it on the FIRST piece only (`relayEvents`), because a fan
   * cut in half at a barline is a cross-barline fan nobody asked for.
   *
   * ⚠️ It is the third expansion of one slot into many attacks, and the three cannot be combined —
   * {@link tremolo} and {@link tremoloPair} are cleared when a fan is set, and vice versa
   * (`ScoreModel.setFan`). Rests and tuplet members refuse it outright.
   */
  fan?: FanMark
  /**
   * Staff this chord belongs to (a {@link StaffInfo} id). Absent = staff 0 (the first
   * staff), mirroring absent {@link Note.voice} = voice 0. Orthogonal to voice: a slot's
   * vertical identity is the pair `(staffId, voice)`. See docs/plans/multi-staff-plan.md §4.
   */
  staffId?: string
  /**
   * ⭐ The GRACE NOTES played into this chord (D1: a CHILD of the chord, ⛔ never a slot — so rebar,
   * rest fill, capacity, collision, the columns, undo and JSON never see them, exactly as a fan's
   * members). See {@link GraceGroup}; the operations are `engine/models/graceOps`.
   *
   * ⭐ A {@link Rest} carries one too (D7 REVERSED, his call 2026-09-22: *"attach the grace to the rest
   * and when the rest is changed for a note reattach the grace"*) — see `Rest.graceBefore`.
   */
  graceBefore?: GraceGroup
  /** The graces AFTER this chord — a Nachschlag, stored on the note it FOLLOWS (D2). See {@link graceBefore}. */
  graceAfter?: GraceGroup
  /** ⭐ The BRACKETED graces standing BEFORE this chord, nearest it (the pre-bend) — see
   *  {@link BracketedGrace}. The operations are `engine/models/bracketedGraceOps`. Absent, never `[]`. */
  bracketedBefore?: BracketedGrace[]
  /** …and AFTER it (the trill note, a bend's target — every book's case, §0.9 of the research). */
  bracketedAfter?: BracketedGrace[]
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
   * to voice, exactly like {@link Chord.staffId}. See docs/plans/multi-staff-plan.md §4.
   */
  staffId?: string
  /**
   * True for the single rest that fills an entire empty bar (a measure rest).
   * Rendered as a centred whole rest regardless of bar length (Phase 3); the
   * stored `duration` is `'w'` and `actualDuration` carries the true bar length.
   */
  isMeasureRest?: boolean
  /**
   * Beam OVER this rest instead of breaking the beam at it — the "beamed rest" convention:
   * `𝅘𝅥𝅮 𝄾 𝅘𝅥𝅮 𝅘𝅥𝅮` in one beat gets a single beam with the rest floating under it. Absent = the default,
   * a rest breaks the beam. It only shows when the rest is INTERIOR to a group its neighbours form;
   * a leading or trailing beamed rest is trimmed, because a beam never hangs off a rest. See
   * docs/how-it-works/beaming.md.
   *
   * A structural beaming statement, so it lives on the slot beside {@link Chord.beam} /
   * `secondaryBreak`, not in the visual-override compartment rest hide/shift use. ⚠️ It is therefore
   * tied to this rest object: a structural edit that regenerates the rest (rebar, paste) drops it —
   * which is also when the beaming context it describes has changed.
   */
  beamOver?: boolean
  /** ⭐ Drawn at CUE size (cue-size-plan C1) — see {@link Chord.cue}. Absent = full size. */
  cue?: true
  /**
   * ⭐ GRACE NOTES written before this silence — D7 REVERSED (his call, 2026-09-22): the user enters
   * the grace FIRST, on an empty bar, and the note after. When a note takes this rest's place at the
   * same beat, the group MOVES onto it (`engine/models/restGraceOps`). BEFORE only: a grace after a
   * rest is not a notation. ⚠️ No book on disk draws one (research §0.7): its picture is a default.
   */
  graceBefore?: GraceGroup
  /**
   * ⭐ BRACKETED graces written before this silence — B10 REVERSED (his report, 2026-09-23: *"this
   * should work similar to grace stamp on empty measure"*): entered first, on an empty bar, and handed
   * to the note that takes the rest's place, as {@link graceBefore} is (`engine/models/restGraceOps`).
   * BEFORE only, the grace's reason.
   */
  bracketedBefore?: BracketedGrace[]
}

export type ChordRest = Chord | Rest

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
  /** The BRACKETS the new head is entered in — note entry armed with them (parenthesised-note-plan
   *  P4b). A property of the HEAD (`NotePitch.enclosure`), unlike the slot marks below. */
  enclosure?: HeadEnclosure
  isRest?: boolean
  dots?: number
  tupletId?: string
  actualDuration?: Fraction
  articulations?: ArticulationType[]
  /**
   * The tremolo the new note is entered WITH — note entry armed with a mark, the way it is armed
   * with an accidental or a dot (docs/plans/tremolo-plan.md §10). A property of the SLOT, so entering a
   * pitch into an existing chord marks the whole chord.
   *
   * Rests ignore it: you cannot tremolo silence.
   */
  tremolo?: TremoloMark
  /** Explicit side for articulations (above/below); omitted = auto (stem-derived). */
  articulationPlacement?: 'above' | 'below'
  /** Stem-side articulations align to the stem (modern) not the notehead (default). */
  articulationStemAlign?: boolean
  tiedTo?: string
  tiedFrom?: string
  stemDirection?: StemDirection
  beam?: BeamMode
  /** Secondary beams break in front of this note. See the type note on {@link BeamMode}. */
  secondaryBreak?: boolean
  /** ⭐ Override the fractional beam's side; omitted = auto. See {@link Chord.fractionalBeamSide}. */
  fractionalBeamSide?: FractionalBeamSide
  /** REST only: beam over this rest instead of breaking at it. See {@link Rest.beamOver}. */
  beamOver?: boolean
  /** Voice index (0–3). Defaults to 0. See {@link Note.voice}. */
  voice?: 0 | 1 | 2 | 3
  /** 0-based staff index in {@link Score.staves}. Defaults to 0. See {@link Note.staff}. */
  staff?: number
}
