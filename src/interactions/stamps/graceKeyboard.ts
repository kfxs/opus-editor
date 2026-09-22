/**
 * ⭐⭐ **GRACES FROM THE KEYBOARD** — his ask, 2026-09-22: *"i want to be able to enter grace in keyboard
 * mode entry similar as we do with notes"*. `KeyboardController` works out WHERE and WHAT exactly as it
 * does for a note (the caret's next position, the nearest octave, the key and the bar's accidentals, the
 * armed sign); this decides what a letter does while the GRACE stamp is armed:
 *
 * - a LETTER types a grace — at the END of the group before the caret's next position (the place the
 *   next NOTE would go), or right after the grace the caret is on; the caret moves onto it, so the next
 *   letter's octave follows it. On a whole-bar rest, the rest becomes a one-beat rest at that beat first
 *   (`restGraceOps.beatRestAt`, the stamp's rule).
 * - SHIFT+letter on a grace adds that pitch to it — a grace chord (`graceCommands.addGracePitch`).
 *
 * Then the lit button pressed again disarms back to note entry, and the next letter is the MAIN note at
 * that place — it takes the graces (`KeyboardController`'s caret-after-a-grace rule, and D7).
 */
import type { MusicEngine } from '../../engine/MusicEngine'
import type { Fraction, PitchSpelling } from '../../types/music'
import { fracEq, fracLt, fracToNumber } from '../../utils/fraction'
import { staffOf, voiceOf } from '../../utils/lanes'
import { armedTool, pendingArticulations, type EditorState, type MarkingTool } from '../state/EditorState'
import { findSlot } from '../../engine/models/slotLookup'
import { graceHostId } from '../walks/graceStops'
import { graceGroupAt } from '../../engine/models/graceToNoteOps'
import { durationToBeats, getMeasureNotes } from '../../utils/musicUtils'

/** Where the caret says the next event goes — `KeyboardController`'s own answer. */
export interface GraceCaretTarget {
  measure: number
  beat: Fraction
  voice: number
  staff: number
}

/**
 * ⭐ Type ONE grace of `spelling` for the caret on `caretId` (a note, a rest, or a grace) aimed at
 * `target`. @returns the new grace's first pitch id — the caller's new caret — or null when refused
 * (no grace stamp armed, nothing to hang it on).
 */
export function typeGraceAtCaret(
  engine: MusicEngine, state: EditorState, caretId: string, target: GraceCaretTarget, spelling: PitchSpelling & { forceAccidental?: boolean },
): string | null {
  const tool = armedTool(state, 'grace')
  if (!tool) return null
  const score = engine.getScore()
  const written = { duration: state.selectedDuration, ...(state.selectedDots && { dots: state.selectedDots }) }

  // On a grace: the same group, right after it.
  const onGrace = graceHostId(score, caretId)
  if (onGrace) {
    const index = (graceGroupAt(score, caretId)?.index ?? -1) + 1
    return engine.grace.addGrace(onGrace, tool.side, spelling, tool.form, written, undefined, pendingArticulations(state), index)?.pitches[0].id ?? null
  }

  // Otherwise: the slot at the caret's next position in its lane — the one starting there, or the rest
  // it falls inside (a whole-bar rest, split at that beat).
  const bar = score.measures.find(m => m.number === target.measure)
  const lane = (bar ? getMeasureNotes(bar, score) : []).filter(n => voiceOf(n) === target.voice && staffOf(n) === target.staff)
  const starting = lane.find(n => fracEq(n.beat, target.beat))
  const covering = starting ?? lane.find(n => n.isRest && !fracLt(target.beat, n.beat)
    && fracToNumber(target.beat) < fracToNumber(n.beat) + durationToBeats(n.duration, n.dots ?? 0))
  if (!covering) return null
  return engine.grace.addGrace(
    covering.id, tool.side, spelling, tool.form, written,
    covering.isRest ? target.beat : undefined, pendingArticulations(state),
  )?.pitches[0].id ?? null
}

/**
 * ⭐ The stamp a caret on `noteId` CONTINUES — for a GRACE, the grace stamp in its group's form and side
 * (his ask, 2026-09-22: SPACE on a selected grace starts entry *"similar as with note … we inherit the
 * duration of the grace and its grace status"* — the value comes with the selection, like a note's).
 * Null for anything else: a note's entry arms nothing.
 */
export function continuingStamp(engine: MusicEngine, noteId: string): MarkingTool | null {
  const score = engine.getScore()
  const found = findSlot(score, noteId, { graceNotes: true })
  if (!found?.grace) return null
  const group = graceGroupAt(score, noteId)?.group
  return { kind: 'grace', form: group?.slash ? 'acciaccatura' : 'appoggiatura', side: found.grace.side }
}

/** The pitches of the grace `id` names — a grace chord's, so Shift+letter can stack above the highest. */
export function gracePitchesAt(engine: MusicEngine, id: string): PitchSpelling[] | null {
  const at = graceGroupAt(engine.getScore(), id)
  return at ? at.group.notes[at.index].pitches : null
}
