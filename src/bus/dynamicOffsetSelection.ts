/**
 * The seam the Properties **dynamic/expression offset** inputs publish through (his ask, 2026-08-17:
 * *"we also should be able to control the offset of expression (dynamics) on the properties"*).
 *
 * {@link NoteOffsetSelection}'s twin, and deliberately its exact shape — a command-only singleton the
 * window writes to, with {@link DynamicOffsetController} (the one place that holds the engine) doing
 * the applying. The window stays a dumb publisher, which is the boundary the Properties panel exists
 * to defend: a content widget never holds the engine.
 *
 * ⭐ **TWO axes here where the note has one**, and that is the mark's own difference rather than a
 * richer control: a note's offset is horizontal only (its vertical is its PITCH), while a dynamic
 * rides the dynamics line and may be lifted off it.
 */
export interface DynamicOffsetRequest {
  /** The selected dynamic/expression id whose offset to set. */
  dynamicId: string
  /** The desired ABSOLUTE offset in staff-spaces (+right, +down). The controller turns it into the
   *  facade's relative nudge, `d = next − current`. */
  x: number
  y: number
}

export class DynamicOffsetSelection {
  private listeners = new Set<(req: DynamicOffsetRequest) => void>()

  /** Publish an absolute-offset request. ALWAYS fires (re-typing the same value is a real event —
   *  the controller decides it is a no-op), mirroring {@link NoteOffsetSelection.set}. */
  set(dynamicId: string, x: number, y: number): void {
    for (const fn of this.listeners) fn({ dynamicId, x, y })
  }

  /** Handle a request — {@link DynamicOffsetController} runs the engine apply. */
  onSet(fn: (req: DynamicOffsetRequest) => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }
}

export const createDynamicOffsetSelection = () => new DynamicOffsetSelection()
