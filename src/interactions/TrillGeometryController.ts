import type { MusicEngine } from '../engine/MusicEngine'
import { bus } from '@/bus'
import type { TrillGeometryRequest } from '@/bus'
import { trillOffsetOverrideOf } from '../engine/models/engravingOverrides'
import { dbg } from '../utils/debug'

/**
 * Applies a Properties-panel TRILL OFFSET request to the engine — the typed twin of the arrow keys
 * that move a selected ornament's ink (his ask, 2026-08-18). The window is a **dumb publisher**: it
 * writes an absolute number to {@link bus.trillGeometry}, and this controller turns it into the
 * engine's own nudge and repaints.
 *
 * `OttavaGeometryController`'s arrangement and its two rules:
 *
 * ⭐ **Absolute in, relative out.** `nudgeTrillEndpoint` accumulates, so a typed absolute becomes
 * `delta = wanted − current` — which is what makes re-typing the same number a no-op rather than an
 * empty undo entry, and what puts the panel behind the same PAGE LIMIT as the keyboard. ⛔ Writing
 * the override directly from here would be a second door past that gate.
 *
 * ⚠️ **The current value is read from the compartment, not from the request.** The panel could have
 * sent what it last painted, but a stale panel would then write a wrong delta: the number on screen
 * is a picture of the model, never a second copy of it.
 *
 * ⛔ It cannot touch which NOTES are trilled — that is the model, it is audible, and it has its own
 * gestures (see `bus/trillGeometrySelection`).
 */
export class TrillGeometryController {
  private unsubscribe: () => void

  constructor(
    private getEngine: () => MusicEngine | null,
    private renderScore: () => void,
  ) {
    this.unsubscribe = bus.trillGeometry.onSet((req) => this.apply(req))
  }

  private apply(req: TrillGeometryRequest): void {
    const engine = this.getEngine()
    if (!engine) return
    const current = trillOffsetOverrideOf(engine.getScore(), req.trillId)

    // ⭐⭐ THE VERTICAL IS ONE NUMBER FOR THE ORNAMENT, so it is asked for without an end — and it is
    // applied through the START square only because a square has to be named, not because that end
    // owns it. `TrillOffsetOverride` has a single `outward`; either square writes the same field.
    //
    // ⭐ It passes straight through: `nudgeTrillEndpoint` speaks OUTWARD-from-the-staff too, so no
    // sign is flipped on this road. Only the two edges with a direction on them convert — the
    // keyboard (`↑`) and the panel's box (`+` is up).
    if ('outward' in req) {
      const delta = req.outward - (current?.outward ?? 0)
      if (delta === 0) return // no change → no undo entry
      if (!engine.nudgeTrillEndpoint(req.trillId, 'start', 0, delta)) return
      this.renderScore()
      dbg(`[Trill] Properties set the outward distance → ${req.outward} staff-space(s) | id:${req.trillId}`)
      return
    }

    const { trillId, which, x } = req
    const dx = x - (current?.[which === 'start' ? 'startX' : 'endX'] ?? 0)
    if (dx === 0) return
    if (!engine.nudgeTrillEndpoint(trillId, which, dx, 0)) return
    this.renderScore()
    dbg(`[Trill] Properties set the ${which} end → ${x} staff-space(s) | id:${trillId}`)
  }

  /** Dispose the subscription when the app tears down, like every wire. */
  destroy(): void {
    this.unsubscribe()
  }
}
