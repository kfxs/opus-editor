/**
 * The seam the Properties fan inputs publish through (docs/fanned-beams-plan.md §3, P4). The twin of
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
   * Which member the feathering starts on and which it ends on — **0-based, like the model**
   * (docs/fan-ramp-range-plan.md P2). Absent = leave it alone, the same as every field here.
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

export class FanEditSelection {
  private listeners = new Set<(req: FanEditRequest) => void>()

  /** Publish a change. ALWAYS fires (re-typing the same value is a real event — the controller
   *  decides it is a no-op), mirroring `PaletteSelection.press`. */
  set(req: FanEditRequest): void {
    for (const fn of this.listeners) fn(req)
  }

  /** Handle a change — {@link FanEditController} runs the engine apply. */
  onSet(fn: (req: FanEditRequest) => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }
}

export const createFanEditSelection = () => new FanEditSelection()
