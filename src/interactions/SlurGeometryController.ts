import type { MusicEngine } from '../engine/MusicEngine'
import type { EditorState } from './EditorState'
import { bus } from '@/bus'
import type { SlurGeometryRequest } from '@/bus'
import { endpointOffsetOverrideOf } from '../engine/models/engravingOverrides'
import { setSlurControlPoint } from './slurHandleNudge'
import { dbg } from '../utils/debug'

/**
 * Applies a Properties-panel SLUR HANDLE request to the engine — the typed twin of the arrow-key
 * nudges (his ask, 2026-08-17: *"this modification we do for the control and endpoints of the slur we
 * should be able to do it also in the property window"*). The window is a **dumb publisher**: it
 * writes an absolute `{slurId, target, value}` to {@link bus.slurGeometry}, and this controller — the
 * one place that holds `getEngine` — turns it into the engine's own verbs and repaints.
 *
 * The `NoteOffsetController` arrangement exactly, and for its reasons: a content widget never holds
 * the engine, and `App.ts` stays construction-only.
 *
 * ⭐ **Absolute in, relative out.** The endpoint facade is a NUDGE (it accumulates), so a typed
 * absolute becomes `delta = wanted − current` — which is also what makes re-typing the same number a
 * no-op rather than an empty undo entry. The arc is the opposite: its override IS the absolute pair,
 * so that path hands the value straight to `setSlurControlPoint`, which resolves the untouched dot
 * from the drawn arc.
 *
 * ⚠️ It reads the CURRENT endpoint offset from the overrides compartment rather than from the panel's
 * request. The panel could have sent what it last painted, but a stale panel would then write a wrong
 * delta — the value on screen is a picture of the model, never a second copy of it.
 */
export class SlurGeometryController {
  private unsubscribe: () => void

  constructor(
    private state: EditorState,
    private getEngine: () => MusicEngine | null,
    private renderScore: () => void,
  ) {
    this.unsubscribe = bus.slurGeometry.onSet((req) => this.apply(req))
  }

  private apply({ slurId, target, value }: SlurGeometryRequest): void {
    const engine = this.getEngine()
    if (!engine) return

    if (target.kind === 'controlPoint') {
      // The arc's own module owns the baseline read and the write — the same one the arrows use, so
      // typing 2.5 and nudging to 2.5 land on identical model state.
      if (!setSlurControlPoint(this.state, engine, target.cpIndex, value)) return
      this.renderScore()
      return
    }

    const current = endpointOffsetOverrideOf(engine.getScore(), slurId)?.[target.which]
    if (!value) {
      if (!engine.resetSlurEndpointOffset(slurId, target.which)) return
      this.renderScore()
      dbg(`[Slur] Properties reset ${target.which} endpoint | id:${slurId}`)
      return
    }
    // An absent axis is "leave it as it is", so its delta is zero — never a move to 0.
    const dx = value.x === undefined ? 0 : value.x - (current?.x ?? 0)
    const dy = value.y === undefined ? 0 : value.y - (current?.y ?? 0)
    if (dx === 0 && dy === 0) return // no change → no undo entry
    if (!engine.nudgeSlurEndpoint(slurId, target.which, dx, dy)) return
    this.renderScore()
    dbg(`[Slur] Properties set ${target.which} endpoint → (${value.x}, ${value.y}) staff-space(s) | id:${slurId}`)
  }

  /** Dispose the subscription when the app tears down, like every wire. */
  destroy(): void {
    this.unsubscribe()
  }
}
