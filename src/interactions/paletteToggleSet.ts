/**
 * A SET of independent toggles — the articulations — shared between the editor and the Keypad, over
 * the same two channels as {@link PaletteSelection}, but set-valued rather than single-valued.
 *
 * A duration is one-of-a-set and an accidental is one-or-none, so each is a single nullable value.
 * An articulation is different in kind: accent, staccato and tenuto are each their OWN light, and a
 * note can wear all three at once. So the HIGHLIGHT here is a whole SET, not one value.
 *
 * - HIGHLIGHT: which values are lit — a set. A pure mirror of editor state: App.ts (or the palette)
 *   computes which articulations the selection carries and pushes the result in with {@link setActive}.
 *   Both UIs read {@link isActive} and repaint on {@link onHighlight}. `setActive` SHORT-CIRCUITS when
 *   the set is unchanged, so mirroring cannot loop.
 * - PRESS: the user hit this key. A command, and it ALWAYS fires ({@link press}) — a press TOGGLES the
 *   value, so it must never be swallowed as "no change". App.ts handles it by running the palette's
 *   own toggleX, the SAME method the Vue button calls.
 *
 * Keeping the two apart is what lets a state mirror and a Keypad press stay distinct: the mirror only
 * ever touches HIGHLIGHT, the press only ever fires PRESS — so the toggle never double-applies and
 * needs no guard. Framework-agnostic: the panel imports this, never Vue.
 */
export class PaletteToggleSet<T> {
  private active = new Set<T>()
  private highlightListeners = new Set<(active: ReadonlySet<T>) => void>()
  private pressListeners = new Set<(value: T) => void>()

  /** Is this value currently lit? */
  isActive(value: T): boolean {
    return this.active.has(value)
  }

  /** Mirror the editor's state in. Notifies {@link onHighlight}; short-circuits when the set is equal
   *  (same members, order irrelevant), so a redundant mirror does not repaint. */
  setActive(values: Iterable<T>): void {
    const next = new Set(values)
    if (next.size === this.active.size && [...next].every(v => this.active.has(v))) return
    this.active = next
    for (const fn of this.highlightListeners) fn(next)
  }

  /** Repaint hook for a UI that lights from {@link isActive}. */
  onHighlight(fn: (active: ReadonlySet<T>) => void): () => void {
    this.highlightListeners.add(fn)
    return () => this.highlightListeners.delete(fn)
  }

  /** The user pressed this value. ALWAYS fires — the handler decides what it means (it toggles). */
  press(value: T): void {
    for (const fn of this.pressListeners) fn(value)
  }

  /** Handle a press — e.g. run the palette's toggleX. */
  onPress(fn: (value: T) => void): () => void {
    this.pressListeners.add(fn)
    return () => this.pressListeners.delete(fn)
  }
}
