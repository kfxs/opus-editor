import { RequestChannel } from './requestChannel'

/**
 * The seam the Properties "align to stem" checkbox publishes through — the twin of
 * {@link ./noteOffsetSelection}. **Command-only**: the window writes "set stem-alignment of THIS
 * note's articulations to <on/off>" and {@link ArticulationStemAlignController} — the one place that
 * holds the engine — applies it. No mirror channel: the checkbox reads its current state from
 * `selectionInspection`, which it already subscribes to. Keeps the window a dumb publisher.
 */
export interface ArticulationStemAlignRequest {
  /** The selected note id whose slot flag to set. */
  noteId: string
  /** Desired state: true = stem-side marks align to the stem; false = notehead (default). */
  align: boolean
}

export const createArticulationStemAlignSelection = () => new RequestChannel<ArticulationStemAlignRequest>()
