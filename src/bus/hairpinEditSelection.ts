import type { Hairpin } from '@/types/music'

/**
 * The seam the Properties hairpin control publishes through (his ask, 2026-08-22: *"be able in a
 * dropdown in the property to change the hairpin type"*). The twin of {@link ./trillEditSelection}:
 * **command-only**, so the window writes *"this wedge should be a diminuendo"* and
 * {@link HairpinEditController} — the one place that holds the engine — applies it.
 *
 * ⭐ **A separate seam from {@link ./hairpinGeometrySelection}, and the split is the point.** That one
 * carries the RESHAPE — end nudges and the mouth, all of it drawing. Which way the wedge opens is
 * MUSIC: it changes what the player is told to do, it is undoable as a content edit, and playback
 * reads it. Two questions, two seams, exactly as the trill keeps `trillGeometry` apart from
 * `trillEdit`.
 *
 * No mirror channel, for the fan's and the trill's reason: the control reads its CURRENT value from
 * `selectionInspection`, which it already subscribes to, so the window stays a dumb publisher that
 * cannot reach the score.
 *
 * ⭐ A PARTIAL request, like theirs, though there is one field today — a request shaped as "the
 * hairpin, plus whichever fields changed" absorbs the next one without every reader being told.
 */
export interface HairpinEditRequest {
  /** The selected hairpin to change. */
  hairpinId: string
  /** Which way the wedge opens. Absent = leave it alone.
   *  ⚠️ `Hairpin['type']`, ⛔ not a copy of the union: one place says what a wedge may be. */
  type?: Hairpin['type']
}

export class HairpinEditSelection {
  private listeners = new Set<(req: HairpinEditRequest) => void>()

  /** Publish a change. ALWAYS fires (re-choosing the same value is a real event — the controller
   *  decides it is a no-op), mirroring `TrillEditSelection.set`. */
  set(req: HairpinEditRequest): void {
    for (const fn of this.listeners) fn(req)
  }

  /** Handle a change — {@link HairpinEditController} runs the engine apply. */
  onSet(fn: (req: HairpinEditRequest) => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }
}

export const createHairpinEditSelection = () => new HairpinEditSelection()
