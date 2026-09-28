import type { MusicEngine } from '../../engine/MusicEngine'
import { bus } from '@/bus'
import type { GlyphMarkAddRequest } from '@/bus'
import { dbg } from '../../utils/debug'

/**
 * Applies the Symbols window's *Add symbol* to the engine (docs/plans/symbol-plan.md P2) — the one place
 * that holds `getEngine` for that window, the Properties controllers' shape. The window publishes a glyph
 * and the selected note or rest on {@link bus.glyphMarkAdd}; this lands it on `engine.glyphMark`, which
 * saves the undo entry, and repaints. A refused add (a glyph that draws nothing, an id that names no
 * event) repaints nothing.
 */
export class GlyphMarkController {
  private unsubscribe: () => void

  constructor(
    private getEngine: () => MusicEngine | null,
    private renderScore: () => void,
  ) {
    this.unsubscribe = bus.glyphMarkAdd.onSet((req) => this.apply(req))
  }

  private apply(req: GlyphMarkAddRequest): void {
    const engine = this.getEngine()
    if (!engine) return
    const mark = engine.glyphMark.add(req.noteId, req.glyph)
    if (!mark) return
    this.renderScore()
    dbg(`[Symbol] added ${req.glyph} to ${req.noteId}`)
  }

  destroy(): void {
    this.unsubscribe()
  }
}
