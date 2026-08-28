/**
 * The seam the Properties CLEF-offset input publishes through (his ask, 2026-08-28: *"when the clef
 * is not in the beguining of a line (i mean a header clef) i want to be able to offset it
 * horizontally either by keys in the keyboard or be the property"*).
 *
 * {@link ./noteOffsetSelection} verbatim in shape and for its reason: **command-only**, so the window
 * writes *"set the horizontal offset of THIS clef to X staff-spaces"* and `ClefOffsetController` —
 * the one place that holds the engine — applies it. There is no mirror channel: the input reads its
 * current value from `selectionInspection`, which it already subscribes to.
 *
 * ⚠️ The address is POSITIONAL (measure, beat, staff), unlike the note's id — a clef selection is a
 * position (`SelectedElement`'s `clef`), and the engine resolves it to the change's own id, which is
 * what the override is keyed by.
 */
export interface ClefOffsetRequest {
  measure: number
  /** Beat within the measure, as the selection carries it (0 = the bar's opening clef). */
  beat: number
  staff: number
  /** The desired ABSOLUTE offset in staff-spaces (+right). The controller turns it into the facade's
   *  relative nudge, `dx = x − current`. */
  x: number
}

export class ClefOffsetSelection {
  private listeners = new Set<(req: ClefOffsetRequest) => void>()

  /** Publish an absolute-offset request. ALWAYS fires — re-typing the same value is a real event and
   *  the controller decides it is a no-op (`NoteOffsetSelection.set`'s rule). */
  set(measure: number, beat: number, staff: number, x: number): void {
    for (const fn of this.listeners) fn({ measure, beat, staff, x })
  }

  /** Handle a request — `ClefOffsetController` runs the engine apply. */
  onSet(fn: (req: ClefOffsetRequest) => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }
}

export const createClefOffsetSelection = () => new ClefOffsetSelection()
