import type { MusicEngine } from '../../engine/MusicEngine'
import { bus } from '@/bus'
import type { GlissandoEditRequest } from '@/bus'
import { dbg } from '../../utils/debug'

/**
 * Applies a Properties-panel **glissando** choice — side, end, direction — to the engine
 * (docs/plans/glissando-plan.md). The window is a **dumb publisher**: it writes a partial
 * `GlissandoEditRequest` to {@link bus.glissandoEdit}, and this controller — the one place that holds
 * `getEngine` — applies it through `engine.glissando.*` (one undo entry each) and repaints.
 * The {@link TupletEditController} shape, for the same boundary reason.
 */
export class GlissandoEditController {
  private unsubscribe: () => void

  constructor(
    private getEngine: () => MusicEngine | null,
    private renderScore: () => void,
  ) {
    this.unsubscribe = bus.glissandoEdit.onSet((req) => this.apply(req))
  }

  private apply({ glissandoId, side, end, direction, text }: GlissandoEditRequest): void {
    const engine = this.getEngine()
    if (!engine) return
    const ids = [glissandoId]
    let changed = 0
    if (side) changed += engine.glissando.setSide(ids, side)
    if (end) changed += engine.glissando.setEnd(ids, end)
    if (direction) changed += engine.glissando.setDirection(ids, direction)
    if (text !== undefined) changed += engine.glissando.setText(ids, text)
    // ⛔ A re-pick of the value it has writes nothing — the commands say so (no entry, no repaint).
    if (!changed) {
      dbg(`· Glissando unchanged | ${JSON.stringify({ side, end, direction, text })} on ${glissandoId}`)
      return
    }
    this.renderScore()
  }

  destroy(): void {
    this.unsubscribe()
  }
}
