import type { Fraction, TimeSignature } from '../types/music'

/**
 * The armed time signature, published by the Time Signature window ({@link ../windows/timeSignatureWindow})
 * for `keypadSync` to route into `PaletteController.armTimeSignature` — the same seam
 * {@link ./clefSelection} uses, and for the same reason: a window cannot see the controllers, and
 * neither should it.
 *
 * NOT a {@link ./paletteSelection}, though, and the difference is the payload. Those carry ONE value
 * that is also what lights a key; this carries a meter AND the cautionary decision that goes with
 * it, and nothing lights. A `PaletteSelection<TimeSignature>` would have had to smuggle the second
 * value through a field on the first, or drop it. One press channel is all this needs.
 */
export interface ArmedTimeSignature {
  timeSignature: TimeSignature
  /** Sibelius's *Allow cautionary*, decided in the dialog and applied when the meter lands. */
  cautionary: boolean
  /**
   * The bar's actual length in quarter-note beats when it is a PICKUP (anacrusis), or null for a
   * full bar. Rides along for the cautionary's reason — the dialog decides it, the target bar is
   * not known until the click — and lands on the very measure the meter does: "start with a bar of
   * length X" is a statement about the bar this meter opens.
   */
  pickup: Fraction | null
}

class TimeSignatureSelection {
  private listeners = new Set<(armed: ArmedTimeSignature) => void>()

  /** The user chose this meter. ALWAYS fires — re-choosing the armed one is a real event (it means
   *  "arm it again"), so it must not be swallowed as "no change". */
  press(armed: ArmedTimeSignature): void {
    for (const fn of this.listeners) fn(armed)
  }

  onPress(fn: (armed: ArmedTimeSignature) => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }
}

export const timeSignatureSelection = new TimeSignatureSelection()
