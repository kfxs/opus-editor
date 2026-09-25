import type { MusicEngine } from '../../engine/MusicEngine'
import { bus } from '@/bus'
import type { TupletEditRequest } from '@/bus'
import { dbg } from '../../utils/debug'

/**
 * Applies a Properties-panel **tuplet format** choice to the engine (his ask, 2026-09-25). The window is a
 * **dumb publisher**: it writes a partial `TupletEditRequest` to {@link bus.tupletEdit}, and this controller —
 * the one place that holds `getEngine` — applies it through `engine.tuplet.setFormat` and repaints.
 * The same shape as {@link BarlineEditController}, for the same boundary reason: a content widget never
 * holds the engine, and `App.ts` stays construction-only.
 */
export class TupletEditController {
  private unsubscribe: () => void

  constructor(
    private getEngine: () => MusicEngine | null,
    private renderScore: () => void,
  ) {
    this.unsubscribe = bus.tupletEdit.onSet((req) => this.apply(req))
  }

  private apply({ tupletId, ...edit }: TupletEditRequest): void {
    const engine = this.getEngine()
    if (!engine) return
    // ⛔ A re-pick of the value it has writes nothing — the command says so (no entry, no repaint).
    if (!engine.tuplet.setFormat(tupletId, edit)) {
      dbg(`· Tuplet format unchanged | ${JSON.stringify(edit)} on ${tupletId}`)
      return
    }
    this.renderScore()
  }

  destroy(): void {
    this.unsubscribe()
  }
}
