import type { MusicEngine } from '../../engine/MusicEngine'
import { bus } from '@/bus'
import type { GlyphMarkAddRequest, GlyphMarkOffsetRequest } from '@/bus'
import { dbg } from '../../utils/debug'

/**
 * Applies the Symbols window's *Add symbol* — and a symbol's Properties offset (P4) — to the engine (docs/plans/symbol-plan.md P2) — the one place
 * that holds `getEngine` for that window, the Properties controllers' shape. The window publishes a glyph
 * and the selected note or rest on {@link bus.glyphMarkAdd}; this lands it on `engine.glyphMark`, which
 * saves the undo entry, and repaints. A refused add (a glyph that draws nothing, an id that names no
 * event) repaints nothing.
 */
export class GlyphMarkController {
  private unsubscribes: (() => void)[]

  constructor(
    private getEngine: () => MusicEngine | null,
    private renderScore: () => void,
  ) {
    this.unsubscribes = [
      bus.glyphMarkAdd.onSet((req) => this.apply(req)),
      // ⭐ …and the Properties offset boxes (P4): an ABSOLUTE offset, through the arrows' page limit.
      bus.glyphMarkOffset.onSet((req) => this.applyOffset(req)),
    ]
  }

  private applyOffset(req: GlyphMarkOffsetRequest): void {
    const engine = this.getEngine()
    if (!engine || !engine.glyphMark.setOffset(req.id, req.x, req.y)) return
    this.renderScore()
    dbg(`[Symbol] Properties offset ${req.x}, ${req.y} on ${req.id}`)
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
    for (const off of this.unsubscribes) off()
  }
}
