import { RequestChannel } from './requestChannel'

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

/** NoteOffsetController handles it — the one place that holds the engine. */
export const createNoteOffsetSelection = () => new RequestChannel<NoteOffsetRequest>()
