/**
 * ⭐ **GRACE NOTES' commands** — the editor's half of an edit to one: the ops call and the undo entry.
 * Reached as `engine.grace.<command>(…)`. What a grace IS, and what it refuses, is
 * `engine/models/graceOps` (`docs/plans/grace-notes-plan.md` §2).
 *
 * ⛔ No `mutate` on a refusal: an edit that changed nothing leaves no undo entry.
 */
import { addGrace, type GraceForm, type GraceSpelling, type GraceWritten } from '../models/graceOps'
import type { ArticulationType, Fraction, GraceNote, GraceSide } from '@/types/music'
import { beatRestAt } from '../models/restGraceOps'
import type { CommandContext } from './commandContext'

export type GraceCommands = ReturnType<typeof graceCommands>

export function graceCommands(ctx: CommandContext) {
  return {
    /**
     * Hang a grace of `spelling` on the slot holding `hostNoteId` — a chord, or a REST (D7 reversed) —
     * see {@link addGrace}. ⭐ On a whole-bar rest, `beat` (the click's) names the beat it belongs to:
     * the rest becomes a one-beat rest there first (`restGraceOps.beatRestAt`), in the same undo entry.
     */
    addGrace(
      hostNoteId: string, side: GraceSide, spelling: GraceSpelling, form: GraceForm, written: GraceWritten, beat?: Fraction,
      /** The articulations armed for it — note entry's, in the same undo entry. */
      marks?: ArticulationType[],
    ): GraceNote | null {
      const score = ctx.model().getScore()
      const host = beat ? beatRestAt(score, hostNoteId, beat)?.id ?? hostNoteId : hostNoteId
      const grace = addGrace(score, host, side, spelling, form, written)
      if (!grace) return null
      if (marks?.length) grace.articulations = [...marks]
      ctx.mutate(form === 'acciaccatura' ? 'Add acciaccatura' : 'Add appoggiatura')
      return grace
    },
  }
}
