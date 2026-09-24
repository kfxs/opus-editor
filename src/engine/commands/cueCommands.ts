/**
 * ⭐ **CUE-SIZE notes' commands** — the editor's half of an edit to a note's size: the ops call and the
 * undo entry. Reached as `engine.cue.<command>(…)`. What cue size IS, and what it applies to, is
 * `engine/models/cueOps` (`docs/plans/cue-size-plan.md` §2).
 *
 * ⛔ No `mutate` on a refusal: an edit that changed nothing leaves no undo entry.
 */
import { cueProblems, isCue, setCue, toggleCue } from '../models/cueOps'
import type { CommandContext } from './commandContext'

export type CueCommands = ReturnType<typeof cueCommands>

export function cueCommands(ctx: CommandContext) {
  const score = () => ctx.model().getScore()
  return {
    /** Whether what this id names is drawn at cue size. */
    of: (id: string): boolean => isCue(score(), id),

    /** Cue size on (`true`) or off for each. ONE undo entry. @returns how many changed. */
    set(ids: readonly string[], on: boolean): number {
      const changed = setCue(score(), ids, on)
      if (changed) ctx.mutate(on ? 'Cue size' : 'Full size')
      return changed
    },

    /**
     * ⭐ The button: any full-size note ⇒ all become cue; all cue ⇒ all full (`cueOps.toggleCue`).
     * ONE undo entry. @returns what was written, or undefined when no id named a note.
     */
    toggle(ids: readonly string[]): boolean | undefined {
      const before = ids.map(id => isCue(score(), id))
      const next = toggleCue(score(), ids)
      if (next === undefined) return undefined
      if (ids.some((id, i) => isCue(score(), id) !== before[i])) ctx.mutate(next ? 'Cue size' : 'Full size')
      return next
    },

    /** What a loaded file says that this build does not write — see `cueProblems`. */
    problems: (): string[] => cueProblems(score()),
  }
}
