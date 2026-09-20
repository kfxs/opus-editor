import { RequestChannel } from './requestChannel'
import type { TrillContinuationLabel } from '@/types/music'

/**
 * The seam the Properties trill control publishes through (docs/plans/trill-plan.md §1 rule 6). The twin of
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

/** TrillEditController handles it — the one place that holds the engine. */
export const createTrillEditSelection = () => new RequestChannel<TrillEditRequest>()
