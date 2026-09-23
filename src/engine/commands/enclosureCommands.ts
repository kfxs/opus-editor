/**
 * ⭐ **PARENTHESISED NOTES' commands** — the editor's half of an edit to a head's brackets: the ops
 * call and the undo entry. Reached as `engine.enclosure.<command>(…)`. What the brackets ARE, and what
 * refuses them, is `engine/models/enclosureOps` (`docs/plans/parenthesised-note-plan.md` §2).
 *
 * ⛔ No `mutate` on a refusal: an edit that changed nothing leaves no undo entry.
 */
import type { HeadEnclosure } from '@/types/music'
import { enclosureOf, enclosureProblems, setEnclosure, toggleEnclosure } from '../models/enclosureOps'
import type { CommandContext } from './commandContext'

export type EnclosureCommands = ReturnType<typeof enclosureCommands>

export function enclosureCommands(ctx: CommandContext) {
  const score = () => ctx.model().getScore()
  return {
    /** The brackets this head wears (undefined = none). */
    of: (pitchId: string): HeadEnclosure | undefined => enclosureOf(score(), pitchId),

    /** Put `shape` on each head, or take the brackets off (`null`). ONE undo entry.
     *  @returns how many heads changed. */
    set(pitchIds: readonly string[], shape: HeadEnclosure | null): number {
      const changed = setEnclosure(score(), pitchIds, shape)
      if (changed) ctx.mutate(shape ? 'Parenthesise notes' : 'Remove parentheses')
      return changed
    },

    /**
     * ⭐ The button: any head without brackets ⇒ all get them; all with ⇒ all lose them
     * (`enclosureOps.toggleEnclosure`). ONE undo entry.
     * @returns what was written, or undefined when no id named a head (nothing recorded).
     */
    toggle(pitchIds: readonly string[], shape: HeadEnclosure = 'round'): HeadEnclosure | null | undefined {
      const before = pitchIds.map(id => enclosureOf(score(), id))
      const next = toggleEnclosure(score(), pitchIds, shape)
      if (next === undefined) return undefined
      if (pitchIds.some((id, i) => enclosureOf(score(), id) !== before[i])) ctx.mutate(next ? 'Parenthesise notes' : 'Remove parentheses')
      return next
    },

    /** What a loaded file says that this build cannot draw — see `enclosureProblems`. */
    problems: (): string[] => enclosureProblems(score()),
  }
}
