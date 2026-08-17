/**
 * The seam the Properties panel's HAIRPIN END inputs publish through — the typed twin of the arrow
 * keys that reshape a wedge (`shortcutWiring.nudgeArmedHairpinEnd`; his ask, 2026-08-17). Command-
 * only, in {@link NoteOffsetSelection}'s shape: the window writes "put THIS end of THIS wedge at
 * THIS offset", and {@link HairpinGeometryController} — the one place that holds the engine —
 * applies it.
 *
 * ⭐ **Only the COSMETIC half travels here.** A hairpin's two squares carry two categories of edit:
 * the extent (which notes get louder — `beat`/`length` on the model, moved by `Ctrl+Shift+←/→` and
 * by dragging the square) and the reshape (where the ink is drawn — an override, moved by the plain
 * and `Ctrl` arrows). This seam is the second one only. The panel offers no control for the extent
 * because a number of staff-spaces is the wrong instrument for it: the extent is measured in NOTES,
 * and the honest inputs for it are the ones that already exist.
 *
 * ⚠️ Its own store rather than a shared "span geometry" one with the slur's: the two elements'
 * handles do not mean the same things (a slur has four, with an arc shape among them) and the two
 * overrides reset on different rules. One channel per kind keeps each seam's doc true about its own.
 */

/** Move one of the wedge's two drawn ENDS. */
export interface HairpinEndRequest {
  /** The selected hairpin whose end to move. */
  hairpinId: string
  /** Which drawn end — the left-hand square or the right-hand one. */
  which: 'start' | 'end'
  /**
   * The desired ABSOLUTE offset in **staff-spaces**, or `null` to reset that end to the engraver's
   * own position. Either axis may be absent, meaning "leave it as it is" — the window edits one box
   * at a time and an unedited end has no numbers at all (see the note-offset seam's rule).
   *
   * `+x` reaches that end further along the wedge, `+y` is screen-DOWN. A `y` on one end alone tilts
   * the wedge; on both, it lifts it off the dynamics line.
   */
  value: { x?: number; y?: number } | null
}

/**
 * Set the wedge's MOUTH — how far it opens, in staff-spaces — or `null` to hand it back to the
 * automatic, length-aware aperture.
 *
 * ⭐ On the SAME seam as the end nudges, and not on one of its own, because it is the same category
 * of statement about the same element: this channel carries a hairpin's DRAWING. It is a separate
 * shape only because the mouth is one number for the whole wedge where an end is a point.
 */
export interface HairpinApertureRequest {
  hairpinId: string
  /** Staff-spaces, > 0 — or `null` to reset. The controller lets the model refuse the rest. */
  aperture: number | null
}

export type HairpinGeometryRequest = HairpinEndRequest | HairpinApertureRequest

export class HairpinGeometrySelection {
  private listeners = new Set<(req: HairpinGeometryRequest) => void>()

  /** Publish a request. ALWAYS fires — re-typing the same number is a real event, and the controller
   *  decides it is a no-op. */
  set(req: HairpinGeometryRequest): void {
    for (const fn of this.listeners) fn(req)
  }

  /** Handle a request — {@link HairpinGeometryController} runs the engine apply. */
  onSet(fn: (req: HairpinGeometryRequest) => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }
}

export const createHairpinGeometrySelection = () => new HairpinGeometrySelection()
