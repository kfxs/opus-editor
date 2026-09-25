/**
 * ⭐ **GLISSANDO commands** — the editor's half of an edit to a glissando: the ops call and the undo
 * entry. Reached as `engine.glissando.<command>(…)`. What a glissando IS, what refuses one and where it
 * goes is `engine/models/glissandoOps` (docs/plans/glissando-plan.md).
 *
 * ⛔ No `mutate` on a refusal: an edit that changed nothing leaves no undo entry.
 */
import {
  addGlissando, getGlissandoById, glissandoOn, glissandoTarget, mayAnchorGlissando, removeGlissando, setGlissandoDirection, setGlissandoEnd, setGlissandoSide,
  setGlissandoText,
} from '../models/glissandoOps'
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

    /**
     * ⭐ The BUTTON (his ask, 2026-09-25: *"if a note that has a gliss is selected we have to be able to toggle
     * off the gliss in the palette"*) — the brackets' rule: any head WITHOUT one ⇒ all get one; all WITH one ⇒
     * all lose theirs. ONE undo entry. @returns what it did, or null when no id named a head that may carry one.
     */
    toggle(pitchIds: readonly string[]): 'added' | 'removed' | null {
      const heads = pitchIds.filter(id => glissandoOn(score(), id) || mayAnchorGlissando(score(), id))
      if (!heads.length) return null
      if (heads.every(id => glissandoOn(score(), id))) {
        for (const id of heads) removeGlissando(score(), glissandoOn(score(), id)!.id)
        ctx.mutate(heads.length === 1 ? 'Remove glissando' : 'Remove glissandi')
        return 'removed'
      }
      let made = 0
      for (const id of heads) if (!glissandoOn(score(), id) && addGlissando(score(), id)) made++
      if (made) ctx.mutate(made === 1 ? 'Glissando' : 'Glissandi')
      return 'added'
    },

    /** Remove one. @returns false (and no undo entry) when there is none by that id. */
    remove(id: string): boolean {
      if (!removeGlissando(score(), id)) return false
      ctx.mutate('Remove glissando')
      return true
    },

    /** ⭐ P3 — the SIDE of each of these glissandi (G3): `before` = into its note from nothing. ONE undo entry;
     *  none when nothing changed. @returns how many changed. */
    setSide(ids: readonly string[], side: 'before' | 'after'): number {
      const changed = ids.filter(id => setGlissandoSide(score(), id, side)).length
      if (changed) ctx.mutate(side === 'before' ? 'Glissando into the note' : 'Glissando out of the note')
      return changed
    },

    /** ⭐ P3 — a free end on purpose (`none`) or back to the next note (`next`) (G5). ONE undo entry. */
    setEnd(ids: readonly string[], end: 'none' | 'next'): number {
      const changed = ids.filter(id => setGlissandoEnd(score(), id, end)).length
      if (changed) ctx.mutate(end === 'none' ? 'Glissando to nothing' : 'Glissando to the next note')
      return changed
    },

    /** ⭐ P3 — a free end's direction (G11). ONE undo entry. */
    setDirection(ids: readonly string[], direction: 'up' | 'down'): number {
      const changed = ids.filter(id => setGlissandoDirection(score(), id, direction)).length
      if (changed) ctx.mutate(direction === 'up' ? 'Glissando up' : 'Glissando down')
      return changed
    },

    /** ⭐ The word along the line (`gliss.`, `port.`, …); blank = none. ONE undo entry. */
    setText(ids: readonly string[], text: string | null): number {
      const changed = ids.filter(id => setGlissandoText(score(), id, text)).length
      if (changed) ctx.mutate(text?.trim() ? 'Glissando text' : 'Remove glissando text')
      return changed
    },

    /** The glissando on this head, if any. */
    on: (pitchId: string) => glissandoOn(score(), pitchId),

    /** Find one by id. */
    byId: (id: string) => getGlissandoById(score(), id),

    /** Where it goes RIGHT NOW (derived — G4): the target head's id, or null for a free end. */
    targetOf: (id: string): string | null => {
      const g = getGlissandoById(score(), id)
      return g ? glissandoTarget(score(), g) : null
    },
  }
}
