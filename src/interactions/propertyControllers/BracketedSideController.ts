import type { MusicEngine } from '../../engine/MusicEngine'
import { bus } from '@/bus'
import type { BracketedSideRequest } from '@/bus'
import { dbg } from '../../utils/debug'

/**
 * ⭐ The Properties window's before/after switch for a bracketed grace (bracketed-grace-plan P6), applied:
 * `bus.bracketedSide` → `engine.bracketed.setSide`, one undo entry, then a repaint. The selection holds
 * the same pitch id throughout — it moved, it was not re-made.
 */
export class BracketedSideController {
  private unsubscribe: () => void

  constructor(
    private getEngine: () => MusicEngine | null,
    private renderScore: () => void,
  ) {
    this.unsubscribe = bus.bracketedSide.onSet((req) => this.apply(req))
  }

  private apply({ pitchId, side }: BracketedSideRequest): void {
    const engine = this.getEngine()
    if (!engine) return
    if (!engine.bracketed.setSide(pitchId, side)) return
    this.renderScore()
    dbg(`[bracketed] Properties side ${pitchId} → ${side}`)
  }

  destroy(): void {
    this.unsubscribe()
  }
}
