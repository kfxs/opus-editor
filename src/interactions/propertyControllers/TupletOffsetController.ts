import type { MusicEngine } from '../../engine/MusicEngine'
import { bus } from '@/bus'
import type { TupletOffsetRequest } from '@/bus'
import { tupletOffsetOverrideOf } from '../../engine/models/engravingOverrides'
import { dbg } from '../../utils/debug'

/**
 * Applies a Properties-panel **tuplet offset** request to the engine (his ask, 2026-09-25) —
 * {@link TempoOffsetController}'s shape on one axis: the window writes an absolute `{tupletId, y}` to
 * {@link bus.tupletOffset}, and this — the one place that holds `getEngine` — turns it into the facade's
 * relative nudge and repaints. The twin of the keys in `elements/tupletKeys`; both land on
 * `engine.tuplet.nudgeOffset`, so both save one undo step and read back through the same override.
 */
export class TupletOffsetController {
  private unsubscribe: () => void

  constructor(
    private getEngine: () => MusicEngine | null,
    private renderScore: () => void,
  ) {
    this.unsubscribe = bus.tupletOffset.onSet((req) => this.apply(req))
  }

  private apply({ tupletId, y }: TupletOffsetRequest): void {
    const engine = this.getEngine()
    if (!engine) return
    const dy = y - (tupletOffsetOverrideOf(engine.getScore(), tupletId)?.y ?? 0)
    if (dy === 0) return
    if (!engine.tuplet.nudgeOffset(tupletId, dy)) return
    this.renderScore()
    dbg(`[Tuplet] Properties set offset ${tupletId} → y ${y} staff-space(s)`)
  }

  destroy(): void {
    this.unsubscribe()
  }
}
