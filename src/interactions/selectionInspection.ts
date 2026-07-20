import type { SelectedElement } from './selectionSnapshot'

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
  private elements: SelectedElement[] = []
  private listeners = new Set<(elements: SelectedElement[]) => void>()

  get(): SelectedElement[] {
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
  set(elements: SelectedElement[]): void {
    if (JSON.stringify(elements) === JSON.stringify(this.elements)) return
    this.elements = elements
    for (const fn of this.listeners) fn(elements)
  }

  /** Repaint hook. Returns an unsubscribe. */
  onChange(fn: (elements: SelectedElement[]) => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }
}

export const selectionInspection = new SelectionInspection()
