import type { MusicEngine } from '../../engine/MusicEngine'
import { bus } from '@/bus'
import type { CueSizeRequest } from '@/bus'
import { dbg } from '../../utils/debug'

/**
 * ⭐ The Properties window's "Cue size" checkbox (cue-size-plan P5), applied: `bus.cueSize` → `engine.cue.set`,
 * one undo entry, then a repaint. ⛔ No entry when nothing changed (the command's own rule).
 */
export class CueSizeController {
  private unsubscribe: () => void

  constructor(
    private getEngine: () => MusicEngine | null,
    private renderScore: () => void,
  ) {
    this.unsubscribe = bus.cueSize.onSet((req) => this.apply(req))
  }

  private apply({ noteId, cue }: CueSizeRequest): void {
    const engine = this.getEngine()
    if (!engine) return
    if (!engine.cue.set([noteId], cue)) return
    this.renderScore()
    dbg(`[cue] Properties ${noteId} → ${cue ? 'cue' : 'full'} size`)
  }

  destroy(): void {
    this.unsubscribe()
  }
}
