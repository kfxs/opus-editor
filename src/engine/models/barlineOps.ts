/**
 * **BARLINE TYPES** — the final barline, the open repeat and the end repeat, as a SCORE operation.
 * Free functions on a `Score`, in the `clefOps` / `tempoOps` / `staffSize` idiom, with
 * {@link ScoreModel} keeping thin delegators (DESIGN-PRINCIPLES principle 5 — the score is
 * independent of the editor, so none of this may live on `MusicEngine`, which only records undo).
 *
 * See docs/barline-types-plan.md. Three things decided there govern every line of this file:
 *
 * ## ⭐⭐ A REPEAT IS NOT A BARLINE STYLE
 *
 * The palette says three things of one kind; they are **two kinds** (plan §3.2). `final` is a
 * {@link BarlineStyle}; the two repeats are separate statements, exactly as MNX, SMuFL and MuseScore
 * have them — which is why there are three setters here and not one `setBarlineType`.
 *
 * ## ⭐⭐ ONE OWNER PER LINE
 *
 * A style and an end repeat belong to the bar the line **ENDS**; a start repeat belongs to the bar it
 * **OPENS**. No two measures ever name the same line, so nothing here reads a neighbour — the
 * conflict resolution Verovio needs (~60 lines) has nothing to resolve. ⚠️ The one question that
 * *does* cross the barline is the PICTURE (bar *N* draws no end line when bar *N+1* opens a repeat),
 * and it is deliberately not here: it belongs to the drawing pass, which can see both bars and the
 * casting-off (plan §4.6.3).
 *
 * ## ⛔ INK, never a play ORDER
 *
 * Nothing in this module touches playback. `playbackSchedule` walks `score.measures` straight
 * through and must keep doing so until a repeat play order exists as its own feature (plan §7).
 */
import type { BarlineStatement, BarlineStyle, Measure, RepeatEnd, RepeatStart, Score } from '@/types/music'

/**
 * Every legal {@link BarlineStyle}, as a table the compiler keeps TOTAL.
 *
 * ⭐ `satisfies Record<BarlineStyle, true>` is the point: adding a member to the union without
 * teaching {@link isBarlineStyle} about it stops compiling. A hand-written list of the same strings
 * would rot silently, and the load boundary would start rejecting a style the editor can write.
 */
const BARLINE_STYLES = {
  /** Thin + thick, ≈1.0 space of ink: the end of a movement, not only of the piece (Gould p. 39). */
  final: true,
} satisfies Record<BarlineStyle, true>

/** Find a measure by its number (mirrors `ScoreModel.getMeasure`). */
function getMeasure(score: Score, measureNumber: number): Measure | undefined {
  return score.measures.find(m => m.number === measureNumber)
}

// ==================== Reads ====================

/** The style of the line ENDING this bar, or undefined for the plain single line every bar draws by
 *  default. ⛔ Absence is the rule, not a stored default — there is no automatic final bar (§3.3). */
export function barlineAt(score: Score, measureNumber: number): BarlineStatement | undefined {
  return getMeasure(score, measureNumber)?.barline
}

/** The repeat this bar OPENS ( `|:` ), or undefined. */
export function repeatStartAt(score: Score, measureNumber: number): RepeatStart | undefined {
  return getMeasure(score, measureNumber)?.repeatStart
}

/** The repeat this bar CLOSES ( `:|` ), or undefined. */
export function repeatEndAt(score: Score, measureNumber: number): RepeatEnd | undefined {
  return getMeasure(score, measureNumber)?.repeatEnd
}

// ==================== Writes ====================

/**
 * Set the style of the line ending `measureNumber`; `undefined` **clears** it back to the plain
 * single line, so "absent = plain" holds and the JSON stays clean (the `setStaffSize` idiom — an
 * absent field and a stored default must not both be reachable, or a round trip has two spellings of
 * the same picture).
 *
 * `staffId` is the SCOPE — absent = the whole system (plan §2). Nothing reads it yet.
 *
 * Refuses an unknown measure and an unknown style, touching nothing — the editor cannot half-write a
 * value the drawing has no case for. @returns whether the score changed.
 */
export function setBarlineStyle(
  score: Score,
  measureNumber: number,
  style: BarlineStyle | undefined,
  staffId?: string,
): boolean {
  const measure = getMeasure(score, measureNumber)
  if (!measure) return false
  if (style !== undefined && !isBarlineStyle(style)) return false

  if (style === undefined) {
    if (measure.barline === undefined) return false
    delete measure.barline
    return true
  }
  if (measure.barline?.style === style && measure.barline.staffId === staffId) return false
  measure.barline = staffId === undefined ? { style } : { style, staffId }
  return true
}

/**
 * Turn the OPENING repeat of `measureNumber` ( `|:` ) on or off. `staffId` is the scope, absent = the
 * whole system.
 *
 * ⚠️ Note which bar this is: the sign sits at the START of this bar, so "repeat back to bar 5" is
 * `setRepeatStart(score, 5, true)` — the bar the music jumps TO, never the one before it.
 *
 * @returns whether the score changed.
 */
export function setRepeatStart(score: Score, measureNumber: number, on: boolean, staffId?: string): boolean {
  const measure = getMeasure(score, measureNumber)
  if (!measure) return false

  if (!on) {
    if (measure.repeatStart === undefined) return false
    delete measure.repeatStart
    return true
  }
  if (measure.repeatStart !== undefined && measure.repeatStart.staffId === staffId) return false
  measure.repeatStart = staffId === undefined ? {} : { staffId }
  return true
}

/**
 * Turn the CLOSING repeat of `measureNumber` ( `:|` ) on or off.
 *
 * `times` is how many times the passage is played in total; absent = twice, the reading every player
 * assumes. Refuses a `times` that is not a whole number ≥ 2 ({@link isValidRepeatTimes}) rather than
 * clamping it — a sign that says "play 1 time" is not a repeat, and repairing it silently would make
 * the file and the picture disagree (docs/json-io-plan.md).
 *
 * @returns whether the score changed.
 */
export function setRepeatEnd(
  score: Score,
  measureNumber: number,
  on: boolean,
  options: { times?: number; staffId?: string } = {},
): boolean {
  const measure = getMeasure(score, measureNumber)
  if (!measure) return false

  if (!on) {
    if (measure.repeatEnd === undefined) return false
    delete measure.repeatEnd
    return true
  }
  const { times, staffId } = options
  if (times !== undefined && !isValidRepeatTimes(times)) return false

  const current = measure.repeatEnd
  if (current !== undefined && current.times === times && current.staffId === staffId) return false
  const next: RepeatEnd = {}
  if (times !== undefined) next.times = times
  if (staffId !== undefined) next.staffId = staffId
  measure.repeatEnd = next
  return true
}

/**
 * **Back to a plain line** — drop every barline statement this bar carries (its style AND both
 * repeats). What Delete means on a selected barline (plan §8 P5), and the one operation that has to
 * name all three: the selection points at a LINE, and the user who presses Delete on it means the
 * sign, whichever of the three fields happens to be storing it.
 *
 * ⚠️ It clears `repeatStart` too, which is the line at this bar's LEFT edge — the only place in this
 * module that treats both of a bar's boundaries as one target, and it does so because the *gesture*
 * does. @returns whether the score changed.
 */
export function clearBarline(score: Score, measureNumber: number): boolean {
  const measure = getMeasure(score, measureNumber)
  if (!measure) return false

  const had = measure.barline !== undefined || measure.repeatStart !== undefined || measure.repeatEnd !== undefined
  if (!had) return false
  delete measure.barline
  delete measure.repeatStart
  delete measure.repeatEnd
  return true
}

// ==================== Predicates (shared with the load boundary) ====================

/** Whether `value` is a style the drawing has a case for. The one predicate both the mutators above
 *  and `ScoreModel.validateBarlines` ask, so a hand-written score cannot smuggle in a style the
 *  editor itself refuses to write. */
export function isBarlineStyle(value: unknown): value is BarlineStyle {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(BARLINE_STYLES, value)
}

/**
 * A repeat count has to be a whole number of playings, and at least **2** — 1 is a repeat that does
 * not repeat and 0 is nothing at all, both of which would draw a sign meaning the opposite of what it
 * says. (MusicXML's `times` carries the same reading: *the number of times the repeated section is
 * played*.) Absent is legal everywhere and means 2.
 */
export function isValidRepeatTimes(times: number): boolean {
  return Number.isInteger(times) && times >= 2
}
