/**
 * ⭐ **A BEAM's commands** — the editor's half of an edit to one: the ops call, the LIMIT that may refuse a
 * hand-nudge, the undo entry. Reached as `engine.beam.<command>(…)`. What the edit WRITES is
 * `engine/models/beamOffsetOps`.
 *
 * ⚠️ A beam is addressed by the pitch a selected beam is anchored on — its group's first note (`beamGroup`).
 */
import { nudgeBeamOffset, resetBeamOffset } from '../models/beamOffsetOps'
import { beamGroupStems, beamNudgeKeepsStems, beamStandsAbove } from '../layout/beamStemFloor'
import type { CommandContext } from './commandContext'

export type BeamCommands = ReturnType<typeof beamCommands>

export function beamCommands(ctx: CommandContext) {
  /** Every drawn line of this beam (`rendering/beams/beamHitInk`). */
  const drawn = (anchorNoteId: string) =>
    (ctx.registry().getByType?.('beamGroup') ?? []).filter(el => el.noteId === anchorNoteId)

  return {
    /**
     * Move the beam up or down by `dy` SCREEN staff spaces (+ is down) — the arrows on a selected beam (his ask,
     * 2026-09-28). Its stems follow it. Refused, with nothing written, when the beam would leave its staff's band
     * for a neighbour's room — the tie's limit, judged on the beam's drawn lines (`limits.nudgeStaysInBand`) — or
     * when it would push the group's shortest stem under its floor (`layout/beamStemFloor`: seen in Chromium, the
     * first cut let the beam go THROUGH the noteheads).
     */
    nudgeBeam(anchorNoteId: string, dy: number): boolean {
      if (dy === 0) return false
      const lines = drawn(anchorNoteId)
      const home = ctx.model().getNote(anchorNoteId)
      if (lines.length && home && !ctx.limits.nudgeStaysInBand(lines.map(l => l.bbox), home.measure, home.staff ?? 0, dy)) {
        return false
      }
      const stems = ctx.registry().getByType?.('stem') ?? []
      const spacePx = lines.length ? ctx.registry().getStaffGeometry?.(lines[0].measure ?? 0, lines[0].staff ?? 0)?.lineSpacing : undefined
      if (spacePx && !beamNudgeKeepsStems(lines, stems, spacePx, dy)) return false
      // ⭐ Stored RELATIVE to the stems (+ = away from the heads), so a flip keeps its meaning (his report): screen-up
      //    is "away" for a beam standing above its stems, "toward" for one below them.
      const dAway = beamStandsAbove(lines, beamGroupStems(lines, stems)) ? -dy : dy
      if (!nudgeBeamOffset(ctx.model().getScore(), anchorNoteId, dAway)) return false
      ctx.mutate('Nudge beam')
      return true
    },

    /** Back to the engraver's place. False when it was never moved. */
    resetBeamOffset(anchorNoteId: string): boolean {
      if (!resetBeamOffset(ctx.model().getScore(), anchorNoteId)) return false
      ctx.mutate('Reset beam position')
      return true
    },
  }
}
