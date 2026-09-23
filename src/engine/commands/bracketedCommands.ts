/**
 * ⭐ **BRACKETED GRACES' commands** — the editor's half of an edit to one: the ops call and the undo
 * entry. Reached as `engine.bracketed.<command>(…)`. What a bracketed grace IS, and what it refuses,
 * is `engine/models/bracketedGraceOps` (`docs/plans/bracketed-grace-plan.md` §2).
 *
 * ⛔ No `mutate` on a refusal: an edit that changed nothing leaves no undo entry.
 */
import type { BracketedGrace, Fraction, NotePitch } from '@/types/music'
import { beatRestAt } from '../models/restGraceOps'
import type { BracketedSide } from '@/utils/bracketedGraces'
import {
  addBracketed, addBracketedPitch, bracketedProblems, findBracketed, isBracketedGrace, removeBracketed, setBracketedPitch,
  type BracketedSpelling, type FoundBracketed,
} from '../models/bracketedGraceOps'
import type { CommandContext } from './commandContext'

export type BracketedCommands = ReturnType<typeof bracketedCommands>

export function bracketedCommands(ctx: CommandContext) {
  const score = () => ctx.model().getScore()
  return {
    /**
     * Put a bracketed grace beside the target `targetNoteId` names — see {@link addBracketed}. ⭐ On a
     * whole-bar REST, `beat` (the click's) names the beat it belongs to: the rest becomes a one-beat rest
     * there first (`restGraceOps.beatRestAt`, the grace's rule), in the same undo entry.
     */
    add(targetNoteId: string, side: BracketedSide, spelling: BracketedSpelling, index?: number, beat?: Fraction): BracketedGrace | null {
      const target = beat ? beatRestAt(score(), targetNoteId, beat)?.id ?? targetNoteId : targetNoteId
      const made = addBracketed(score(), target, side, spelling, index)
      if (made) ctx.mutate('Add bracketed grace')
      return made
    },

    /** A second head in a bracketed grace — see {@link addBracketedPitch}. */
    addPitch(bracketedPitchId: string, spelling: BracketedSpelling): NotePitch | null {
      const made = addBracketedPitch(score(), bracketedPitchId, spelling)
      if (made) ctx.mutate('Add bracketed pitch')
      return made
    },

    /** Take bracketed pitches out — ONE undo entry for all of them. @see removeBracketed */
    remove(pitchIds: readonly string[]): boolean {
      let changed = false
      for (const id of pitchIds) changed = removeBracketed(score(), id) || changed
      if (changed) ctx.mutate('Delete bracketed grace')
      return changed
    },

    /** Re-spell a bracketed pitch in place — see {@link setBracketedPitch}. */
    setPitch(pitchId: string, spelling: BracketedSpelling): boolean {
      const changed = setBracketedPitch(score(), pitchId, spelling)
      if (changed) ctx.mutate('Bracketed pitch')
      return changed
    },

    /** Is this id a bracketed grace's pitch? */
    isBracketed: (pitchId: string): boolean => isBracketedGrace(score(), pitchId),
    /** Where a bracketed pitch lives. */
    find: (pitchId: string): FoundBracketed | null => findBracketed(score(), pitchId),
    /** What a loaded file says that this build cannot hold (report, never repair). */
    problems: (): string[] => bracketedProblems(score()),
  }
}
