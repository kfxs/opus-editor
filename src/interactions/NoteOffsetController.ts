import type { MusicEngine } from '../engine/MusicEngine'
import { noteOffsetSelection, type NoteOffsetRequest } from './noteOffsetSelection'
import { dbg } from '../utils/debug'

/**
 * Applies a Properties-panel note-offset request to the engine (client #12 — see
 * docs/note-offset-plan.md §B). The window is a **dumb publisher**: it writes an absolute `{noteId,
 * x}` to {@link noteOffsetSelection}, and this controller — the one place that holds `getEngine` —
 * turns it into the facade's relative nudge and repaints.
 *
 * The twin of the keyboard surface in `shortcutWiring` (which nudges by ±¼/1 staff-space); this is
 * the durable, precise input. Both land on the same `MusicEngine.nudgeNoteOffset`, so both save one
 * undo step per commit and read back through the same slot-keyed override.
 *
 * Owning the engine here (not in the window, and not inline in App.ts) keeps the boundary the window
 * defends: a content widget never holds the engine, and App.ts stays construction-only.
 */
export class NoteOffsetController {
  private unsubscribe: () => void

  constructor(
    private getEngine: () => MusicEngine | null,
    private renderScore: () => void,
  ) {
    this.unsubscribe = noteOffsetSelection.onSet((req) => this.apply(req))
  }

  private apply({ noteId, x }: NoteOffsetRequest): void {
    const engine = this.getEngine()
    if (!engine) return
    // Absolute → relative: the facade is a nudge, so a new absolute value is just the delta from the
    // current one (docs/note-offset-plan.md §B). No change → nothing to do (and no empty undo entry).
    const current = engine.getNoteOffset(noteId)
    const dx = x - current
    if (dx === 0) return
    if (!engine.nudgeNoteOffset(noteId, dx)) return
    this.renderScore()
    dbg(`[Note] Properties set offset ${noteId} → ${x} staff-space(s)`)
  }

  /** The subscription outlives no window — but dispose it when the app tears down, like every wire. */
  destroy(): void {
    this.unsubscribe()
  }
}
