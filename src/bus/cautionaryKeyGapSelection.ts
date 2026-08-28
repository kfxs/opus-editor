/**
 * ⭐⭐ **THE CAUTIONARY KEY SIGNATURE'S TRAILING GAP, asked for from the Properties panel** — how much
 * bare staff is drawn after a courtesy at a system break, in staff spaces.
 *
 * 🚨 **His ask, 2026-08-28:** *"lets make what we have now default but give the user the freedom to
 * change the number in properties."* The default is **0.75 sp — his own chosen middle** between
 * Gould's measured 1.9 and the three engines' 0.5 (`engine/layout/cautionaryKey.ts` quotes all of
 * them). Two defensible answers a space and a half apart is exactly the case for a control.
 *
 * ⭐ **A GEOMETRY edit, not a content one.** It changes no key, no pitch and no playback: it moves ink
 * and lands in the overrides compartment (`cautionaryKeyGapKey`). That is why the request carries a
 * measure and a staff rather than an id — the courtesy has no object of its own, it is a drawing of
 * the CHANGE at that bar (`SelectedElement`'s `keySignature` is positional for the same reason).
 *
 * ⚠️ **The measure is the CHANGE's, never the bar that draws the courtesy** — which bar ends a system
 * moves on every reflow, and the author's decision must not move with it. The panel publishes what
 * the selection names, and the selection names the change.
 *
 * ⭐ `gap: null` means *let the engraver decide* — the reset, and the same shape the hairpin's
 * aperture uses. ⛔ Not `0`, which is a real value a user may ask for (no tail at all).
 */
export interface CautionaryKeyGapRequest {
  /** The bar the key CHANGE starts at — the bar whose courtesy is being adjusted. */
  measure: number
  /** Which staff's change, 0-based. */
  staff: number
  /** Staff spaces of bare staff after the courtesy's last sign, or **null to reset to the default**. */
  gap: number | null
}

class CautionaryKeyGapSelection {
  private listeners = new Set<(req: CautionaryKeyGapRequest) => void>()

  /** Ask for a gap — the Properties row's only move. */
  set(req: CautionaryKeyGapRequest): void {
    for (const fn of this.listeners) fn(req)
  }

  /** Handle a request — {@link CautionaryKeyGapController} runs the engine apply. */
  onSet(fn: (req: CautionaryKeyGapRequest) => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }
}

export const createCautionaryKeyGapSelection = () => new CautionaryKeyGapSelection()
