import type { MusicEngine } from '../../engine/MusicEngine'
import { bus } from '@/bus'
import type { ScoreTextRequest } from '@/bus'
import { dbg } from '../../utils/debug'

/**
 * 🚧 Applies an **Add Title / Add Composer** dialog entry to the engine (his ask, 2026-08-27). The
 * window is a **dumb publisher**: it writes `{field, text}` to {@link bus.scoreText}, and this
 * controller — the one place that holds `getEngine` — applies it and repaints.
 *
 * The same shape as {@link BarlineEditController}, and for the same boundary reason: a content
 * widget never holds the engine, and `App.ts` stays construction-only.
 *
 * ⭐ **Blank DELETES the field** rather than storing `''`, and that rule is not restated here — it is
 * `engine/models/scoreTextOps.setScoreText`'s, asked once. So clearing a title is "open the dialog,
 * empty the box, OK", and it produces exactly the JSON that Delete on the selected title does.
 *
 * ⛔ Scaffolding, with everything it touches: read `engine/rendering/ScoreHeaderPass`'s note.
 */
export class ScoreTextController {
  private unsubscribe: () => void

  constructor(
    private getEngine: () => MusicEngine | null,
    private renderScore: () => void,
  ) {
    this.unsubscribe = bus.scoreText.onSet((req) => this.apply(req))
  }

  private apply({ field, text }: ScoreTextRequest): void {
    const engine = this.getEngine()
    if (!engine) return
    // ⛔ Re-typing the words it already has writes NOTHING — the engine reports "unchanged", and an
    // undo entry that takes back a no-op is a step whose effect the user cannot see. (The seam
    // publishes it anyway, on purpose: deciding it is a no-op is this end's job.)
    if (!engine.setScoreText(field, text)) {
      dbg(`· Score ${field} unchanged`)
      return
    }
    dbg(text.trim() ? `✓ Score ${field} → "${text.trim()}"` : `✓ Score ${field} removed`)
    this.renderScore()
  }

  destroy(): void {
    this.unsubscribe()
  }
}
