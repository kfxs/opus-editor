/**
 * One palette value — a duration, an accidental — shared between the editor and a plain-TS panel (the
 * Keypad), over TWO channels, because a palette key is two things at once:
 *
 * - HIGHLIGHT: which value to LIGHT, or `null` for none. A pure mirror of editor state — App.ts
 *   computes the rule (a value is shown only when it means something) and pushes the result in with
 *   {@link setHighlight}. Both UIs read {@link get} and repaint on {@link onHighlight}. `setHighlight`
 *   SHORT-CIRCUITS on no change, so mirroring cannot loop.
 * - PRESS: the user hit this key. A command, and it ALWAYS fires ({@link press}) — re-pressing the
 *   armed value is a real event (an accidental toggles OFF), so it must not be swallowed as "no
 *   change". App.ts handles it ({@link onPress}) by running the palette's own setX, the SAME method
 *   the dev toolbar's button calls.
 *
 * Keeping the two apart is what lets an editor-origin change and a Keypad press stay distinct: the
 * mirror only ever touches HIGHLIGHT, the Keypad press only ever fires PRESS — so the action never
 * double-applies and needs no guard.
 */
export class PaletteSelection<T> {
  private highlight: T | null = null
  private highlightListeners = new Set<(value: T | null) => void>()
  private pressListeners = new Set<(value: T) => void>()

  /** The value to light, or `null` for none. */
  get(): T | null {
    return this.highlight
  }

  /** Mirror the editor's state in. Notifies {@link onHighlight}; short-circuits on no change. */
  setHighlight(value: T | null): void {
    if (value === this.highlight) return
    this.highlight = value
    for (const fn of this.highlightListeners) fn(value)
  }

  /** Repaint hook for a UI that lights from {@link get}. */
  onHighlight(fn: (value: T | null) => void): () => void {
    this.highlightListeners.add(fn)
    return () => this.highlightListeners.delete(fn)
  }

  /** The user pressed this value. ALWAYS fires — the handler decides what it means (incl. toggle). */
  press(value: T): void {
    for (const fn of this.pressListeners) fn(value)
  }

  /** Handle a press — e.g. run the palette's setX. */
  onPress(fn: (value: T) => void): () => void {
    this.pressListeners.add(fn)
    return () => this.pressListeners.delete(fn)
  }
}
