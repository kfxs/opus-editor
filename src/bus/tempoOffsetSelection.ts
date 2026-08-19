/**
 * The seam the Properties **tempo mark offset** inputs publish through (his ask, 2026-08-19).
 *
 * {@link DynamicOffsetSelection}'s twin, and deliberately its exact shape — a command-only singleton
 * the window writes to, with {@link TempoOffsetController} (the one place that holds the engine)
 * doing the applying. The window stays a dumb publisher, which is the boundary the Properties panel
 * exists to defend: a content widget never holds the engine.
 *
 * ⭐ Two axes, like the dynamic's and unlike the note's: a tempo mark rides the row the ladder gives
 * it (`rendering/tempoLinePass`) and may be moved off it in either direction.
 */
export interface TempoOffsetRequest {
  /** The selected tempo mark's id. */
  tempoId: string
  /** The desired ABSOLUTE offset in staff-spaces (+right, +down). The controller turns it into the
   *  facade's relative nudge, `d = next − current`. */
  x: number
  y: number
}

export class TempoOffsetSelection {
  private listeners = new Set<(req: TempoOffsetRequest) => void>()

  /** Publish an absolute-offset request. ALWAYS fires (re-typing the same value is a real event —
   *  the controller decides it is a no-op), mirroring {@link DynamicOffsetSelection.set}. */
  set(tempoId: string, x: number, y: number): void {
    for (const fn of this.listeners) fn({ tempoId, x, y })
  }

  /** Handle a request — {@link TempoOffsetController} runs the engine apply. */
  onSet(fn: (req: TempoOffsetRequest) => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }
}

export const createTempoOffsetSelection = () => new TempoOffsetSelection()
