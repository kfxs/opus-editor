import type { MusicEngine } from '../../engine/MusicEngine'
import { bus } from '@/bus'
import type { EnclosureSpanRequest } from '@/bus'
import { dbg } from '../../utils/debug'

/**
 * ⭐ The Properties window's one-pair switch for a chord in brackets (parenthesised-note-plan P5), applied:
 * `bus.enclosureSpan` → `engine.enclosure.setSpan`, one undo entry, then a repaint.
 */
export class EnclosureSpanController {
  private unsubscribe: () => void

  constructor(
    private getEngine: () => MusicEngine | null,
    private renderScore: () => void,
  ) {
    this.unsubscribe = bus.enclosureSpan.onSet((req) => this.apply(req))
  }

  private apply({ pitchId, span }: EnclosureSpanRequest): void {
    const engine = this.getEngine()
    if (!engine) return
    if (!engine.enclosure.setSpan(pitchId, span)) return
    this.renderScore()
    dbg(`[enclosure] Properties span ${pitchId} → ${span ?? 'per head'}`)
  }

  destroy(): void {
    this.unsubscribe()
  }
}
