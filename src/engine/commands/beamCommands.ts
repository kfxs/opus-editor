/**
 * ⭐ **A BEAM's commands** — the editor's half of an edit to one: the ops call, the LIMIT that may refuse a
 * hand-nudge, the undo entry. Reached as `engine.beam.<command>(…)`. What the edit WRITES is
 * `engine/models/beamOffsetOps`.
 *
 * ⚠️ A beam is addressed by the pitch a selected beam is anchored on — its group's first note (`beamGroup`).
 */
import { type BeamEnd, beamOffsetOf, nudgeBeamOffset, resetBeamOffset, setBeamEndOffset, setBeamOffset } from '../models/beamOffsetOps'
import { beamBodyDragFloor, beamEndDragFloor, beamGroupStems, beamStandsAbove } from '../layout/beamStemFloor'
import type { CommandContext } from './commandContext'

export type BeamCommands = ReturnType<typeof beamCommands>

export function beamCommands(ctx: CommandContext) {
  /** Every drawn line of this beam (`rendering/beams/beamHitInk`). */
  const drawn = (anchorNoteId: string) =>
    (ctx.registry().getByType?.('beamGroup') ?? []).filter(el => el.noteId === anchorNoteId)

  /** Which side the beam stands on, from what was drawn — true (above its stems) when nothing is. */
  const standsAbove = (anchorNoteId: string) => {
    const lines = drawn(anchorNoteId)
    return beamStandsAbove(lines, beamGroupStems(lines, ctx.registry().getByType?.('stem') ?? []))
  }
  /** A SCREEN step (+ down) as a step AWAY from the heads — screen-up is away for a beam above its stems. */
  const awayOf = (anchorNoteId: string, dy: number) => (standsAbove(anchorNoteId) ? -dy : dy)

  /**
   * ⭐ THE ONE STEP every beam edit takes — `dAway` staff spaces away from the heads, for ONE end (`which`) or the
   * whole beam. Refused, with nothing written, when the beam would leave its staff's band for a neighbour's room (the
   * tie's limit, on the drawn lines) or when a stem would go under its floor (`layout/beamStemFloor` — the shortest
   * stem for the whole beam, the tightest weighted stem for one end — read off the stems as drawn now).
   */
  const step = (anchorNoteId: string, which: BeamEnd | undefined, dAway: number, description: string): boolean => {
    if (dAway === 0) return false
    const lines = drawn(anchorNoteId)
    const stems = ctx.registry().getByType?.('stem') ?? []
    const dy = beamStandsAbove(lines, beamGroupStems(lines, stems)) ? -dAway : dAway
    const home = ctx.model().getNote(anchorNoteId)
    if (lines.length && home && !ctx.limits.nudgeStaysInBand(lines.map(l => l.bbox), home.measure, home.staff ?? 0, dy)) {
      return false
    }
    const spacePx = lines.length ? ctx.registry().getStaffGeometry?.(lines[0].measure ?? 0, lines[0].staff ?? 0)?.lineSpacing : undefined
    if (spacePx) {
      const floor = which ? beamEndDragFloor(lines, stems, spacePx, which) : beamBodyDragFloor(lines, stems, spacePx)
      if (dAway < floor - 1e-9) return false
    }
    const score = ctx.model().getScore()
    const wrote = which
      ? setBeamEndOffset(score, anchorNoteId, which, beamOffsetOf(score, anchorNoteId)[which] + dAway)
      : nudgeBeamOffset(score, anchorNoteId, dAway)
    if (!wrote) return false
    ctx.mutate(description)
    return true
  }

  return {
    /**
     * Move the beam up or down by `dy` SCREEN staff spaces (+ is down) — the arrows on a selected beam (his ask,
     * 2026-09-28). Its stems follow it. Stored RELATIVE to the stems (+ = away from the heads), so a flip keeps its
     * meaning (his report). Refused past the band limit or the stem floor — see `step`.
     */
    nudgeBeam(anchorNoteId: string, dy: number): boolean {
      return dy !== 0 && step(anchorNoteId, undefined, awayOf(anchorNoteId, dy), 'Nudge beam')
    },

    /**
     * Move ONE END by `dy` SCREEN staff spaces (+ is down) — the arrows on a picked square (his ask, 2026-09-28: the
     * square reacted to a drag but not to the arrows). The other end stays, so the ANGLE changes.
     */
    nudgeBeamEnd(anchorNoteId: string, which: BeamEnd, dy: number): boolean {
      return dy !== 0 && step(anchorNoteId, which, awayOf(anchorNoteId, dy), 'Angle beam')
    },

    /** Move the whole beam `dAway` staff spaces AWAY from the heads — the Properties box (his ask, 2026-09-28). */
    shiftBeam(anchorNoteId: string, dAway: number): boolean {
      return step(anchorNoteId, undefined, dAway, 'Move beam')
    },

    /** Move ONE end `dAway` staff spaces AWAY from the heads — the Properties box for that end (the angle). */
    shiftBeamEnd(anchorNoteId: string, which: BeamEnd, dAway: number): boolean {
      return step(anchorNoteId, which, dAway, 'Angle beam')
    },

    /** Where each end stands now, staff spaces AWAY from the heads — what a square's drag starts from. */
    offsetOf(anchorNoteId: string): { start: number; end: number } {
      return beamOffsetOf(ctx.model().getScore(), anchorNoteId)
    },

    /**
     * A FRAME of a square's drag: set ONE end to `away` (the other stays — the ANGLE changes). No undo entry — the
     * drop's {@link commitBeamEndDrag} records the gesture once. The floor is the drag's to clamp to, read once at
     * the press (`layout/beamStemFloor.beamEndDragFloor`): a frame may not read its own outcome.
     */
    previewBeamEnd(anchorNoteId: string, which: BeamEnd, away: number): boolean {
      if (!setBeamEndOffset(ctx.model().getScore(), anchorNoteId, which, away)) return false
      ctx.markDirty()
      return true
    },

    /** The ONE undo entry for a square's drag, on the drop. */
    commitBeamEndDrag(): void {
      ctx.commitPreviewed('Angle beam')
    },

    /**
     * A FRAME of a whole-beam drag (his ask, 2026-09-28: the arrows' offset, by dragging): set BOTH ends — the angle
     * kept. No undo entry — the drop's {@link commitBeamDrag} records the gesture once.
     */
    previewBeamOffset(anchorNoteId: string, start: number, end: number): boolean {
      if (!setBeamOffset(ctx.model().getScore(), anchorNoteId, start, end)) return false
      ctx.markDirty()
      return true
    },

    /** The ONE undo entry for a whole-beam drag, on the drop. */
    commitBeamDrag(): void {
      ctx.commitPreviewed('Move beam')
    },

    /** Back to the engraver's place. False when it was never moved. */
    resetBeamOffset(anchorNoteId: string): boolean {
      if (!resetBeamOffset(ctx.model().getScore(), anchorNoteId)) return false
      ctx.mutate('Reset beam position')
      return true
    },
  }
}
