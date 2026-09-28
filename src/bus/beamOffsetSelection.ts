import { RequestChannel } from './requestChannel'

/**
 * The seam the Properties **beam** boxes publish through (his ask, 2026-09-28: *"the offset… and the endpoint
 * control… in the properties"*) — the tuplet offset's shape: a command-only singleton the window writes ABSOLUTE
 * values to, and {@link BeamOffsetController} (the one place that holds the engine) turns them into the beam
 * commands' relative steps. The window stays a dumb publisher.
 *
 * In staff spaces AWAY from the noteheads (+ = longer stems) — the arrows' and the drags' own meaning. A request
 * names the whole beam (`middle`, both ends moved by the same amount — the angle kept) or ONE end (`start` / `end`).
 */
export type BeamOffsetRequest =
  | { anchorNoteId: string; middle: number }
  | { anchorNoteId: string; start: number }
  | { anchorNoteId: string; end: number }

/** BeamOffsetController handles it — the one place that holds the engine. */
export const createBeamOffsetSelection = () => new RequestChannel<BeamOffsetRequest>()
