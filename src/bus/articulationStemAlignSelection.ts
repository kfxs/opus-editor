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

export class ArticulationStemAlignSelection {
  private listeners = new Set<(req: ArticulationStemAlignRequest) => void>()

  /** Publish a set request. ALWAYS fires (the controller decides a no-op), like the offset seam. */
  set(noteId: string, align: boolean): void {
    for (const fn of this.listeners) fn({ noteId, align })
  }

  onSet(fn: (req: ArticulationStemAlignRequest) => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }
}

export const createArticulationStemAlignSelection = () => new ArticulationStemAlignSelection()
