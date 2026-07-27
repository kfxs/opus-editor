import type { InspectedElement } from './selectionSnapshot'

/**
 * The current selection, resolved to objects, published for anything that wants to SHOW it — today
 * the Properties window ({@link ../windows/properties}).
 *
 * One channel, not the two a {@link ./paletteSelection} has, because this seam only ever runs one
 * way: a panel that displays the selection has nothing to press back. When Properties grows real
 * controls they will not come through here either — an edit is a command on a specific element, and
 * it belongs on the controller that owns that element, exactly as a Keypad press routes to
 * `PaletteController`. This stays a window onto the selection, and nothing more.
 *
 * Pushed by `keypadSync`'s sync (it already runs on every state change) and read by the window.
 */
class SelectionInspection {
  private elements: InspectedElement[] = []
  /**
   * The last published snapshot, SERIALIZED at the moment it was published — not re-derived from
   * {@link elements} when the next one arrives.
   *
   * That distinction is the whole correctness of the de-dup. Some of what the snapshot carries is
   * the model's LIVE objects (`getDynamicById` returns the stored `Dynamic` itself; `getNote`
   * happens to return a fresh copy), so `elements` shares identity with the score. Re-stringifying
   * it at comparison time therefore reads the CURRENT state on both sides of the `===`, and any
   * edit made in place — nudging a dynamic's offset, the exact case this window is for — compares
   * equal to itself and is never published. Keeping the string freezes the old state, which is the
   * only thing there is to compare against.
   */
  private lastJson = ''
  private listeners = new Set<(elements: InspectedElement[]) => void>()

  get(): InspectedElement[] {
    return this.elements
  }

  /**
   * Publish a fresh snapshot. Short-circuits when nothing a viewer could SEE has changed — this
   * fires on every state change, most of which are not selection changes, and repainting a JSON
   * dump on each one would fight the user's scroll position in the panel.
   *
   * The comparison is on the serialized form because that IS what the client renders: a new object
   * with identical contents is not a change to anyone looking at it.
   */
  set(elements: InspectedElement[]): void {
    const json = JSON.stringify(elements)
    if (json === this.lastJson) return
    this.lastJson = json
    this.elements = elements
    for (const fn of this.listeners) fn(elements)
  }

  /** Repaint hook. Returns an unsubscribe. */
  onChange(fn: (elements: InspectedElement[]) => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }
}

export const selectionInspection = new SelectionInspection()
