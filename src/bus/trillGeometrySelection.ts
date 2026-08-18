/**
 * The seam the Properties panel's TRILL OFFSET inputs publish through — the typed twin of the arrow
 * keys that move a selected ornament's ink (`shortcutWiring.nudgeArmedTrillEnd`; his ask,
 * 2026-08-18). Command-only, in {@link OttavaGeometryRequest}'s shape: the window writes "put THIS
 * number at THIS value", and {@link TrillGeometryController} — the one place that holds the engine —
 * applies it.
 *
 * ⭐⭐ **THREE numbers, and the panel's shape is the MODEL's.** The `tr` and its wavy line are drawn
 * on one baseline, so `TrillOffsetOverride` carries two horizontals and ONE vertical — this seam has
 * no per-end height and must not grow one, or two boxes could disagree about a quantity the notation
 * has one of.
 *
 * ⭐ **Only the COSMETIC half travels here.** A trill's squares also carry which NOTES are trilled —
 * the model, and AUDIBLE, since the playback schedule generates its repeats from the span — and that
 * is not a number of staff-spaces. Its instruments are the ones that already exist:
 * `Ctrl+Shift+←/→` and the drag, both measured in notes.
 *
 * ⚠️ **No `null` "reset" case**, the bracket seam's rule: for an offset the automatic value IS zero,
 * so a reset is a request for 0 and the model's own zero-pruning drops the entry.
 */

/** Move one drawn END along its own axis — the `tr` sign, or where the wavy line stops. */
export interface TrillEndRequest {
  /** The selected trill whose end to move. */
  trillId: string
  /** Which drawn end — the sign's square or the line's. */
  which: 'start' | 'end'
  /** The desired ABSOLUTE horizontal offset in **staff-spaces**, `+` reaching further right. `0` is
   *  the engraver's own position. */
  x: number
}

/**
 * Set the WHOLE ornament's height — both ends, since they share a baseline.
 *
 * ⭐ On the SAME seam as the ends and not one of its own: it is the same category of statement about
 * the same element (this channel carries a trill's DRAWING).
 */
export interface TrillHeightRequest {
  trillId: string
  /**
   * The desired ABSOLUTE offset in **staff-spaces**, `+` moving the ornament FURTHER FROM THE STAFF
   * — up for an `above` trill, down for a `below` one. `0` is the height the ladder chose.
   *
   * ⭐⭐ **Not a screen `y`**, and it is the bracket's reason rather than the pedal's: a trill's side
   * is stored and `x` FLIPS it, so a screen value would invert a nudge the user had already made the
   * moment the ornament moved under the staff. ⚠️ The BOX shows the opposite where the side is
   * `below` — that flip is the WIDGET's, so this channel carries the model's number unconverted.
   */
  outward: number
}

export type TrillGeometryRequest = TrillEndRequest | TrillHeightRequest

export class TrillGeometrySelection {
  private listeners = new Set<(req: TrillGeometryRequest) => void>()

  /** Publish a request. ALWAYS fires — re-typing the same number is a real event, and the controller
   *  decides it is a no-op. */
  set(req: TrillGeometryRequest): void {
    for (const fn of this.listeners) fn(req)
  }

  /** Handle a request — {@link TrillGeometryController} runs the engine apply. */
  onSet(fn: (req: TrillGeometryRequest) => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }
}

export const createTrillGeometrySelection = () => new TrillGeometrySelection()
