import type { Clef } from '@/types/music'

/**
 * The armed clef, shared between the editor and the plain-TS Clef window
 * ({@link ../windows/clefWindow}), over two channels:
 *
 * - HIGHLIGHT: the clef currently armed, mirrored in by `keypadSync` so re-opening the window shows
 *   what is already armed rather than a stale first row.
 * - PRESS: the user chose one. Always fires — choosing the armed clef again means "arm it again",
 *   so it must not be swallowed as "no change".
 *
 * It was a {@link PaletteSelection}`<Clef>` until the dialog gained *Allow cautionary*, and that is
 * the reason for the hand-written class: a `PaletteSelection` carries ONE value, which is also the
 * thing that lights a key. This press carries a clef AND the courtesy decision that goes with it —
 * two values, of which only the first can light anything. Smuggling the second through a field on
 * the first would have made the highlight channel lie about what was armed.
 *
 * Same shape as {@link ./timeSignatureSelection}, which met the same wall for the same reason.
 */
export interface ArmedClef {
  clef: Clef
  /** Sibelius has no such box on its clef dialog; this is ours. See docs/time-signature-window-plan.md §1
   *  for the model it shares with the meter's. */
  cautionary: boolean
}

export class ClefSelection {
  private highlight: Clef | null = null
  private highlightListeners = new Set<(clef: Clef | null) => void>()
  private pressListeners = new Set<(armed: ArmedClef) => void>()

  /** The armed clef, or null. */
  get(): Clef | null {
    return this.highlight
  }

  /** Mirror the editor's armed clef in. Short-circuits on no change, so mirroring cannot loop. */
  setHighlight(clef: Clef | null): void {
    if (clef === this.highlight) return
    this.highlight = clef
    for (const fn of this.highlightListeners) fn(clef)
  }

  onHighlight(fn: (clef: Clef | null) => void): () => void {
    this.highlightListeners.add(fn)
    return () => this.highlightListeners.delete(fn)
  }

  press(armed: ArmedClef): void {
    for (const fn of this.pressListeners) fn(armed)
  }

  onPress(fn: (armed: ArmedClef) => void): () => void {
    this.pressListeners.add(fn)
    return () => this.pressListeners.delete(fn)
  }
}

export const createClefSelection = () => new ClefSelection()
