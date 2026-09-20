import type { MusicEngine } from '../../engine/MusicEngine'
import { bus } from '@/bus'
import type { ClefOffsetRequest } from '@/bus'
import { beatToFrac } from '@/utils/musicUtils'
import { dbg } from '../../utils/debug'

/**
 * Applies a Properties-panel CLEF-offset request to the engine — {@link NoteOffsetController}'s twin,
 * line for line (his ask, 2026-08-28).
 *
 * The window is a **dumb publisher**: it writes an absolute `{measure, beat, staff, x}` to
 * {@link bus.clefOffset}, and this controller — the one place that holds `getEngine` — turns it into
 * the facade's relative nudge and repaints. The keyboard surface in `shortcutWiring` nudges the same
 * facade by ±¼/1 staff-space, so both land on one override and one undo step per commit.
 */
export class ClefOffsetController {
  private unsubscribe: () => void

  constructor(
    private getEngine: () => MusicEngine | null,
    private renderScore: () => void,
  ) {
    this.unsubscribe = bus.clefOffset.onSet((req) => this.apply(req))
  }

  private apply({ measure, beat, staff, x }: ClefOffsetRequest): void {
    const engine = this.getEngine()
    if (!engine) return
    // Absolute → relative: the facade is a nudge, so a new absolute value is just the delta from the
    // current one. No change → nothing to do (and no empty undo entry).
    const frac = beatToFrac(beat)
    const dx = x - engine.getClefOffset(measure, frac, staff)
    if (dx === 0) return
    if (!engine.nudgeClefOffset(measure, frac, staff, dx)) return
    this.renderScore()
    dbg(`[Clef] Properties set offset ${measure}:${beat} staff ${staff} → ${x} staff-space(s)`)
  }

  /** Dispose the subscription when the app tears down, like every wire. */
  destroy(): void {
    this.unsubscribe()
  }
}
