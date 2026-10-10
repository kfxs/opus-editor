/**
 * ⭐ **BRACKETED ACCIDENTALS' commands** (named `sign…` so the facade's one line names no element kind — `lint:hubs`) — the editor's half of an edit to an accidental's brackets: the
 * ops call and the undo entry. Reached as `engine.signEnclosure.<command>(…)`. What the brackets ARE,
 * and what refuses them, is `engine/models/accidentalEnclosureOps` (alteration-signs-plan K3).
 *
 * ⛔ No `mutate` on a refusal: an edit that changed nothing leaves no undo entry.
 */
import type { AccidentalEnclosure } from '@/types/music'
import {
  accidentalEnclosureOf, signEnclosureProblems, setAccidentalEnclosure, toggleAccidentalEnclosure,
} from '../models/accidentalEnclosureOps'
import type { CommandContext } from './commandContext'

export type SignEnclosureCommands = ReturnType<typeof signEnclosureCommands>

export function signEnclosureCommands(ctx: CommandContext) {
  const score = () => ctx.model().getScore()
  return {
    /** The brackets this pitch's accidental wears (undefined = none). */
    of: (pitchId: string): AccidentalEnclosure | undefined => accidentalEnclosureOf(score(), pitchId),

    /** Put `shape` round each pitch's accidental, or take the brackets off (`null`). ONE undo entry.
     *  @returns how many pitches changed. */
    set(pitchIds: readonly string[], shape: AccidentalEnclosure | null): number {
      const changed = setAccidentalEnclosure(score(), pitchIds, shape)
      if (changed) ctx.mutate(shape ? 'Bracket accidentals' : 'Remove accidental brackets')
      return changed
    },

    /** ⭐ The `Enter` key: any pitch without brackets ⇒ all get them; all with ⇒ all lose them. ONE undo
     *  entry. @returns what was written, or undefined when no id named a head (nothing recorded). */
    toggle(pitchIds: readonly string[], shape: AccidentalEnclosure = 'round'): AccidentalEnclosure | null | undefined {
      const before = pitchIds.map(id => accidentalEnclosureOf(score(), id))
      const next = toggleAccidentalEnclosure(score(), pitchIds, shape)
      if (next === undefined) return undefined
      if (pitchIds.some((id, i) => accidentalEnclosureOf(score(), id) !== before[i])) ctx.mutate(next ? 'Bracket accidentals' : 'Remove accidental brackets')
      return next
    },

    /** What a loaded file says that this build cannot draw — see `signEnclosureProblems`. */
    problems: (): string[] => signEnclosureProblems(score()),
  }
}
