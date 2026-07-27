/**
 * The seam the Properties note-offset input publishes through (client #12 — see
 * docs/note-offset-plan.md §B). A `PaletteSelection`-style singleton, but **command-only**: the
 * window writes "set the horizontal offset of THIS note/rest to X staff-spaces" and
 * {@link NoteOffsetController} — the one place that holds the engine — applies it.
 *
 * There is no highlight/mirror channel, unlike {@link PaletteSelection}: the input reads its CURRENT
 * value from `selectionInspection` (which it already subscribes to), so nothing needs mirroring back.
 * Keeping the window a dumb publisher is the whole point — a content widget never holds the engine,
 * the rule the Properties window defends.
 */
export interface NoteOffsetRequest {
  /** The selected note/rest id whose slot offset to set. */
  noteId: string
  /** The desired ABSOLUTE offset in staff-spaces (+right). The controller turns it into the facade's
   *  relative nudge, `dx = x − current`. */
  x: number
}

export class NoteOffsetSelection {
  private listeners = new Set<(req: NoteOffsetRequest) => void>()

  /** Publish an absolute-offset request. ALWAYS fires (re-typing the same value is a real event —
   *  the controller decides it's a no-op), mirroring {@link PaletteSelection.press}. */
  set(noteId: string, x: number): void {
    for (const fn of this.listeners) fn({ noteId, x })
  }

  /** Handle a request — {@link NoteOffsetController} runs the engine apply. */
  onSet(fn: (req: NoteOffsetRequest) => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }
}

export const createNoteOffsetSelection = () => new NoteOffsetSelection()
