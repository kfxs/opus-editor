import { RequestChannel } from './requestChannel'

/**
 * The seam the Properties fan inputs publish through (docs/plans/fanned-beams-plan.md §3, P4). The twin of
 * {@link ./noteOffsetSelection}: **command-only**, so the window writes "this fanned note should be
 * six notes with three beams" and {@link FanEditController} — the one place that holds the engine —
 * applies it.
 *
 * No highlight/mirror channel, for the same reason the note offset has none: the inputs read their
 * CURRENT values from `selectionInspection`, which they already subscribe to. Nothing needs mirroring
 * back, and the window stays a dumb publisher that cannot reach the score.
 *
 * A PARTIAL request, because the two numbers are edited one at a time — the controller merges it
 * into the fan the note is wearing. There is no "make a fan" here: the request only ever *changes*
 * one, so a note without one is a no-op. Creating and removing fans is the `accel.` / `rit.` press
 * (`PaletteController.pressFan`), and keeping the two apart is what stops an edit box from silently
 * inventing a notation.
 */
export interface FanEditRequest {
  /** The selected note whose fan to change. */
  noteId: string
  /** How many notes the group is played and drawn as. Absent = leave it alone. */
  count?: number
  /** Beam lines at the wide end. Absent = leave it alone. */
  beams?: number
  /**
   * ⭐ Which way the ramp runs (his ask, 2026-09-24: the direction switched in Properties). Absent = leave it
   * alone. ONE field of the mark, as the `accel.`/`rit.` keys turn a fan round — the members and shape stay.
   */
  direction?: 'accel' | 'rit'
  /**
   * Which member the feathering starts on and which it ends on — **0-based, like the model**
   * (docs/plans/fan-ramp-range-plan.md P2). Absent = leave it alone, the same as every field here.
   *
   * ⚠️ The window shows these **1-based** — "note 1" is the note he typed — and converts at the
   * widget. The conversion belongs there and nowhere else: the moment a seam carries a 1-based
   * index, every reader downstream has to remember which convention it is holding, and the one that
   * forgets is silent.
   */
  rampFrom?: number
  rampTo?: number
  /**
   * How far apart the wide end's beam lines stand, as a multiple of the ordinary gap (1 = the gap
   * stacked beams use, and the floor). Absent = leave it alone. Drawing only — see
   * {@link FanMark.spread}.
   */
  spread?: number
}

/** FanEditController handles it — the one place that holds the engine. */
export const createFanEditSelection = () => new RequestChannel<FanEditRequest>()
