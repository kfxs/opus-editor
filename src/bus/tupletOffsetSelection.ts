import { RequestChannel } from './requestChannel'

/**
 * The seam the Properties **tuplet offset** box publishes through (his ask, 2026-09-25) —
 * {@link ./tempoOffsetSelection}'s shape on ONE axis: a command-only singleton the window writes an ABSOLUTE
 * value to, and {@link TupletOffsetController} (the one place that holds the engine) turns it into the
 * facade's relative nudge. The window stays a dumb publisher.
 */
export interface TupletOffsetRequest {
  tupletId: string
  /** The desired ABSOLUTE vertical offset in staff-spaces, SCREEN-signed (+ down). */
  y: number
}

/** TupletOffsetController handles it — the one place that holds the engine. */
export const createTupletOffsetSelection = () => new RequestChannel<TupletOffsetRequest>()
