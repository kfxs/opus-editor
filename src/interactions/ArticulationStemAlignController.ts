import type { MusicEngine } from '../engine/MusicEngine'
import { articulationStemAlignSelection, type ArticulationStemAlignRequest } from './articulationStemAlignSelection'
import { dbg } from '../utils/debug'

/**
 * Applies a Properties "align to stem" toggle to the engine — the twin of {@link NoteOffsetController}.
 * The window is a dumb publisher: it writes `{noteId, align}` to {@link articulationStemAlignSelection},
 * and this controller — the one place holding `getEngine` — calls the facade and repaints. Owning the
 * engine here keeps the boundary the window defends (a content widget never holds the engine).
 */
export class ArticulationStemAlignController {
  private unsubscribe: () => void

  constructor(
    private getEngine: () => MusicEngine | null,
    private renderScore: () => void,
  ) {
    this.unsubscribe = articulationStemAlignSelection.onSet((req) => this.apply(req))
  }

  private apply({ noteId, align }: ArticulationStemAlignRequest): void {
    const engine = this.getEngine()
    if (!engine) return
    if (!engine.setArticulationStemAlign(noteId, align)) return
    this.renderScore()
    dbg(`[Note] Properties articulation stem-align ${noteId} → ${align}`)
  }

  destroy(): void {
    this.unsubscribe()
  }
}
