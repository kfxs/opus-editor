/**
 * The seam the Properties panel's PEDAL OFFSET inputs publish through — the typed twin of the arrow
 * keys that move a selected pedal's ink (`shortcutWiring.nudgeArmedPedalEnd`; his ask, 2026-08-18).
 * Command-only, in {@link OttavaGeometryRequest}'s shape: the window writes "put THIS number at THIS
 * value", and {@link PedalGeometryController} — the one place that holds the engine — applies it.
 *
 * ⭐⭐ **THREE numbers, and the panel's shape is the MODEL's.** A pedal and its own release share one
 * baseline (Gould p. 333, the copy in `reference/`), so `PedalOffsetOverride` carries two horizontals
 * and ONE vertical — this seam has no per-sign height and must not grow one, or two boxes could
 * disagree about a quantity the notation has one of. The window offering a single height row is how
 * the reader learns the rule.
 *
 * ⭐ **Only the COSMETIC half travels here.** A pedal's squares also carry the EXTENT — when the
 * damper falls and rises, which is the model and is AUDIBLE — and that is not a number of
 * staff-spaces. Its instruments are the ones that already exist: `Ctrl+Shift+←/→` and the drag, both
 * measured in notes.
 *
 * ⚠️ **No `null` "reset" case**, the bracket seam's rule: for an offset the automatic value IS zero,
 * so a reset is a request for 0 and the model's own zero-pruning drops the entry.
 */

/** Move one drawn SIGN along its own axis — the `Ped.`, or the release `✻`. */
export interface PedalEndRequest {
  /** The selected pedal whose sign to move. */
  pedalId: string
  /** Which sign — the press's square or the lift's. */
  which: 'start' | 'end'
  /** The desired ABSOLUTE horizontal offset in **staff-spaces**, `+` reaching further right. `0` is
   *  the engraver's own position. */
  x: number
}

/**
 * Set the WHOLE pedal's height — both signs, since they share a baseline.
 *
 * ⭐ On the SAME seam as the signs and not one of its own: it is the same category of statement
 * about the same element (this channel carries a pedal's DRAWING). It is a separate shape only
 * because the height is one number for the pair where a sign is one of them.
 */
export interface PedalHeightRequest {
  pedalId: string
  /**
   * The desired ABSOLUTE offset in **staff-spaces**, SCREEN-signed (`+` down) — the model's own
   * spelling, so this seam speaks it unconverted.
   *
   * ⚠️ **The BOX shows the opposite sign** (`+` is up, his rule for every offset box), and the widget
   * is where that flip happens. ⛔ Don't move it here: the seam's job is to carry the model's number,
   * and a channel that converted would leave two places claiming to know which way is up.
   *
   * ⭐ And ⛔ not the bracket's `outward`: that exists because an ottava's side is derived from
   * `shift` and `x` flips it. A pedal has one side permanently, so the two spellings would differ by
   * a sign that never changes (see {@link PedalOffsetOverride}).
   */
  y: number
}

export type PedalGeometryRequest = PedalEndRequest | PedalHeightRequest

export class PedalGeometrySelection {
  private listeners = new Set<(req: PedalGeometryRequest) => void>()

  /** Publish a request. ALWAYS fires — re-typing the same number is a real event, and the controller
   *  decides it is a no-op. */
  set(req: PedalGeometryRequest): void {
    for (const fn of this.listeners) fn(req)
  }

  /** Handle a request — {@link PedalGeometryController} runs the engine apply. */
  onSet(fn: (req: PedalGeometryRequest) => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }
}

export const createPedalGeometrySelection = () => new PedalGeometrySelection()
