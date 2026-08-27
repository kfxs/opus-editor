import type { ScoreTextField } from '@/engine/models/scoreTextOps'

/**
 * 🚧 The seam the **Add Title / Add Composer** dialog publishes through (his ask, 2026-08-27 —
 * *"two more options at the end separated with a line, Add Title and Add Composer… it should open a
 * dialog for entry a text"*).
 *
 * The twin of {@link ./barlineEditSelection}: **command-only**, so the window writes *"the composer
 * is Brahms"* and {@link ScoreTextController} — the one place that holds the engine — applies it and
 * repaints. No mirror channel: the dialog opens with the CURRENT value handed to it by whoever
 * opened it, so it stays a dumb publisher that cannot reach the score.
 *
 * ⛔ Read `engine/rendering/ScoreHeaderPass`'s note: the title and the composer are scaffolding, and
 * this seam is scaffolding with them. The real text-item frame publishes an id, not a field name.
 */
export interface ScoreTextRequest {
  /** Which field. ⚠️ The `ScoreTextField` the whole family carries, ⛔ never a copy of that union. */
  field: ScoreTextField
  /** What was typed. ⭐ **Blank is legal and means DELETE the field** — the rule is stated once, in
   *  `engine/models/scoreTextOps.setScoreText`, so the dialog needs no Clear button and the
   *  controller needs no special case. */
  text: string
}

class ScoreTextSelection {
  private listeners = new Set<(req: ScoreTextRequest) => void>()

  /** Publish a change. ALWAYS fires — re-typing the same words is a real event, and the controller
   *  decides it is a no-op (`barlineEditSelection.set`'s rule). */
  set(req: ScoreTextRequest): void {
    for (const fn of this.listeners) fn(req)
  }

  /** Handle one — {@link ScoreTextController} runs the engine apply. */
  onSet(fn: (req: ScoreTextRequest) => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }
}

export const createScoreTextSelection = () => new ScoreTextSelection()
