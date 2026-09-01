import type { MusicEngine } from '../engine/MusicEngine'
import { bus } from '@/bus'
import type { FractionalBeamSideRequest } from '@/bus'
import { dbg } from '../utils/debug'

/**
 * Applies a Properties fractional-beam choice to the engine — the twin of
 * {@link ArticulationStemAlignController}. The window is a dumb publisher: it writes
 * `{noteId, side}` to {@link bus.fractionalBeamSide}, and this controller — the one place holding
 * `getEngine` — calls the facade and repaints.
 */
export class FractionalBeamSideController {
  private unsubscribe: () => void

  constructor(
    private getEngine: () => MusicEngine | null,
    private renderScore: () => void,
  ) {
    this.unsubscribe = bus.fractionalBeamSide.onSet((req) => this.apply(req))
  }

  private apply({ noteId, side }: FractionalBeamSideRequest): void {
    const engine = this.getEngine()
    if (!engine) return
    if (!engine.setFractionalBeamSide(noteId, side)) return
    this.renderScore()
    dbg(`[Note] Properties fractional beam ${noteId} → ${side ?? 'auto'}`)
  }

  destroy(): void {
    this.unsubscribe()
  }
}
