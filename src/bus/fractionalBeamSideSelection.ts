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

class FractionalBeamSideSelection {
  private listeners = new Set<(req: FractionalBeamSideRequest) => void>()

  /** Publish a set request. ALWAYS fires (the controller decides a no-op), like the sibling seams. */
  set(noteId: string, side: FractionalBeamSide | null): void {
    for (const fn of this.listeners) fn({ noteId, side })
  }

  onSet(fn: (req: FractionalBeamSideRequest) => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }
}

export const createFractionalBeamSideSelection = () => new FractionalBeamSideSelection()
