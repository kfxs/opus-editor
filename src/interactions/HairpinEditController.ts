import type { MusicEngine } from '../engine/MusicEngine'
import { bus } from '@/bus'
import type { HairpinEditRequest } from '@/bus'
import { dbg } from '../utils/debug'

/**
 * Applies a Properties-panel hairpin edit to the engine (his ask, 2026-08-22). The window is a **dumb
 * publisher**: it writes `{hairpinId, type}` to {@link bus.hairpinEdit}, and this controller — the one
 * place that holds `getEngine` — applies it and repaints.
 *
 * The same shape as {@link TrillEditController} and {@link FanEditController}, and for the same
 * boundary reason: a content widget never holds the engine, and `App.ts` stays construction-only.
 *
 * ⭐ It CHANGES a wedge, it never makes one. An id that no longer resolves is a no-op: creating and
 * removing hairpins is the Lines palette and Delete.
 *
 * ⭐ **A CONTENT edit, deliberately** — which way a wedge opens is what the player is told to do, and
 * playback reads it. So it goes through `updateHairpin`, which commits an undo entry, ⛔ not through
 * the engraving-overrides compartment the geometry seam next door writes to.
 */
export class HairpinEditController {
  private unsubscribe: () => void

  constructor(
    private getEngine: () => MusicEngine | null,
    private renderScore: () => void,
  ) {
    this.unsubscribe = bus.hairpinEdit.onSet((req) => this.apply(req))
  }

  private apply({ hairpinId, type }: HairpinEditRequest): void {
    const engine = this.getEngine()
    if (!engine || type === undefined) return
    // ⛔ Re-choosing the value it already has writes NOTHING — a `<select>` fires `change` for a
    //   re-pick, and an undo entry that takes back a no-op is a step the user cannot see the effect
    //   of. (The seam publishes it anyway, on purpose: deciding it is a no-op is this end's job.)
    if (engine.getHairpinById(hairpinId)?.type === type) return
    if (!engine.updateHairpin(hairpinId, { type })) return
    dbg(`[Hairpin] type → ${type} | id:${hairpinId.slice(0, 8)}`)
    this.renderScore()
  }

  destroy(): void {
    this.unsubscribe()
  }
}
