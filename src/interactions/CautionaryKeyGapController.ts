import type { MusicEngine } from '../engine/MusicEngine'
import { bus } from '@/bus'
import type { CautionaryKeyGapRequest } from '@/bus'
import { dbg } from '../utils/debug'

/**
 * Applies a Properties-panel **cautionary key gap** edit to the engine (his ask, 2026-08-28: *"give
 * the user the freedom to change the number in properties"*). The window is a **dumb publisher**: it
 * writes `{measure, staff, gap}` to {@link bus.cautionaryKeyGap}, and this controller — the one place
 * that holds `getEngine` — applies it and repaints.
 *
 * The same shape as {@link BarlineEditController} and {@link HairpinGeometryController}, and for the
 * same boundary reason: a content widget never holds the engine, and `App.ts` stays
 * construction-only.
 *
 * ⭐ **A GEOMETRY edit** — it moves ink and changes no key, so it saves an undo entry and repaints
 * with no playback resync (`MusicEngine.setCautionaryKeyGap`). `gap: null` is the reset.
 */
export class CautionaryKeyGapController {
  private unsubscribe: () => void

  constructor(
    private getEngine: () => MusicEngine | null,
    private renderScore: () => void,
  ) {
    this.unsubscribe = bus.cautionaryKeyGap.onSet((req) => this.apply(req))
  }

  private apply({ measure, staff, gap }: CautionaryKeyGapRequest): void {
    const engine = this.getEngine()
    if (!engine) return
    if (!engine.setCautionaryKeyGap(measure, gap, staff)) {
      dbg(`· Cautionary key gap unchanged | measure ${measure} staff ${staff} → ${gap ?? 'auto'}`)
      return
    }
    dbg(`✓ Cautionary key gap | measure ${measure} staff ${staff} → ${gap === null ? 'auto' : `${gap} sp`}`)
    this.renderScore()
  }

  destroy(): void {
    this.unsubscribe()
  }
}
