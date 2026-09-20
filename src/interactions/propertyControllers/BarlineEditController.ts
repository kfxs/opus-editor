import type { MusicEngine } from '../../engine/MusicEngine'
import { bus } from '@/bus'
import type { BarlineEditRequest } from '@/bus'
import { dbg } from '../../utils/debug'

/**
 * Applies a Properties-panel **barline chooser** edit to the engine (his ask, 2026-08-26). The window
 * is a **dumb publisher**: it writes `{endsMeasure, sign}` to {@link bus.barlineEdit}, and this
 * controller — the one place that holds `getEngine` — applies it and repaints.
 *
 * The same shape as {@link HairpinEditController} and {@link TrillEditController}, and for the same
 * boundary reason: a content widget never holds the engine, and `App.ts` stays construction-only.
 *
 * ⭐ **It names a LINE**, which is what makes `:||:` reachable at all — see `bus/barlineEditSelection`
 * for why the seam is shaped that way and `barlineOps.setBoundarySign` for the write. One undo entry
 * per choice, even when the sign is two statements on two bars.
 *
 * ⭐ It CHANGES what stands on a line; it never adds or removes a bar. A boundary that is not there
 * (a `|:` asked for after the last bar) is a no-op — `setBoundarySign` refuses rather than
 * half-applying, so the panel cannot leave a sign nobody chose.
 */
export class BarlineEditController {
  private unsubscribe: () => void

  constructor(
    private getEngine: () => MusicEngine | null,
    private renderScore: () => void,
  ) {
    this.unsubscribe = bus.barlineEdit.onSet((req) => this.apply(req))
  }

  private apply({ endsMeasure, sign, winged }: BarlineEditRequest): void {
    const engine = this.getEngine()
    if (!engine) return
    const at = endsMeasure === null ? 'the opening edge' : `the line ending bar ${endsMeasure}`

    // ⭐ The WINGS, when that is what changed — a decoration on the sign, so it is its own field and
    // its own undo entry. See `bus/barlineEditSelection` for why the request is partial.
    if (winged !== undefined) {
      if (engine.getBoundaryWinged(endsMeasure) === winged) return
      if (!engine.setBoundaryWinged(endsMeasure, winged)) {
        dbg(`· Wings unchanged | ${at} — this sign cannot carry them`)
        return
      }
      dbg(`✓ Barline wings → ${winged ? 'on' : 'off'} | ${at}`)
      this.renderScore()
      return
    }

    if (sign === undefined) return
    // ⛔ Re-choosing the value it already has writes NOTHING — a `<select>` fires `change` for a
    //   re-pick, and an undo entry that takes back a no-op is a step the user cannot see the effect
    //   of. (The seam publishes it anyway, on purpose: deciding it is a no-op is this end's job.)
    if (engine.getBoundarySign(endsMeasure) === sign) return
    if (!engine.setBoundarySign(endsMeasure, sign)) {
      dbg(`· Barline unchanged | ${sign} at ${at} — refused (no bar on the far side of the line)`)
      return
    }
    dbg(`✓ Barline sign → ${sign} | ${at}`)
    this.renderScore()
  }

  destroy(): void {
    this.unsubscribe()
  }
}
