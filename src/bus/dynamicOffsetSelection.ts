import { RequestChannel } from './requestChannel'

/**
 * The seam the Properties **dynamic/expression offset** inputs publish through (his ask, 2026-08-17:
 * *"we also should be able to control the offset of expression (dynamics) on the properties"*).
 *
 * {@link ./noteOffsetSelection}'s twin, and deliberately its exact shape — a command-only singleton the
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

/** DynamicOffsetController handles it — the one place that holds the engine. */
export const createDynamicOffsetSelection = () => new RequestChannel<DynamicOffsetRequest>()
