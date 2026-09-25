import { RequestChannel } from './requestChannel'
import type { TupletFormatEdit } from '@/engine/models/tupletOps'

/**
 * The seam the Properties **tuplet format** controls publish through (his ask, 2026-09-25: *"the user should
 * be able to select for the brackets: auto, show, hide"*, then *"the other formats that we have for the tuplet
 * in the tuplet palette should be able to reconfigure manually by the user in the properties"*). The twin of
 * {@link ./barlineEditSelection}: **command-only** — the window writes *"this tuplet's bracket is `never`"* and
 * {@link TupletEditController}, the one place that holds the engine, applies it. The control reads its CURRENT
 * value from `selectionInspection`, so the window stays a dumb publisher that cannot reach the score.
 * ⚠️ A PARTIAL request, like the barline's: three controls on one selection, each publishing only what it
 * changed. ⚠️ The fields are `TupletFormatEdit`, ⛔ not a copy: the ENGINE owns the vocabulary.
 * ⛔ A CONTENT edit — what the group is drawn WITH — so it takes an undo entry, like the barline's sign.
 */
export interface TupletEditRequest extends TupletFormatEdit {
  tupletId: string
}

/** TupletEditController handles it — the one place that holds the engine. */
export const createTupletEditSelection = () => new RequestChannel<TupletEditRequest>()
