import { keypadPageSelection } from '../../interactions/keypadPageSelection'

/**
 * 🚧 TEMPORARY SCAFFOLDING — delete when page 2 is wired.
 *
 * Which `momentary` cell was pressed last, so an UNWIRED key can still show that it was hit. Page 2's
 * cells do nothing yet, which is correct but invisible: the only way to see that a numpad press lands
 * on the Beams/Tremolos page — rather than on the note-entry meaning it used to have — is for the key
 * to light up. This is that light, and it says nothing about the score.
 *
 * A seam and not a field in {@link KeypadWidget}, for the same reason the page is: the press arrives
 * from the numpad, which never addresses the widget. A widget-local flag would light on a click and
 * stay dark on the key — testing exactly the wrong half.
 *
 * It TOGGLES on a re-press, so every press changes something on screen (a "last pressed wins" light
 * would sit still when you hit the same key twice, which reads as a dead key).
 *
 * When page 2 gets real actions, its cells stop being `momentary` and light from the editor's own
 * state like every other key — and this file goes.
 */
let pressedKey: string | null = null
const listeners = new Set<() => void>()

function notify(): void {
  for (const fn of listeners) fn()
}

export const keypadProbe = {
  /** The cell key showing the probe light, or null. */
  get: (): string | null => pressedKey,
  /** Pressed — light it, or put it out if it was already lit. */
  press(key: string): void {
    pressedKey = pressedKey === key ? null : key
    notify()
  },
  /**
   * Put it out. Every light on this panel is a statement about NOW — the armed duration, the selected
   * note's articulations — so a probe light that outlives the moment it was lit is the odd one out:
   * it would sit there remembering the last key you happened to press, through an Esc, a click on
   * nothing, an arrow-key move, on a page you are only looking at.
   */
  clear(): void {
    if (pressedKey === null) return
    pressedKey = null
    notify()
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn)
    return () => listeners.delete(fn)
  },
}

// A page turn puts the probe out: the key it named belongs to the page we just left, and the same key
// on the next page is a different cell entirely. (The other extinguisher is any editor state change —
// wired in keypadSync, where the state's subscription already lives.)
keypadPageSelection.subscribe(() => keypadProbe.clear())
