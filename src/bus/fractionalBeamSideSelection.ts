import { RequestChannel } from './requestChannel'

/**
 * The seam the Properties fractional-beam control publishes through — the twin of
 * {@link ./articulationStemAlignSelection}. **Command-only**: the window writes "point THIS note's
 * fractional beam <left|right|auto>" and {@link FractionalBeamSideController} — the one place that
 * holds the engine — applies it. No mirror channel: the control reads its current state from
 * `selectionInspection`, which it already subscribes to.
 */
import type { FractionalBeamSide } from '@/types/music'

export interface FractionalBeamSideRequest {
  /** The selected note id whose slot to set. */
  noteId: string
  /** ⭐ `null` clears the override, restoring the metric default — ⛔ never "a third side". */
  side: FractionalBeamSide | null
}

export const createFractionalBeamSideSelection = () => new RequestChannel<FractionalBeamSideRequest>()
