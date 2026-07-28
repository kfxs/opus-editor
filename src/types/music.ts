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
 * What a tuplet IS, with no `id` and no position: **N notes of one value in the time of M notes of
 * another**. Two sides, each a count and a note value — MusicXML's `<tuplet-actual>` /
 * `<tuplet-normal>`, and Finale's two dropdowns.
 *
 * It is split out from {@link Tuplet} because this — and NOT the id or the beat — is what gets ARMED
 * (`EditorState.armedTuplet`), what a creation call needs, and what every span calculation reads.
 * See docs/tuplet-extension-plan.md.
 *
 * ⚠️ N:M is TWO INTEGERS, never a `Fraction`: `fracCreate` reduces by gcd, and 6:4 → 3:2 turns a
 * sextuplet into a triplet. The scaling factor `span ÷ (N × unit)` is a Fraction; the identity is not.
 */
export interface TupletShape {
  /** N — how many notes are squeezed in (3 for a triplet). */
  numNotes: number
  /** M — how many they replace (2 for a triplet). ALWAYS a count of {@link baseDuration}, because
   *  that is what the ratio means: both numbers count the same note. What the user typed on the
   *  other side is remembered separately, in {@link normalCount}. */
  notesOccupied: number
  /** The ACTUAL side's note value: what the tuplet's notes are WRITTEN as ('q' for a triplet of
   *  quarters). Also the yardstick the mark's ratio is quoted in. */
  baseDuration: NoteDuration
  /**
   * Dots on that value — a triplet of DOTTED quarters. Absent = 0, which keeps every existing score
   * byte-identical.
   *
   * The unit is a note VALUE, and a note value can be dotted; Finale's two dropdowns list "Dotted
   * Quarter(s)" beside "Quarter(s)", and MusicXML carries `<tuplet-dot>` for the same reason. Without
   * it the dot has nowhere to go and cannot be worked around — `numNotes` counts NOTES, so respelling
   * the group in undotted units would change the ratio into a different tuplet.
   *
   * ⚠️ It must reach every span calculation. That is why they take this whole object
   * ({@link ../utils/musicUtils.tupletSpan}) rather than loose arguments: a function handed the
   * tuplet cannot be handed half of it, and a dropped dot computes a span a third short, silently.
   */
  baseDots?: number
  /**
   * The NORMAL side's own note value — "5 sixteenths in the time of 1 QUARTER".
   *
   * **Absent = the same value as the actual side**, which is what the model meant before this field
   * existed, so every older tuplet reads back identically and nothing migrates. Written only when
   * the user actually said something different.
   *
   * It exists because the ratio alone throws away the question and keeps only the answer: a stored
   * `5:4` cannot say "in the time of *what*", and a mark that prints a note value beside its ratio
   * (Sibelius's *Ratio + note*, Finale's `Xq:Yq`) needs it.
   *
   * ⛔ Not arithmetic — see {@link normalCount}.
   */
  normalDuration?: NoteDuration
  /** Dots on the normal side's value ("in the time of one DOTTED quarter"). Meaningless without
   *  {@link normalDuration}, and ignored when it is absent — the actual side's dots apply then. */
  normalDots?: number
  /**
   * The COUNT the user typed on the normal side — the "4" in "3 dotted quarters in the time of 4
   * eighths".
   *
   * `notesOccupied` is that count CONVERTED into the actual side's value, because that is what the
   * ratio means (both numbers count the same note). The conversion is not reversible: 4 eighths and
   * 2 quarters land on the same `notesOccupied`, and a mark that wants to say which one the user
   * meant has no way to ask.
   *
   * So this is the last of the six values that make up the typed sentence — N, its value, its dots,
   * M, its value, its dots — and with it the entry can be reconstructed exactly. Absent = both sides
   * are the same note value, where `notesOccupied` already IS the typed count.
   *
   * ⛔ Not arithmetic. Nothing computes from it; {@link ../utils/musicUtils.tupletSpan} and friends
   * read the actual side only.
   */
  normalCount?: number
}

/**
 * Tuplet definition (e.g., triplet = 3 notes in the time of 2) — a {@link TupletShape} placed in a
 * bar, with an identity and the engraving overrides that ride on it.
 */
export interface Tuplet extends TupletShape, TupletFormat {
  /** Unique identifier for the tuplet */
  id: string
  /** Beat position where the tuplet starts (exact rational) */
  startBeat: Fraction
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
 * The Tuplet window's left column — what the mark says. `undefined` on a {@link Tuplet} = auto.
 *
 * `ratio` quotes both figures in the tuplet's OWN written unit, which is what a bare `5:4` means.
 * `entryRatio` quotes them as the user TYPED them, with each side's note value beside it —
 * `5𝅘𝅥𝅯:1♩` for "five sixteenths in the time of one quarter". The two differ exactly when the sentence
 * used two note values, and that is the case where a bare ratio makes the reader reconstruct the
 * second side. It is printable only because the entry is kept ({@link TupletShape.normalCount} and
 * friends) instead of being folded into the ratio.
 */
export type TupletNumberStyle = 'number' | 'ratio' | 'ratioNote' | 'entryRatio' | 'none'

/**
 * One piece of a printed tuplet mark: a run of text, and whether it is a note GLYPH.
 *
 * A mark is a list of runs rather than a string because its parts are drawn at different sizes — the
 * tuplet figures are cut small inside their em, a `metNote…` fills its own, and one font size for
 * both puts a note twice the height of the numbers. With two note values interleaved
 * (`5𝅘𝅥𝅯:1♩`) the sizes alternate, so a "text plus a trailing glyph" pair cannot describe it.
 */
export interface TupletMarkRun {
  text: string
  /** Drawn in the music font at the smaller note-glyph size. Absent = the figures' size. */
  glyph?: boolean
  /**
   * Leave air BEFORE this run. A gap the renderer measures, not a space character: a music font's
   * space is next to nothing wide, so spelling it would put the runs back to back.
   */
  space?: boolean
}

/** Whether the group gets a bracket. `auto` (and absent) = the renderer's rule — no bracket when a
 *  beam already shows the grouping, one when it does not. */
export type TupletBracket = 'auto' | 'always' | 'never'

/**
 * Where the bracket STOPS — Dorico's three, in its Engraving Options ▸ Tuplets ▸ Horizontal Position,
 * because the real question is three-way and not the tickbox Sibelius offers ("full duration").
 *
 * `lastNote` ends at the right-hand edge of the final notehead — Sibelius's and Finale's untouched
 * behaviour. `division` ends where the group's TIME ends, so the bracket covers a final rest or the
 * full length of a final long note. `beforeNext` ends just short of whatever follows.
 *
 * Absent = the renderer's rule, which is `lastNote` — the long bracket is opt-in, per
 * {@link ../utils/musicUtils.DEFAULT_TUPLET_BRACKET_END}.
 */
export type TupletBracketEnd = 'lastNote' | 'division' | 'beforeNext'

/**
 * The Tuplet dialog's *Format* box: everything about how the group is DRAWN, and nothing about what
 * it plays. A tuplet with no format at all engraves by the renderer's own rules — every field is
 * absent-means-auto, so an ordinary triplet stores nothing and serializes exactly as it always did.
 *
 * One named group, rather than three loose fields, because these travel TOGETHER: the window sets
 * them before the notes exist, they ride on the armed tuplet, and they are written when the group is
 * created. A trio of positional arguments through five call layers is how one of them goes missing.
 *
 * ⚠️ They are HOW IT LOOKS. Nothing here may ever be read by `tupletSpan`, `tupletScale` or anything
 * that computes time — a format that changed the rhythm would be a format that is not a format.
 */
export interface TupletFormat {
  /**
   * What the mark PRINTS: the number alone (`3`), the ratio (`3:2`), the ratio with the note value
   * beside it (`3:2♪`), or nothing. Absent = auto — the rule in
   * {@link ../utils/musicUtils.autoNumberStyle}: the ratio when N is a power of two greater than 2
   * (`4`, `8` — the numbers a reader cannot complete), the bare number otherwise.
   *
   * ⛔ The printed STRING is deliberately not stored. Tempo marks and dynamics are text-as-truth
   * because their text carries meaning nothing else holds; a tuplet is the opposite — the numbers
   * ARE the rhythm, so a stored `"5:4"` would go on saying 5:4 after the tuplet changed and the mark
   * would be lying about the notes under it. Style in, string derived.
   */
  numberStyle?: TupletNumberStyle
  /** Whether the group is bracketed. See {@link TupletBracket}. */
  bracket?: TupletBracket
  /** Where that bracket stops. See {@link TupletBracketEnd}. Meaningless without a bracket, and the
   *  dialog greys it out then — but it is kept, so turning the bracket back on restores the choice. */
  bracketEnd?: TupletBracketEnd
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
 * A single-note tremolo — the strokes that ride a note's stem and say "repeat this note, this
 * finely". One to five strokes, or the Penderecki sign (SMuFL `pendereckiTremolo`, E22B).
 *
 * ⚠️ The number is **how the mark is written, not how it is performed**. The measured /
 * unmeasured split is NOT `typeof === 'number'`: four and five strokes are numbers and are
 * never measured, and even three usually is not. The reading is *derived* from the stroke count
 * plus the note's own flags at playback time (docs/tremolo-plan.md §5) — nothing is stored for
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
 * docs/fanned-beams-plan.md §0.
 *
 * ⭐ **The RHYTHM is a projection; the PITCHES are not.** {@link members} is the one thing inside a
 * fan that is stored, because a pitch cannot be derived from anything — see
 * docs/fanned-beam-pitches-plan.md §0-§1. It does not make the group divisible: this is still ONE
 * slot, of one written duration, and no pipeline that walks slots sees anything new.
 *
 * ⚠️ Every number here is PROVISIONAL — see docs/fanned-beams-plan.md §1. They are not considered
 * engraving or performance decisions, and tuning them is ongoing hand work.
 */
export interface FanMark {
  direction: 'accel' | 'rit'
  /** How many notes the group is played and drawn as. */
  count: number
  /** Beam lines at the WIDE end. The narrow end is always 1 (Dorico's model, and its limit). */
  beams: number
  /**
   * ⭐ Which member the feathering STARTS on and which it ENDS on — 0-based member indices,
   * **inclusive**, and `rampFrom` is always the LEFT one (`0 ≤ rampFrom < rampTo ≤ count-1`). Absent
   * on both means the whole group, which is what every fan drawn before this existed says.
   *
   * ⭐ **Named for the RAMP, not for the beam lines, because they govern both.** A note outside the
   * mark sounds at the steady base speed and carries ONE beam, so the sounding weights, the head
   * spacing and the drawn levels are one fact with three readers — `fanWeights` (utils/fannedBeam) is
   * the reader, and the only place these two numbers are interpreted. Picture and playback are the
   * same function here, as they have been since day one (docs/fan-ramp-range-plan.md §0).
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
 * ⭐ **One member of a fan — a CHORD in its own right**, which is what this feature had already
 * concluded in prose (`docs/fanned-beam-pitches-plan.md`: *"inside a fan the chord is the MEMBER,
 * not the slot"*) before the type said it. It was `NotePitch[]`, a bare array, and that shape could
 * only ever hold pitches.
 *
 * Real {@link NotePitch}es, with ids, because a member IS a note: a click has to select one, and
 * `getNote` / the arrows / `a`–`g` all address a pitch by id. Dense rather than sparse for the same
 * reason — half the heads carrying real ids and half synthetic ones would double every command that
 * resolves one (plan §1).
 */
export interface FanMemberChord {
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
 * Client #10 of the engraving-overrides compartment: user-authored horizontal space before a
 * rhythmic column (Sibelius's *note spacing* — see docs/note-spacing-plan.md).
 *
 * ⚠️ **The first override in this compartment that HAS WIDTH.** Every other client is an
 * *offset*: it moves a glyph and nothing else in the score notices — weightless, invisible to
 * the width key, present only in the shape key. This one makes the bar grow, can re-wrap the
 * system, and moves every later column with it. That difference decides everything below.
 *
 * **It is not a property of the note; it is a property of the COLUMN the note sits in.** Hence
 * the key ({@link spacingPositionKey}) carries neither a `voice` nor a `staffId`, unlike
 * {@link RestShiftOverride}'s. Dropping `voice` is what makes one space shared by every voice at
 * that beat instead of two that can disagree; dropping `staffId` makes it a property of the
 * system-wide column, so a grand staff cannot drift apart. Both syncs are consequences of the
 * key, not features implemented on top of it.
 *
 * `space` is in **staff-spaces**, signed (+ = more room before this column), never pixels
 * (principle 3). Zero clears the entry, so "absent = the engraver's own spacing" holds.
 */
export interface LeadingSpaceOverride extends EngravingOverride {
  kind: 'leadingSpace'
  /** Staff-spaces of extra room before this column, signed. + = more room, − = tighter. */
  space: number
}

/**
 * Client #11 of the engraving-overrides compartment: user-authored **bar stretch** — the bar's
 * music gets `stretch ×` the room the engraver gave it, re-spaced proportionally (see
 * docs/bar-width-plan.md).
 *
 * **The second override that has width**, and the opposite gesture to {@link LeadingSpaceOverride}:
 * a leading space opens a *dead gap* before one column and is subtracted before formatting, so it
 * fights the formatter on purpose. A stretch just hands the formatter a bigger box — VexFlow
 * redistributes the columns by duration on its own, which IS the proportional recalculation.
 *
 * ⚠️ **A multiplier, not a distance, and on the NOTE SPACE only** (not on the bar's clef/meter
 * overhead, which is reflow-dependent — a bar pays for a full clef only while it opens a line, so
 * folding the overhead in would make the same stored `stretch` buy a different number of pixels
 * after a re-wrap). A stored distance would rot: widen a 4-note bar by 120px, add four more notes,
 * and the bar is no longer as roomy as it was left. A multiplier keeps the *intent* through edits.
 *
 * Keyed by {@link barWidthKey} (`{measureId}:barwidth`) — the bar, not a column, and by **id** so a
 * rebar (which keeps measure ids) carries the stretch with no capture/restore at all. `1` clears the
 * entry, so "absent = the engraver's own width" holds. Clamped on the way in, at the write site.
 */
export interface BarWidthOverride extends EngravingOverride {
  kind: 'barWidth'
  /** Multiplier on the bar's own note space. 1 = the engraver's own width. */
  stretch: number
}

/**
 * Client #12 of the engraving-overrides compartment: a free horizontal nudge of a single note off
 * its natural (formatted) column, on top of the automatic spacing (see docs/note-offset-plan.md).
 * `x` is in **staff-spaces**, +right — added to the note's own X at render via
 * `StaveNote.setXShift`, so the note's beam, stem, ties, slurs, dots and hit-testing all recompute
 * around the moved position (an SVG translate would leave the beam and tie anchors behind).
 *
 * ⚠️ **An OFFSET, not a space** — it must NOT change the bar's width. Applied post-format /
 * pre-draw, after the column's width is already reserved at the un-shifted position (unlike
 * {@link LeadingSpaceOverride}, which fights the formatter to open a real gap).
 *
 * **Keyed by SLOT id**, not pitch id. One `StaveNote` is one slot; VexFlow cannot x-shift a single
 * notehead of a chord independently, so a chord (and a rest, which is a slot too) moves as a unit.
 * Element-id-keyed like {@link DynamicOffsetOverride}, but with **weaker durability**: a slot id is
 * re-minted by rebar/paste, so this orphans more readily than a dynamic offset (whose id is durable).
 * Returning to `x = 0` clears the entry, so "absent = default" holds. Horizontal only for now — `y`
 * is a trivial later addition, deferred to keep scope honest.
 */
export interface NoteOffsetOverride extends EngravingOverride {
  kind: 'noteOffset'
  /** Horizontal offset in staff-spaces, relative to the note's natural column. +right. */
  x: number
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

/**
 * ONE PITCH ON ITS WAY INTO A MEASURE — the payload `ScoreModel.insertPitch` takes.
 *
 * A `NotePitch` (what is stored on the chord) plus the SLOT statements the pitch arrives carrying:
 * where it lands (`beat`, `voice`), how long it is, and the marks that belong to the whole event
 * rather than to the head — beam, tremolo, fan, articulations. The insert merges it into a chord
 * already at that beat in that voice, or makes a new slot from these fields.
 *
 * Named because it crosses a module boundary: `voiceOps` builds one when a note changes voice and
 * hands it back to the model to insert (docs/modularity-plan-2026-07-28.md Phase 3). It is model
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
  duration: NoteDuration
  dots?: number
  beat: Fraction
  voice: number
  articulations?: Chord['articulations']
  articulationStemAlign?: boolean
  beam?: BeamMode
  secondaryBreak?: boolean
  tremolo?: TremoloMark
  tremoloPair?: true
  tremoloPairStyle?: 'joined' | 'open'
  fan?: FanMark
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
  /** Secondary beams break in front of this slot — see the type note on {@link BeamMode}. */
  secondaryBreak?: boolean
  tupletId?: string
  actualDuration?: Fraction
  articulations?: ArticulationType[]
  /** Explicit side for articulations (above/below); omitted = auto (stem-derived). */
  articulationPlacement?: 'above' | 'below'
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
   * `slots` puts it in the WIDTH key too — which is the safe direction. See docs/tremolo-plan.md §1.
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
   * than carried. See docs/two-note-tremolo-plan.md §1.
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
   * Dorico's shape too. See docs/two-note-tremolo-plan.md §2.
   */
  tremoloPairStyle?: 'joined' | 'open'
  /**
   * Fanned (feathered) beam: play this ONE event as {@link FanMark.count} notes that speed up or
   * slow down across exactly its own duration. See {@link FanMark}.
   *
   * ⚠️ Like {@link tremoloPair}, the durations are NOT rewritten — `duration` stays `'h'` and the
   * slot stays one event, so rebar, rest-fill, meter changes, clipboard, JSON, collision and undo
   * never see a note claiming a length it does not have. Only the drawing and the playback expand
   * it, and removing the field IS "go back to the note I typed".
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
  /**
   * Beam OVER this rest instead of breaking the beam at it — the "beamed rest" convention:
   * `𝅘𝅥𝅮 𝄾 𝅘𝅥𝅮 𝅘𝅥𝅮` in one beat gets a single beam with the rest floating under it. Absent = the default,
   * a rest breaks the beam. It only shows when the rest is INTERIOR to a group its neighbours form;
   * a leading or trailing beamed rest is trimmed, because a beam never hangs off a rest. See
   * docs/beaming.md.
   *
   * A structural beaming statement, so it lives on the slot beside {@link Chord.beam} /
   * `secondaryBreak`, not in the visual-override compartment rest hide/shift use. ⚠️ It is therefore
   * tied to this rest object: a structural edit that regenerates the rest (rebar, paste) drops it —
   * which is also when the beaming context it describes has changed.
   */
  beamOver?: boolean
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
  /** The armed entry tremolo, drawn on the ghost — "this click enters a note wearing this mark".
   *  Absent = no tremolo armed. Same modifier the engraved mark uses, so the preview cannot
   *  disagree with what lands. */
  tremolo?: TremoloMark
  /** Show a natural (♮) even though `alter` is 0 — the preview for an armed natural accidental,
   *  which otherwise has no glyph (alter 0 draws nothing). Sharp/flat carry their own sign via alter. */
  forceAccidental?: boolean
  /**
   * The armed tuplet's mark, drawn above the ghost — the preview for "this click starts a tuplet".
   * Absent = no tuplet armed, and the ghost is an ordinary note.
   *
   * The same RUNS the engraved mark is drawn from (`tupletMarkRuns`), because they are drawn at
   * different sizes — a preview carrying one joined string could not look like the thing it previews.
   */
  tupletLabel?: TupletMarkRun[]
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
  /**
   * The tremolo the new note is entered WITH — note entry armed with a mark, the way it is armed
   * with an accidental or a dot (docs/tremolo-plan.md §10). A property of the SLOT, so entering a
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
  /** REST only: beam over this rest instead of breaking at it. See {@link Rest.beamOver}. */
  beamOver?: boolean
  /** Voice index (0–3). Defaults to 0. See {@link Note.voice}. */
  voice?: 0 | 1 | 2 | 3
  /** 0-based staff index in {@link Score.staves}. Defaults to 0. See {@link Note.staff}. */
  staff?: number
}
