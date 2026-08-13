import type { TrillContinuationLabel } from '@/types/music'

/**
 * The seam the Properties trill control publishes through (docs/trill-plan.md §1 rule 6). The twin of
 * {@link ./fanEditSelection}: **command-only**, so the window writes "this trill should label its
 * continuations plainly" and {@link TrillEditController} — the one place that holds the engine —
 * applies it.
 *
 * No mirror channel, for the fan's reason: the control reads its CURRENT value from
 * `selectionInspection`, which it already subscribes to. The window stays a dumb publisher that
 * cannot reach the score.
 *
 * ⭐ A PARTIAL request, like the fan's, even though there is one field today. The trill has other
 * stored choices coming (§9: a user-chosen step, a per-trill speed), and a request shaped as
 * "the trill, plus whichever fields changed" absorbs them without every reader having to be told.
 */
export interface TrillEditRequest {
  /** The selected trill to change. */
  trillId: string
  /** How a continuation system labels it. Absent = leave it alone. */
  continuationLabel?: TrillContinuationLabel
}

export class TrillEditSelection {
  private listeners = new Set<(req: TrillEditRequest) => void>()

  /** Publish a change. ALWAYS fires (re-choosing the same value is a real event — the controller
   *  decides it is a no-op), mirroring `FanEditSelection.set`. */
  set(req: TrillEditRequest): void {
    for (const fn of this.listeners) fn(req)
  }

  /** Handle a change — {@link TrillEditController} runs the engine apply. */
  onSet(fn: (req: TrillEditRequest) => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }
}

export const createTrillEditSelection = () => new TrillEditSelection()
