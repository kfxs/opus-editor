import type { MusicEngine } from '../engine/MusicEngine'
import { bus } from '@/bus'
import type { DynamicOffsetRequest } from '@/bus'
import { dynamicOffsetOverrideOf } from '../engine/models/engravingOverrides'
import { dbg } from '../utils/debug'

/**
 * Applies a Properties-panel **dynamic/expression offset** request to the engine (his ask,
 * 2026-08-17). `NoteOffsetController`'s twin, in its shape and for its reasons: the window writes an
 * absolute `{dynamicId, x, y}` to {@link bus.dynamicOffset}, and this — the one place that holds
 * `getEngine` — turns it into the facade's relative nudge and repaints.
 *
 * The twin of the keyboard surface in `shortcutWiring` (which nudges a selected dynamic by ±¼ / 1
 * staff-space); this is the durable, precise input. Both land on the same
 * `MusicEngine.nudgeDynamicOffset`, so both save one undo step per commit, both read back through
 * the same id-keyed override — and ⭐ both are stopped by the same page limit, which is exactly the
 * point of routing the typed value through the nudge rather than writing the override directly (his
 * report the same afternoon: *"the offset limit should also be true of properties"*).
 */
export class DynamicOffsetController {
  private unsubscribe: () => void

  constructor(
    private getEngine: () => MusicEngine | null,
    private renderScore: () => void,
  ) {
    this.unsubscribe = bus.dynamicOffset.onSet((req) => this.apply(req))
  }

  private apply({ dynamicId, x, y }: DynamicOffsetRequest): void {
    const engine = this.getEngine()
    if (!engine) return
    // Absolute → relative: the facade is a nudge, so a new absolute value is just the delta from the
    // current one (`NoteOffsetController`'s arrangement). No change → nothing to do, and no empty
    // undo entry.
    const current = dynamicOffsetOverrideOf(engine.getScore(), dynamicId)
    const dx = x - (current?.x ?? 0)
    const dy = y - (current?.y ?? 0)
    if (dx === 0 && dy === 0) return
    // ⚠️ ONE call, not one per axis: two nudges would be two undo entries for one commit, and the
    // page limit would judge the halves separately — a diagonal that must be refused whole could
    // then get its x through.
    if (!engine.nudgeDynamicOffset(dynamicId, dx, dy)) return
    this.renderScore()
    dbg(`[Dynamic] Properties set offset ${dynamicId} → (${x}, ${y}) staff-space(s)`)
  }

  /** The subscription outlives no window — but dispose it when the app tears down, like every wire. */
  destroy(): void {
    this.unsubscribe()
  }
}
