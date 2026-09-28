import type { MusicEngine } from '../../engine/MusicEngine'
import { bus } from '@/bus'
import type { BeamOffsetRequest } from '@/bus'
import { dbg } from '../../utils/debug'

/**
 * Applies a Properties-panel **beam** request to the engine (his ask, 2026-09-28) — the tuplet offset controller's
 * shape: the window writes an ABSOLUTE value to {@link bus.beamOffset}, and this — the one place that holds
 * `getEngine` — turns it into the beam commands' relative step and repaints. The twin of the arrows and the drags:
 * all land on `engine.beam`, so a typed value is refused by the same band limit and stem floor, saves one undo
 * step, and reads back through the same override.
 *
 * `middle` moves BOTH ends by the difference from their current middle — the angle kept; `start` / `end` move one.
 */
export class BeamOffsetController {
  private unsubscribe: () => void

  constructor(
    private getEngine: () => MusicEngine | null,
    private renderScore: () => void,
  ) {
    this.unsubscribe = bus.beamOffset.onSet((req) => this.apply(req))
  }

  private apply(req: BeamOffsetRequest): void {
    const engine = this.getEngine()
    if (!engine) return
    const now = engine.beam.offsetOf(req.anchorNoteId)
    const moved = 'middle' in req
      ? engine.beam.shiftBeam(req.anchorNoteId, req.middle - (now.start + now.end) / 2)
      : 'start' in req
        ? engine.beam.shiftBeamEnd(req.anchorNoteId, 'start', req.start - now.start)
        : engine.beam.shiftBeamEnd(req.anchorNoteId, 'end', req.end - now.end)
    if (!moved) return
    this.renderScore()
    dbg(`[Beam] Properties set ${JSON.stringify(req)}`)
  }

  destroy(): void {
    this.unsubscribe()
  }
}
