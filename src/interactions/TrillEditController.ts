import type { MusicEngine } from '../engine/MusicEngine'
import { bus } from '@/bus'
import type { TrillEditRequest } from '@/bus'
import { dbg } from '../utils/debug'

/**
 * Applies a Properties-panel trill edit to the engine (docs/trill-plan.md §1 rule 6). The window is a
 * **dumb publisher**: it writes `{trillId, continuationLabel}` to {@link bus.trillEdit}, and this
 * controller — the one place that holds `getEngine` — applies it and repaints.
 *
 * ⭐ It CHANGES a trill, it never makes one. An id that no longer resolves is a no-op: creating and
 * removing trills is the Lines palette row and Delete. Two surfaces, one for "is this note trilled"
 * and one for "how is it drawn" — the same split `FanEditController` keeps, and for the same reason:
 * a dropdown that could conjure a notation would be a third answer to a settled question.
 *
 * The same shape as {@link FanEditController} and {@link NoteOffsetController}, and for the same
 * boundary reason: a content widget never holds the engine, and App.ts stays construction-only.
 */
export class TrillEditController {
  private unsubscribe: () => void

  constructor(
    private getEngine: () => MusicEngine | null,
    private renderScore: () => void,
  ) {
    this.unsubscribe = bus.trillEdit.onSet((req) => this.apply(req))
  }

  private apply({ trillId, continuationLabel }: TrillEditRequest): void {
    const engine = this.getEngine()
    if (!engine || continuationLabel === undefined) return
    if (!engine.setTrillContinuationLabel(trillId, continuationLabel)) return
    dbg(`[Trill] continuation label → ${continuationLabel} | id:${trillId.slice(0, 8)}`)
    this.renderScore()
  }

  destroy(): void {
    this.unsubscribe()
  }
}
