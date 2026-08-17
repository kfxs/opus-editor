/**
 * The seam the Properties panel's OTTAVA OFFSET inputs publish through — the typed twin of the arrow
 * keys that move a selected bracket's ink (`shortcutWiring.nudgeArmedOttavaEnd`; his ask,
 * 2026-08-17). Command-only, in {@link HairpinEndRequest}'s shape: the window writes "put THIS
 * number at THIS value", and {@link OttavaGeometryController} — the one place that holds the engine —
 * applies it.
 *
 * ⭐⭐ **THREE numbers, and the panel's shape is the MODEL's.** An octave bracket is a straight
 * horizontal rule, so `OttavaOffsetOverride` carries two horizontals and ONE outward distance — there is no
 * per-end `y`, and this seam has none either. ⛔ Do not "improve" it into two point requests to match
 * the hairpin's: a wedge may tilt and a bracket may not, and two channels for one height would be two
 * numbers able to disagree about it. The window offering a single height row is how the reader learns
 * the rule.
 *
 * ⭐ **Only the COSMETIC half travels here**, the hairpin seam's rule: an ottava's squares also carry
 * the EXTENT (which notes are displaced — `beat`/`length` on the model, and audible), and that is not
 * a number of staff-spaces. Its instruments are the ones that already exist: `Ctrl+Shift+←/→` and the
 * drag, both measured in notes.
 *
 * ⚠️ **There is no `null` "reset" case, unlike the wedge's mouth**, and that is not an omission: for
 * an offset the automatic value IS zero, so a reset is a request for 0 and the model's own
 * zero-pruning drops the entry. A blank box would have to mean something different from `0`, and here
 * nothing does.
 */

/** Move one drawn END of the bracket along its own axis — the numeral, or the closing hook. */
export interface OttavaEndRequest {
  /** The selected ottava whose end to move. */
  ottavaId: string
  /** Which drawn end — the numeral's square or the hook's. */
  which: 'start' | 'end'
  /** The desired ABSOLUTE horizontal offset in **staff-spaces**, `+` reaching further right. `0` is
   *  the engraver's own position. */
  x: number
}

/**
 * Set the WHOLE bracket's height.
 *
 * ⭐ On the SAME seam as the ends and not one of its own — it is the same category of statement about
 * the same element (this channel carries an ottava's DRAWING). It is a separate shape only because
 * the height is one number for the whole line where an end is a point on it.
 */
export interface OttavaHeightRequest {
  ottavaId: string
  /**
   * The desired ABSOLUTE offset in **staff-spaces**, `+` moving the bracket FURTHER FROM THE STAFF —
   * up for an 8va, down for an 8vb. `0` is the automatic height the outside-staff ladder chose.
   *
   * ⭐⭐ **Not a screen `y`**, and his hand is why: *"the height is not intuitive… for 8vb it works,
   * because increasing makes it higher, but with 8va alta it does not."* A screen value reads
   * backwards on one side of the staff, and a typed box has no arrow on it to say which side you are
   * on. See {@link OttavaOffsetOverride} for the second, model-level reason.
   */
  outward: number
}

export type OttavaGeometryRequest = OttavaEndRequest | OttavaHeightRequest

export class OttavaGeometrySelection {
  private listeners = new Set<(req: OttavaGeometryRequest) => void>()

  /** Publish a request. ALWAYS fires — re-typing the same number is a real event, and the controller
   *  decides it is a no-op. */
  set(req: OttavaGeometryRequest): void {
    for (const fn of this.listeners) fn(req)
  }

  /** Handle a request — {@link OttavaGeometryController} runs the engine apply. */
  onSet(fn: (req: OttavaGeometryRequest) => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }
}

export const createOttavaGeometrySelection = () => new OttavaGeometrySelection()
