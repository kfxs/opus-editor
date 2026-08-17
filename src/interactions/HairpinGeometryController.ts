import type { MusicEngine } from '../engine/MusicEngine'
import { bus } from '@/bus'
import type { HairpinGeometryRequest } from '@/bus'
import { hairpinEndpointOffsetOverrideOf } from '../engine/models/engravingOverrides'
import { dbg } from '../utils/debug'

/**
 * Applies a Properties-panel HAIRPIN END request to the engine — the typed twin of the arrow keys
 * that reshape a wedge (his ask, 2026-08-17). The window is a **dumb publisher**: it writes an
 * absolute `{hairpinId, which, value}` to {@link bus.hairpinGeometry}, and this controller turns it
 * into the engine's own nudge and repaints.
 *
 * The `SlurGeometryController` / `NoteOffsetController` arrangement, and its two rules:
 *
 * ⭐ **Absolute in, relative out.** `nudgeHairpinEndpoint` accumulates, so a typed absolute becomes
 * `delta = wanted − current` — which is also what makes re-typing the same number a no-op rather than
 * an empty undo entry. An absent axis is "leave it", so its delta is zero and never a move to 0.
 *
 * ⚠️ **The current value is read from the compartment, not from the request.** The panel could have
 * sent what it last painted, but a stale panel would then write a wrong delta: the number on screen is
 * a picture of the model, never a second copy of it.
 *
 * ⛔ It cannot touch the wedge's EXTENT. That is the model, and it has its own gestures — this seam
 * carries only the override (see `bus/hairpinGeometrySelection`).
 */
export class HairpinGeometryController {
  private unsubscribe: () => void

  constructor(
    private getEngine: () => MusicEngine | null,
    private renderScore: () => void,
  ) {
    this.unsubscribe = bus.hairpinGeometry.onSet((req) => this.apply(req))
  }

  private apply(req: HairpinGeometryRequest): void {
    const engine = this.getEngine()
    if (!engine) return

    // The MOUTH is absolute already — the model stores what the user asked for, so there is no delta
    // to take (and no accumulation to read back). It also lets the model refuse a non-positive one.
    if ('aperture' in req) {
      if (!engine.setHairpinAperture(req.hairpinId, req.aperture)) return
      this.renderScore()
      dbg(`[Hairpin] Properties set the mouth → ${req.aperture ?? 'auto'} | id:${req.hairpinId}`)
      return
    }
    const { hairpinId, which, value } = req

    if (!value) {
      if (!engine.resetHairpinEndpointOffset(hairpinId, which)) return
      this.renderScore()
      dbg(`[Hairpin] Properties reset the ${which} end | id:${hairpinId}`)
      return
    }
    const current = hairpinEndpointOffsetOverrideOf(engine.getScore(), hairpinId)?.[which]
    const dx = value.x === undefined ? 0 : value.x - (current?.x ?? 0)
    const dy = value.y === undefined ? 0 : value.y - (current?.y ?? 0)
    if (dx === 0 && dy === 0) return // no change → no undo entry
    if (!engine.nudgeHairpinEndpoint(hairpinId, which, dx, dy)) return
    this.renderScore()
    dbg(`[Hairpin] Properties set the ${which} end → (${value.x ?? '·'}, ${value.y ?? '·'}) staff-space(s) | id:${hairpinId}`)
  }

  /** Dispose the subscription when the app tears down, like every wire. */
  destroy(): void {
    this.unsubscribe()
  }
}
