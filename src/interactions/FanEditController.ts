import type { MusicEngine } from '../engine/MusicEngine'
import { fanEditSelection, type FanEditRequest } from './fanEditSelection'
import { clampFanBeams, clampFanCount } from '../utils/fannedBeam'
import { dbg } from '../utils/debug'

/**
 * Applies a Properties-panel fan edit to the engine (docs/fanned-beams-plan.md §3, P4). The window is
 * a **dumb publisher**: it writes `{noteId, count?, beams?}` to {@link fanEditSelection}, and this
 * controller — the one place that holds `getEngine` — merges it into the fan the note is wearing and
 * repaints.
 *
 * ⭐ It CHANGES a fan, it never makes one. A note with no fan is a no-op: creating and removing them
 * is the `accel.` / `rit.` press, which is also where the direction lives. Two surfaces, one for
 * "is this note a fan" and one for "what shape is it" — an edit box that could conjure a notation
 * out of a typed number would be a third answer to a question already settled.
 *
 * The same shape as {@link NoteOffsetController}, and for the same boundary reason: a content widget
 * never holds the engine, and App.ts stays construction-only.
 */
export class FanEditController {
  private unsubscribe: () => void

  constructor(
    private getEngine: () => MusicEngine | null,
    private renderScore: () => void,
  ) {
    this.unsubscribe = fanEditSelection.onSet((req) => this.apply(req))
  }

  private apply({ noteId, count, beams }: FanEditRequest): void {
    const engine = this.getEngine()
    if (!engine) return
    const current = engine.getNote(noteId)?.fan
    if (!current) return // nothing to change — see the class note

    const next = {
      direction: current.direction,
      count: clampFanCount(count ?? current.count),
      beams: clampFanBeams(beams ?? current.beams),
    }
    // No change → no edit, and no empty undo entry (the rule `NoteOffsetController` follows).
    if (next.count === current.count && next.beams === current.beams) return

    // `runBatch` for the undo entry, `setFan` for the write — the same pair `pressFan` uses, so a
    // typed number and a button press are one kind of edit in the history.
    if (!engine.runBatch(`Fan ${next.count}×${next.beams}`, () => { engine.setFan(noteId, next) })) return
    this.renderScore()
    dbg(`[Fan] Properties set ${noteId} → ${next.count} notes, ${next.beams} beams`)
  }

  /** Dispose the subscription when the app tears down, like every wire. */
  destroy(): void {
    this.unsubscribe()
  }
}
