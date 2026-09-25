/**
 * ⭐ **GLISSANDO commands** — the editor's half of an edit to a glissando: the ops call and the undo
 * entry. Reached as `engine.glissando.<command>(…)`. What a glissando IS, what refuses one and where it
 * goes is `engine/models/glissandoOps` (docs/plans/glissando-plan.md).
 *
 * ⛔ No `mutate` on a refusal: an edit that changed nothing leaves no undo entry.
 */
import { addGlissando, getGlissandoById, glissandoOn, removeGlissando } from '../models/glissandoOps'
import type { CommandContext } from './commandContext'

export type GlissandoCommands = ReturnType<typeof glissandoCommands>

export function glissandoCommands(ctx: CommandContext) {
  const score = () => ctx.model().getScore()
  return {
    /**
     * ⭐ The button: one glissando on EACH head that may carry one and has none yet (a chord is one line
     * per head — plan G9). ONE undo entry for the lot.
     * @returns how many were made.
     */
    add(pitchIds: readonly string[]): number {
      let made = 0
      for (const id of pitchIds) {
        if (glissandoOn(score(), id)) continue
        if (addGlissando(score(), id)) made++
      }
      if (made) ctx.mutate(made === 1 ? 'Glissando' : 'Glissandi')
      return made
    },

    /** Remove one. @returns false (and no undo entry) when there is none by that id. */
    remove(id: string): boolean {
      if (!removeGlissando(score(), id)) return false
      ctx.mutate('Remove glissando')
      return true
    },

    /** The glissando on this head, if any. */
    on: (pitchId: string) => glissandoOn(score(), pitchId),

    /** Find one by id. */
    byId: (id: string) => getGlissandoById(score(), id),
  }
}
