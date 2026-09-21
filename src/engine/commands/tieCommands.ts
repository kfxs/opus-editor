/**
 * ⭐ **A TIE's commands** — the editor's half of an edit to one: the ops call, the LIMIT that may
 * refuse a hand-nudge, the undo entry. Reached as `engine.tie.<command>(…)`. What a tie IS — which
 * note it may join, its repair — is `engine/models/tieOps`.
 *
 * ⚠️ A tie is addressed by the pitch it comes FROM: it has no id of its own (`tiedTo` on that pitch).
 *
 * `flipTie` moved here from `MusicEngine` unchanged (2026-09-21) when the vertical nudge arrived:
 * a second command for the family is the moment it gets its module, ⛔ not a second facade method.
 */
import { nudgeTieOffset, resetTieOffset } from '../models/tieOps'
import type { CommandContext } from './commandContext'

export type TieCommands = ReturnType<typeof tieCommands>

export function tieCommands(ctx: CommandContext) {
  /** Every drawn arc of this tie — two, across a system break. */
  const drawn = (fromNoteId: string) =>
    (ctx.registry().getByType?.('tie') ?? []).filter(el => el.fromNoteId === fromNoteId)

  return {
    /**
     * Flip a tie's curve direction (Sibelius-style `x` toggle), keyed by its from-note id. A tie
     * stays flat and notehead-anchored, so this only inverts the arc (and its endpoint lift). When
     * the tie already carries an explicit `tieDirection`, clear it back to the auto default;
     * otherwise pin the opposite of whatever was last DRAWN (read from the registry), so the first
     * press always visibly flips. Two presses round-trip to auto.
     * @returns true if it flipped.
     */
    flipTie(fromNoteId: string): boolean {
      const pitch = ctx.model().getNotePitch(fromNoteId)
      if (!pitch || !pitch.tiedTo) return false
      if (pitch.tieDirection !== undefined) {
        ctx.model().clearTieDirection(fromNoteId)
        ctx.mutate('Reset tie to auto')
        return true
      }
      // Auto → pin the opposite of the last-drawn side; a headless registry falls back to "down".
      const currentDir = drawn(fromNoteId)[0]?.tieDirection ?? 1
      if (!ctx.model().setTieDirection(fromNoteId, currentDir === -1 ? 1 : -1)) return false
      ctx.mutate('Flip tie')
      return true
    },

    /**
     * Move the arc up or down by `dy` SCREEN staff spaces (+ is down) — the arrows on a selected
     * tie. ⛔ Vertical only: its ends are its noteheads. Refused, with nothing written, when the arc
     * would leave its staff's band for a neighbour's room — the family's limit, judged on the
     * drawn ink (`limits.nudgeStaysInBand`).
     */
    nudgeTie(fromNoteId: string, dy: number): boolean {
      if (dy === 0) return false
      const arcs = drawn(fromNoteId)
      const home = ctx.model().getNote(fromNoteId)
      if (arcs.length && home && !ctx.limits.nudgeStaysInBand(arcs.map(a => a.bbox), home.measure, home.staff ?? 0, dy)) {
        return false
      }
      if (!nudgeTieOffset(ctx.model().getScore(), fromNoteId, dy)) return false
      ctx.mutate('Nudge tie')
      return true
    },

    /** Back to the engraver's place. False when it was never moved. */
    resetTieOffset(fromNoteId: string): boolean {
      if (!resetTieOffset(ctx.model().getScore(), fromNoteId)) return false
      ctx.mutate('Reset tie position')
      return true
    },
  }
}
