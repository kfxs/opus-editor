import type { MusicEngine } from '../engine/MusicEngine'
import { bus } from '@/bus'
import type { PedalGeometryRequest } from '@/bus'
import { pedalOffsetOverrideOf } from '../engine/models/engravingOverrides'
import { dbg } from '../utils/debug'

/**
 * Applies a Properties-panel PEDAL OFFSET request to the engine — the typed twin of the arrow keys
 * that move a selected pedal's ink (his ask, 2026-08-18). The window is a **dumb publisher**: it
 * writes an absolute number to {@link bus.pedalGeometry}, and this controller turns it into the
 * engine's own nudge and repaints.
 *
 * `OttavaGeometryController`'s arrangement and its two rules:
 *
 * ⭐ **Absolute in, relative out.** `nudgePedalEndpoint` accumulates, so a typed absolute becomes
 * `delta = wanted − current` — which is also what makes re-typing the same number a no-op rather
 * than an empty undo entry, and what puts the panel behind the same PAGE LIMIT as the keyboard
 * (docs/engraving-overrides-plan.md §8). ⛔ Writing the override directly from here would be a
 * second door past that gate.
 *
 * ⚠️ **The current value is read from the compartment, not from the request.** The panel could have
 * sent what it last painted, but a stale panel would then write a wrong delta: the number on screen
 * is a picture of the model, never a second copy of it.
 *
 * ⛔ It cannot touch the pedal's EXTENT — when the damper falls and rises is the model, it is
 * audible, and it has its own gestures (see `bus/pedalGeometrySelection`).
 */
export class PedalGeometryController {
  private unsubscribe: () => void

  constructor(
    private getEngine: () => MusicEngine | null,
    private renderScore: () => void,
  ) {
    this.unsubscribe = bus.pedalGeometry.onSet((req) => this.apply(req))
  }

  private apply(req: PedalGeometryRequest): void {
    const engine = this.getEngine()
    if (!engine) return
    const current = pedalOffsetOverrideOf(engine.getScore(), req.pedalId)

    // ⭐⭐ THE VERTICAL IS ONE NUMBER FOR THE PAIR, so it is asked for without a sign named — and it
    // is applied through the START square only because a square has to be named, not because that
    // sign owns it. `PedalOffsetOverride` has a single `y`; either square writes the same field.
    //
    // ⭐ It passes straight through: the model, this seam and `nudgePedalEndpoint` all speak SCREEN
    // (+ down). Only the two EDGES with a direction on them convert — the keyboard (`↑`) and the
    // panel's box (`+` is up).
    if ('y' in req) {
      const delta = req.y - (current?.y ?? 0)
      if (delta === 0) return // no change → no undo entry
      if (!engine.nudgePedalEndpoint(req.pedalId, 'start', 0, delta)) return
      this.renderScore()
      dbg(`[Pedal] Properties set the vertical → ${req.y} staff-space(s) | id:${req.pedalId}`)
      return
    }

    const { pedalId, which, x } = req
    const dx = x - (current?.[which === 'start' ? 'startX' : 'endX'] ?? 0)
    if (dx === 0) return
    if (!engine.nudgePedalEndpoint(pedalId, which, dx, 0)) return
    this.renderScore()
    dbg(`[Pedal] Properties set the ${which} sign → ${x} staff-space(s) | id:${pedalId}`)
  }

  /** Dispose the subscription when the app tears down, like every wire. */
  destroy(): void {
    this.unsubscribe()
  }
}
