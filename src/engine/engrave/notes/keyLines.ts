/**
 * ⭐⭐ **WHAT A CHORD'S KEYS PUT ON THE STAFF** — each key's staff LINE, the notehead GLYPH it is
 * written with, and which keys stand a SECOND apart. S6d of `docs/history/vexflow-removal-map.md`.
 *
 * ## ⭐ Why this module exists
 *
 * A `StaveNote` is handed pitch strings (`'c#/4'`) and resolves each one to a row of *key
 * properties* in its constructor — `Tables.keyProperties`, VexFlow's own note table. That row is
 * then the source for everything above it: the LINE a head is drawn on, the GLYPH it is drawn with,
 * whether two heads are close enough that one must cross the stem, and — through `Stave.getYForNote`
 * — the y of every tie, slur, beam and articulation that hangs off the note.
 *
 * ⭐ **The line arithmetic was already ours**: {@link staffLineForSpelling} has answered it for the
 * fanned beam's hand-placed heads since the fan was built, and a spec has asserted the two agree
 * ever since (`NoteBuilder.test.ts`, *"staffLineForSpelling matches VexFlow"*). ⛔ Two owners of one
 * rule, kept honest by a test, is exactly the shape this migration exists to end — so S6d makes ours
 * the only one, and VexFlow's table stops running for our notes.
 *
 * ⚠️ **The two formulas are the same expression, spelled differently** — VexFlow counts from a
 * clef's `lineShift` off C4, we count from the clef's MIDDLE LINE:
 *
 * ```
 *   VexFlow : ((octave − 4)·7 + letterIndex) / 2 + lineShift(clef)
 *   ours    : 3 + (octave·7 + letterIndex − middleLine(clef)) / 2
 * ```
 *
 * For treble (`lineShift` 0, middle line B4 = 34) both reduce to `(7·octave + letterIndex)/2 − 14`,
 * and the same cancellation holds for the other three. ⭐ Ours is derived from ONE table (the clef's
 * middle line, which `naturalStemDirection` and the voice hop already read), which is why a clef
 * added later needs one row and nothing here.
 *
 * ## ⛔ What is NOT here
 *
 * - **Where a head sits ACROSS the stem.** That is the chord-displacement walk, and it has its own
 *   owner — `rendering/format/chordHeadLayout`, shared with the fan. {@link secondApartFlags} answers only
 *   VexFlow's *other*, coarser adjacency flag (`keyProps[i].displaced`), which marks BOTH members of
 *   a close pair and is what a note's displaced-head ROOM is measured from (S6b).
 * - **A REST's line.** A rest has no pitch; `NoteBuilder.restKey` decides its line and spells it as a
 *   treble pitch, deliberately (see that function). VexFlow's own `key === 'R'` fallback therefore
 *   never runs here, and a key it would fire on is refused loudly below rather than placed silently.
 */
import type { Clef, NoteDuration, PitchStep } from '@/types/music'
import { staffLineForSpelling } from '@/utils/clefUtils'
import { DURATION_INFO } from '@/utils/durations'
import { GLYPH_CODEPOINTS } from '@/engine/fonts/bravuraMetrics'
import { noteheadGlyph, restGlyph } from '@/engine/fonts/fontMetrics'

/**
 * One key of a chord, resolved — the shape VexFlow's `keyProps` row has, so the note can hand these
 * straight to the readers that already speak it (`Beam`, `Accidental`, `getLineNumber`).
 */
export interface KeyRow {
  /** The key's own name, upper-cased with its accidental: `'C'`, `'C#'`, `'CB'`. */
  readonly key: string
  readonly octave: number
  /** The staff line: **1 is the bottom line, 5 the top**, a step is 0.5. @see staffLineForSpelling */
  readonly line: number
  /** Chromatic value, un-wrapped — `B#4` is 60, not 48. Read by tablature tuning only. */
  readonly intValue: number
  /** The notehead's codepoint(s), from the font's own table. */
  readonly code: string
  /** @see secondApartFlags */
  readonly displaced: boolean
  /**
   * ⭐ **CROSS-STAFF** (docs/plans/cross-staff-plan.md): how many staff lines HIGHER than {@link line}
   * this head stands in the note's own frame, because it is written on another staff — positive for
   * the staff above, negative for the one below, **0 for every head that has not crossed**.
   *
   * ⭐ `line` stays the head's TRUE line on the staff it is written on: that is what its ledger
   * lines, its dot's dodge and its clef are read from. Everything that asks where the head IS — the
   * sort, its y, the stem, a second's displacement — asks {@link geoLine}. ⚠️ `lift` is rarely a
   * whole number (the gap between staves is not a whole count of lines), which is exactly why the
   * two are not folded into one.
   */
  readonly lift: number
}

/** Where a head stands in its note's own frame, in staff lines — its line, plus the {@link KeyRow.lift}
 *  of the staff it is written on. */
export function geoLine(row: { line: number; lift?: number }): number {
  return row.line + (row.lift ?? 0)
}

/** One key's place on ANOTHER staff: the clef it is read in there, and that staff's {@link KeyRow.lift}. */
export interface KeyCrossing {
  clef: Clef
  lift: number
}

const CLEFS: readonly Clef[] = ['treble', 'bass', 'alto', 'tenor']

/** Pitch class of each step, before its accidental — the base VexFlow's `intVal` column is built on. */
const STEP_PITCH_CLASS: Record<PitchStep, number> = {
  C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11,
}

/**
 * ⚠️ **VexFlow's `intVal` column wraps on the FLAT side only, and that asymmetry is real, not a typo**:
 * `Cb` is 11 (its own octave's B, ⛔ not −1) while `B#` is **12** and `B##` 13 — values no pitch class
 * has. ⭐ Transcribed rather than normalised, because the one thing that reads it (VexFlow's tablature
 * `Tuning`) compares these numbers to each other.
 */
function chromaticValue(step: PitchStep, alter: number): number {
  const value = STEP_PITCH_CLASS[step] + alter
  return value < 0 ? value + 12 : value
}

const ALTER_OF: Record<string, number> = { '': 0, n: 0, '#': 1, '##': 2, b: -1, bb: -2 }

/**
 * A VexFlow key string: a letter, an optional accidental, a slash, an octave.
 *
 * ⚠️ The accidental is greedy and unambiguous only because a slash follows it — `'bb/4'` is B♭, ⛔
 * never B natural in octave "b4". A key with a THIRD piece (`'c/4/D2'`, VexFlow's per-key glyph
 * override) is not matched: this editor never writes one, and a silent fallback would draw the
 * wrong head.
 */
const KEY = /^([a-gA-G])(##|#|bb|b|n)?\/(-?\d+)$/

/** The one parse, so the step, the alter and the octave are read off a key string in one place. */
function parseKey(key: string): { step: PitchStep; alter: number; octave: number; name: string } {
  const m = KEY.exec(key)
  if (!m) throw new Error(`[keyLines] not a key this editor writes: "${key}"`)
  const step = m[1].toUpperCase() as PitchStep
  const accidental = (m[2] ?? '').toLowerCase()
  return {
    step,
    alter: ALTER_OF[accidental],
    octave: parseInt(m[3], 10),
    name: (m[1] + (m[2] ?? '')).toUpperCase(),
  }
}

/**
 * The staff LINE a key stands on under a clef — ⭐ the one rule, {@link staffLineForSpelling}.
 *
 * @param octaveShift octaves the whole note is written away from where it sounds (VexFlow's
 *   `octaveShift`, subtracted from the written octave). ⚠️ This editor never writes one; it is here
 *   because the note may carry it and a dropped shift would be a silent transposition.
 */
export function keyStaffLine(key: string, clef: Clef, octaveShift: number = 0): number {
  const { step, octave } = parseKey(key)
  return staffLineForSpelling(step, octave - octaveShift, clef)
}

/**
 * ⭐ Which keys are a SECOND (or a unison) from their NEIGHBOUR IN THE CHORD'S OWN ORDER — VexFlow's
 * `keyProps[i].displaced`, and **both** members of a close pair are flagged, ⛔ not just the one that
 * moves.
 *
 * ⚠️ **This is not the displacement walk** (`rendering/format/chordHeadLayout`), and the two answer
 * different questions on purpose: this one says *"this chord is tight here"*, which is what a note's
 * displaced-head ROOM is reserved from (`noteGeometry.displacedHeadRoom`, S6b); the walk says
 * *"this head crosses the stem"*, which is what the head is DRAWN from. A three-note cluster flags
 * all three here and crosses only the middle one there.
 *
 * ⚠️ Compares against the PREVIOUS key as given, so it depends on the caller's key order — VexFlow's
 * does too, and `NoteBuilder` hands its pitches sorted.
 */
export function secondApartFlags(lines: readonly number[]): boolean[] {
  const flags = lines.map(() => false)
  for (let i = 1; i < lines.length; i++) {
    if (Math.abs(lines[i - 1] - lines[i]) < 1) {
      flags[i] = true
      flags[i - 1] = true
    }
  }
  return flags
}

/**
 * The glyph a head (or a rest) is drawn with, as its codepoint — the font's own tables
 * (`fonts/fontMetrics`), which have answered this since P2 and now answer it for the real note too.
 *
 * ⛔ **Not a duration-to-shape rule of its own**: everything shorter than a half is one black head,
 * and every rest has its own glyph, exactly as VexFlow's `codeNoteHead` resolves them for the two
 * note types this editor writes (`'n'` and `'r'`).
 */
export function headGlyph(duration: NoteDuration, isRest: boolean): string {
  return String.fromCodePoint(GLYPH_CODEPOINTS[isRest ? restGlyph(duration) : noteheadGlyph(duration)])
}

/**
 * ⚠️ The note's duration as OUR word for it, from the token's duration part — found through
 * `DURATION_INFO`'s own `token` column, ⛔ never assumed equal: they are the same string up to the 512th,
 * but the breve's and longa's tokens are `'1/2'` and `'1/4'` (`utils/durations`).
 */
export function noteDurationOf(token: string): NoteDuration {
  const duration = TOKEN_TO_DURATION.get(token)
  if (duration === undefined) {
    throw new Error(`[keyLines] not a duration this editor writes: "${token}"`)
  }
  return duration
}

const TOKEN_TO_DURATION: ReadonlyMap<string, NoteDuration> = new Map(
  (Object.keys(DURATION_INFO) as NoteDuration[]).map(d => [DURATION_INFO[d].token, d]),
)

/**
 * ⭐ Every key of one chord, resolved — the whole of what a note's constructor asks of the note table.
 *
 * @param keys VexFlow key strings, in the note's own order.
 */
export function keyRows(
  keys: readonly string[],
  clef: string,
  duration: NoteDuration,
  isRest: boolean,
  octaveShift: number = 0,
  /** ⭐ Per key, in the keys' order: where a CROSSED head is written. Absent / `undefined` = home. */
  crossings?: readonly (KeyCrossing | undefined)[],
): KeyRow[] {
  if (!CLEFS.includes(clef as Clef)) {
    throw new Error(`[keyLines] not a clef this editor writes: "${clef}"`)
  }
  const parsed = keys.map(parseKey)
  const lines = parsed.map((p, i) =>
    staffLineForSpelling(p.step, p.octave - octaveShift, crossings?.[i]?.clef ?? (clef as Clef)))
  const lifts = parsed.map((_, i) => crossings?.[i]?.lift ?? 0)
  // ⭐ A second is two heads a step apart WHERE THEY STAND — heads on different staves never are.
  const flags = secondApartFlags(lines.map((line, i) => line + lifts[i]))
  const code = headGlyph(duration, isRest)
  return parsed.map((p, i) => ({
    key: p.name,
    octave: p.octave - octaveShift,
    line: lines[i],
    intValue: (p.octave - octaveShift) * 12 + chromaticValue(p.step, p.alter),
    code,
    displaced: flags[i],
    lift: lifts[i],
  }))
}
