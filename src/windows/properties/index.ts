import type { WindowLayer } from '../WindowLayer'
import type { Window } from '../Window'
import { PropertiesWidget } from './PropertiesWidget'

/**
 * The Properties window: what the current selection IS, and the knobs that change it — Sibelius's
 * Inspector, under the name most people reach for.
 *
 * A SKETCH for now: it shows the selected element AS THE MODEL HOLDS IT, stringified, and edits
 * nothing ({@link PropertiesWidget}). What the eventual controls should be is decided per element
 * type — a note has a voice and a stem direction, a dynamic has text and an offset, a slur has a
 * shape — and the way to get that right is to look at the objects first.
 *
 * Toggled by Ctrl+Alt+P and closed by its ✕ — the Keypad's deal ({@link ../keypad}), and the single
 * `properties` handle is what keeps it ONE window rather than a stack of copies. It is always
 * checked against the manager before use, because the ✕ closes the window behind our back and a
 * stale handle would then toggle nothing. Unlike the Keypad it does NOT open on startup: the Keypad
 * is an instrument you play the score with, this is a panel you consult — and while it is a sketch,
 * it is one you ask for.
 */

let properties: Window | null = null

const WIDTH = 260
const HEIGHT = 320

function isOpen(windows: WindowLayer): boolean {
  return properties !== null && windows.manager.list().includes(properties)
}

export function openPropertiesWindow(windows: WindowLayer): Window {
  if (isOpen(windows)) return properties!

  // Pinned to the LEFT edge, mirroring the Keypad's right — the two are the standing panels, and a
  // panel that joined the cascade would sit somewhere new every time you toggled it.
  const margin = 8
  properties = windows.open({
    title: 'Properties',
    x: margin,
    y: 150,
    width: WIDTH,
    height: HEIGHT,
    // Glass, like the Keypad: it lives ON TOP of the music and must not take the music away.
    opacity: 0.45,
    content: new PropertiesWidget(),
  })
  return properties
}

export function togglePropertiesWindow(windows: WindowLayer): void {
  if (isOpen(windows)) {
    properties!.close()
    properties = null
  } else {
    openPropertiesWindow(windows)
  }
}

/**
 * Ctrl+Alt+P, the neighbour of the Keypad's Ctrl+Alt+K. Bound on `document` here rather than in the
 * app's ShortcutManager for the Keypad's reason: this is the WINDOW's own behaviour and its
 * lifecycle is the window layer's, not the editor's — so "add a panel" never means "edit App.vue".
 */
export function installProperties(windows: WindowLayer): void {
  if (typeof document === 'undefined') return
  document.addEventListener('keydown', (e) => {
    if (!e.ctrlKey || !e.altKey || e.key.toLowerCase() !== 'p') return
    e.preventDefault()
    togglePropertiesWindow(windows)
  })
}
