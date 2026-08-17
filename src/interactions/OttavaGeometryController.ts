import type { MusicEngine } from '../engine/MusicEngine'
import { bus } from '@/bus'
import type { OttavaGeometryRequest } from '@/bus'
import { ottavaOffsetOverrideOf } from '../engine/models/engravingOverrides'
import { dbg } from '../utils/debug'

/**
 * Applies a Properties-panel OTTAVA OFFSET request to the engine — the typed twin of the arrow keys
 * that move a selected bracket's ink (his ask, 2026-08-17). The window is a **dumb publisher**: it
 * writes an absolute number to {@link bus.ottavaGeometry}, and this controller turns it into the
 * engine's own nudge and repaints.
 *
 * `HairpinGeometryController`'s arrangement and its two rules:
 *
 * ⭐ **Absolute in, relative out.** `nudgeOttavaEndpoint` accumulates, so a typed absolute becomes
 * `delta = wanted − current` — which is also what makes re-typing the same number a no-op rather than
 * an empty undo entry, and what puts the panel behind the same PAGE LIMIT as the keyboard
 * (docs/engraving-overrides-plan.md §8; his report: *"the offset limit should also be true of
 * properties"*). ⛔ Writing the override directly from here would be a second door past that gate.
 *
 * ⚠️ **The current value is read from the compartment, not from the request.** The panel could have
 * sent what it last painted, but a stale panel would then write a wrong delta: the number on screen
 * is a picture of the model, never a second copy of it.
 *
 * ⛔ It cannot touch the bracket's EXTENT — which notes are displaced is the model, it is audible,
 * and it has its own gestures (see `bus/ottavaGeometrySelection`).
 */
export class OttavaGeometryController {
  private unsubscribe: () => void

  constructor(
    private getEngine: () => MusicEngine | null,
    private renderScore: () => void,
  ) {
    this.unsubscribe = bus.ottavaGeometry.onSet((req) => this.apply(req))
  }

  private apply(req: OttavaGeometryRequest): void {
    const engine = this.getEngine()
    if (!engine) return
    const current = ottavaOffsetOverrideOf(engine.getScore(), req.ottavaId)

    // ⭐⭐ THE VERTICAL IS ONE NUMBER FOR THE WHOLE BRACKET, so it is asked for without an end — and
    // it is applied through the START square only because a square has to be named, not because that
    // end owns it. `OttavaOffsetOverride` has a single `outward`; either square writes the same field.
    //
    // ⭐ It passes straight through: `nudgeOttavaEndpoint` speaks OUTWARD-from-the-staff too, so no
    // sign is flipped on this road. Only the KEYBOARD converts, because `↑` is a screen direction.
    if ('outward' in req) {
      const delta = req.outward - (current?.outward ?? 0)
      if (delta === 0) return // no change → no undo entry
      if (!engine.nudgeOttavaEndpoint(req.ottavaId, 'start', 0, delta)) return
      this.renderScore()
      dbg(`[Ottava] Properties set the outward distance → ${req.outward} staff-space(s) | id:${req.ottavaId}`)
      return
    }

    const { ottavaId, which, x } = req
    const dx = x - (current?.[which === 'start' ? 'startX' : 'endX'] ?? 0)
    if (dx === 0) return
    if (!engine.nudgeOttavaEndpoint(ottavaId, which, dx, 0)) return
    this.renderScore()
    dbg(`[Ottava] Properties set the ${which} end → ${x} staff-space(s) | id:${ottavaId}`)
  }

  /** Dispose the subscription when the app tears down, like every wire. */
  destroy(): void {
    this.unsubscribe()
  }
}
