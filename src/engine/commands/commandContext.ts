/**
 * ⭐ **WHAT A COMMAND FAMILY IS BUILT FROM** — the editor's own concerns, and nothing of the score's:
 * how an edit becomes an undo entry, how a live drag defers one, and the limits a hand-nudge is
 * judged by before it may be WRITTEN (docs/code-shape-plan-2026-09-19.md, Phase 3.5).
 *
 * A family (`./<family>Commands.ts`) is a function of this context returning typed functions;
 * `MusicEngine` builds the context once and keeps `readonly ottava = ottavaCommands(ctx)`. ⛔ What a
 * mark IS — its span, its slots, its overrides — is the score layer's (`engine/models/<family>Ops`):
 * a command is the ops call, the limit that may refuse it, and the undo entry.
 *
 * ⚠️ `model()` and `registry()` are FUNCTIONS, not fields: undo, redo and load REPLACE the
 * `ScoreModel`, so a captured one is a stale score the day after the first `Ctrl+Z`.
 */
import type { ElementInfo, ElementType } from '../ElementRegistry'
import type { InkBox } from '../layout/pageBounds'
import type { ScoreModel } from '../models/ScoreModel'

/** The registry as the limits read it — optional members, because several engine specs stub it with
 *  the handful of methods they need; an absent method means "nothing drawn", which every limit
 *  already treats as ALLOW. */
export interface DrawnRegistry {
  getByType?: (type: ElementType) => ElementInfo[]
  getStaffGeometry?: (measure: number, staff: number) =>
    { lineSpacing: number; lineYPositions: readonly number[] } | undefined
}

export interface CommandContext {
  model(): ScoreModel
  registry(): DrawnRegistry

  /** A score edit that changes what PLAYS: resync playback, then one undo entry. */
  commit(description: string): void
  /** One undo entry for an edit with nothing audible in it — ink, a side, a label. */
  saveOnly(description: string): void
  /** The model is about to change under a LIVE drag frame: flag it, record nothing. Undo is deferred
   *  to the drop's {@link commitPreviewed}. */
  markDirty(): void
  /** The ONE undo entry for a drag the model has already taken and the screen already shown — ⛔ it
   *  does not flag the model dirty (that re-engraves a picture that is already there). */
  commitPreviewed(description: string): void

  /** A staff index as the model files it — ⚠️ the FIRST staff is `undefined`, not its id. */
  staffIdForIndex(staff: number): string | undefined

  /** ⭐ THE LIMITS — each predicts where INK would land, so each takes SCREEN staff-spaces (+down).
   *  All allow freely when the mark drew nothing: no picture, no limit. */
  limits: {
    /** May every drawn piece of `id` move by (dx, dy) and stay on its sheet? */
    nudgeStaysOnPage(type: ElementType, id: string, dx: number, dy: number): boolean
    /** Would `dy` put this ink in a neighbouring staff's room? */
    nudgeStaysInBand(drawn: readonly InkBox[], measure: number, staff: number, dy: number): boolean
    /** May ONE end of a span — and the square the user grabs it by — step `dx` and stay on paper? */
    spanEndStaysOnPage(
      type: ElementType, id: string, which: 'start' | 'end', dx: number,
      pick?: (pieces: ElementInfo[]) => ElementInfo | undefined,
    ): boolean
  }
}
