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
 * Nothing in this module touches playback, and that is still true now that repeats DO play (§7,
 * 2026-08-26). The play order is `engine/audio/repeatPlan` — a pure read of these fields into a list
 * of legs — so this module gained no caller and no knowledge of it. ⭐ That separation is what lets
 * the dev shell's checkbox turn repeats off without touching a score: the SIGNS are the music, the
 * ORDER is one performance of it.
 */
import type { BarlineStatement, BarlineStyle, Measure, RepeatEnd, RepeatStart, Score } from '@/types/music'
import { signAtBoundary, wingsAllowed, type BarlineSignKind } from '@/engine/layout/barlineSign'

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
  /** ⭐ The line is there and divides the bars; it is simply not engraved — tinted for the editor,
   *  omitted in print (`engine/rendering/hiddenElements`). ⛔ Not "no barline": see {@link BarlineStyle}. */
  invisible: true,
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
 * **Back to a plain line** — drop the statement standing at the line that ENDS this bar: its style
 * and its end repeat. What Delete means on a selected barline (plan §8 P5), and the one operation
 * that has to name both, since the selection points at a LINE and the user who presses Delete on it
 * means the sign, whichever of the two fields happens to be storing it.
 *
 * ⛔ **It does NOT clear `repeatStart`, and an earlier draft of it did.** That field is the line at
 * this bar's LEFT edge — a different boundary, owned by this bar because a repeat belongs to the bar
 * it OPENS. Clearing it here was defended as "the gesture treats both of a bar's boundaries as one
 * target", and the gesture no longer does: the `|:` is its own selection
 * (`interactions/elements/repeatStart.ts`), so that the half you clicked is the half that goes
 * (*"when we have open+end and I choose it… it should highlight just the part that was clicked"*).
 *
 * @returns whether the score changed.
 */
export function clearBarline(score: Score, measureNumber: number): boolean {
  const measure = getMeasure(score, measureNumber)
  if (!measure) return false

  if (measure.barline === undefined && measure.repeatEnd === undefined) return false
  delete measure.barline
  delete measure.repeatEnd
  return true
}

/**
 * ⭐⭐ **SET THE WHOLE SIGN AT ONE BOUNDARY** — the Properties chooser's write, and the ONE operation
 * in this module that touches two measures on purpose.
 *
 * 🚨 **HIS ASK, 2026-08-26:** *"probably in the property, since we can just select one barline, there
 * should be an option for close+open case."* Exactly right, and it is an argument about the
 * INSTRUMENT rather than about the model: `:||:` is two statements on two bars (§3.2, and that stays
 * true), but a user looking at one line wants to say what stands on it in one go — and no selection
 * of one side can reach the back-to-back form, because each side owns only its own half.
 *
 * ⚠️ **Writing two bars is not a breach of ONE OWNER PER LINE.** That rule is about who STORES a
 * statement and who may READ a neighbour to decide a picture; nothing here reads anything to decide
 * anything. It writes both owners of one line because the caller named the LINE, and it is the only
 * function here that may — every other writer takes a bar.
 *
 * `endsMeasure` is the bar the line closes, ⭐ or **null for the score's opening edge**, where nothing
 * ends and the only statement possible is the `|:` opening bar 1 — the same shape
 * {@link signAtBoundary} already has, whose `ends` is undefined there.
 *
 * ⛔ **Refuses rather than half-applying**: a sign needing a bar on the far side of the line (the two
 * that OPEN one) is refused at the end of the score, and every other sign is refused at the opening
 * edge. A boundary left saying half of what was asked would draw a sign nobody chose.
 *
 * @returns whether the score changed.
 */
export function setBoundarySign(score: Score, endsMeasure: number | null, sign: BarlineSignKind): boolean {
  const opens = sign === 'repeatStart' || sign === 'repeatBoth'

  // The score's opening edge: no bar ends here, so `|:` and "nothing" are the only things sayable.
  // ⭐ This is also the only route to ERASING the `|:` that opens bar 1 — the sign standing on no
  // line that any bar-shaped rule can name (his report, 2026-08-26).
  if (endsMeasure === null) {
    if (sign !== 'plain' && sign !== 'repeatStart') return false
    return setRepeatStart(score, 1, sign === 'repeatStart')
  }

  const ends = getMeasure(score, endsMeasure)
  if (!ends) return false
  const begins = getMeasure(score, endsMeasure + 1)
  if (opens && !begins) return false

  // ⭐ Three independent writes, OR-ed rather than short-circuited: every one of them must run, and
  // the answer is "did anything move". Each is already a no-op when it is asked for what is there.
  const style = setBarlineStyle(score, endsMeasure, sign === 'final' || sign === 'invisible' ? sign : undefined)
  const closes = setRepeatEnd(score, endsMeasure, sign === 'repeatEnd' || sign === 'repeatBoth')
  const opened = begins ? setRepeatStart(score, endsMeasure + 1, opens) : false
  return style || closes || opened
}

/**
 * ⭐⭐ **ADD A REPEAT TO A LINE** — the palette's write for `:|` and `|:`, and the one operation that
 * has to know which signs COMPOSE and which are ALTERNATIVES.
 *
 * 🚨 **TWO OF HIS REPORTS, 2026-08-26, and together they state the rule:**
 *
 *  1. *"End repeat overwrote the open repeat for the other measure… completely wrong."* ⭐ The two
 *     repeats **compose**: `:|` on one bar and `|:` on the next is the back-to-back sign, the
 *     commonest thing in repeated music. So this never touches the other repeat.
 *  2. *"I click a final here and it just made disappear the end repeat, but I don't see it writing
 *     the final."* ⭐ A style and a repeat are **alternatives** — there is no sign that is a final bar
 *     and a repeat at once, so the one just placed must win. That is the caller's other half
 *     ({@link setBoundarySign}, which the `final` button uses); this half is its mirror: placing a
 *     repeat drops the STYLE standing on the same line, so the repeat is what gets drawn.
 *
 * ⛔ The style it drops is the one on the bar that ENDS the line, which is the only bar that can hold
 * one — so this reads no neighbour it does not already own by the caller's naming of the line.
 *
 * ⭐⭐ **HIS RULE, in his own words, and it is the whole of this module's placement policy:** *"if the
 * barline is the repeat, it should just check if what is clicking on it is a repeat and contrary to
 * its sign — in that case they make the double repetition; if not, just override."* So: **a line
 * carries ONE sign, except that the two repeats combine.** Nothing else composes with anything.
 *
 * ⭐ **And his one exception: the first measure of the composition, when it has an explicit open
 * repeat.** That sign stands at the score's opening edge — `endsMeasure === null` — where **no bar
 * ends**, so there is no style and no `:|` for it to combine with or override. It is the one `|:` in
 * a score that is alone on its line, and the two guards below are where that falls out: nothing
 * clears a style there, and {@link setBoundarySign} refuses every sign but `plain` and `repeatStart`.
 *
 * @returns whether the score changed.
 */
export function addRepeatAtBoundary(score: Score, endsMeasure: number | null, which: 'start' | 'end'): boolean {
  // The `|:` opens the bar past the line — bar 1 at the score's own edge, which is the only sign
  // sayable there. An `:|` needs a bar to close, so it has nothing to say at that edge.
  if (which === 'start') {
    const opens = (endsMeasure ?? 0) + 1
    const repeat = setRepeatStart(score, opens, true)
    // ⛔ Only when a bar ends here: at the score's opening edge there is no style to override.
    const style = endsMeasure === null ? false : setBarlineStyle(score, endsMeasure, undefined)
    return repeat || style
  }
  if (endsMeasure === null) return false
  const repeat = setRepeatEnd(score, endsMeasure, true)
  const style = setBarlineStyle(score, endsMeasure, undefined)
  return repeat || style
}

/**
 * ⭐⭐ **WINGS ON OR OFF, for the sign standing at one line** — the Properties checkbox's write.
 *
 * 🚨 **HIS ASK, 2026-08-26:** *"the wings on properties should be a checkbox, but the important thing
 * is it should only be checkable when wings are allowed — this is for open repeat, for end repeat and
 * for final; other barlines do not allow wings."* The *allowed* half is
 * {@link barlineSign.wingsAllowed}, asked by the panel; this is the write.
 *
 * ⭐ **It sets the flag on every statement standing at that line**, which is one field for a `final`
 * or a lone repeat and two for a `:||:`. A decoration on ONE drawn sign cannot be half on, and the
 * sign at a junction is made of two statements — so they agree by construction rather than by a
 * reader picking a winner.
 *
 * ⛔ Refuses a line whose sign cannot carry them (a plain or invisible line: nothing to flare), and
 * ⛔ refuses to write the flag onto a bar that has made no statement — `winged` is a property OF a
 * sign, so there is nowhere to put it when there is no sign.
 *
 * @returns whether the score changed.
 */
export function setBoundaryWinged(score: Score, endsMeasure: number | null, on: boolean): boolean {
  if (!wingsAllowed(boundarySign(score, endsMeasure))) return false

  const ends = endsMeasure === null ? undefined : getMeasure(score, endsMeasure)
  const begins = getMeasure(score, (endsMeasure ?? 0) + 1)
  let changed = false
  // ⚠️ `|| changed` on the right, never `&&`: every statement must be visited. Short-circuiting here
  // would leave a `:||:` with one winged half — the exact state this function exists to prevent.
  for (const statement of [ends?.barline, ends?.repeatEnd, begins?.repeatStart]) {
    if (statement === undefined) continue
    if ((statement.winged === true) === on) continue
    if (on) statement.winged = true
    else delete statement.winged
    changed = true
  }
  return changed
}

/** Whether the sign at this line is drawn with wings. ⭐ ANY statement saying so is enough — they are
 *  kept in step by {@link setBoundaryWinged}, and a drawing may not be half-decorated. */
export function boundaryWinged(score: Score, endsMeasure: number | null): boolean {
  const ends = endsMeasure === null ? undefined : getMeasure(score, endsMeasure)
  const begins = getMeasure(score, (endsMeasure ?? 0) + 1)
  return ends?.barline?.winged === true
    || ends?.repeatEnd?.winged === true
    || begins?.repeatStart?.winged === true
}

/**
 * ⭐ **What the chooser should show as CHECKED** — the sign a boundary carries, read from the two bars
 * that meet there. The read half of {@link setBoundarySign}, and a thin wrapper on the drawing's own
 * {@link signAtBoundary} so the panel and the page cannot disagree about what is standing there.
 *
 * ⚠️ It answers for the MODEL, not for a render: a `|:` displaced past its bar's clef is still the
 * statement made at that boundary even though the pass draws it a space to the right, and a neighbour
 * on the next system is still the neighbour. Both are the pass's business, neither is the panel's.
 */
export function boundarySign(score: Score, endsMeasure: number | null): BarlineSignKind {
  const ends = endsMeasure === null ? undefined : getMeasure(score, endsMeasure)
  const begins = getMeasure(score, (endsMeasure ?? 0) + 1)
  return signAtBoundary(ends, begins) ?? (begins?.repeatStart !== undefined ? 'repeatStart' : 'plain')
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
