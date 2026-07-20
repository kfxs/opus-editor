import type { WindowLayer } from '../WindowLayer'
import type { Window } from '../Window'
import { KeypadWidget, KEYPAD_WIDTH } from './KeypadWidget'

/**
 * The Keypad's life: open on startup, toggled by Ctrl+Alt+K, closed by its ✕.
 *
 * Plain TS, like everything about a window — the panel is composed and opened here, and App.vue is
 * not consulted. The single `keypad` handle is what keeps the panel a THING rather than a stack of
 * copies: there is one, or there is none. It is always checked against the manager before use,
 * because the ✕ closes the window behind our back and a stale handle would then toggle nothing.
 */

let keypad: Window | null = null

function isOpen(windows: WindowLayer): boolean {
  return keypad !== null && windows.manager.list().includes(keypad)
}

export function openKeypadWindow(windows: WindowLayer): Window {
  if (isOpen(windows)) return keypad!

  // Pinned to the RIGHT edge instead of joining the cascade: the Keypad is not one of a stack of
  // windows, it is the panel that is always there, and it opens in the same place every time — out
  // of the way of the music, which grows from the left.
  const margin = 8
  const x = Math.max(margin, windows.manager.bounds().width - KEYPAD_WIDTH - margin)

  keypad = windows.open({
    title: 'Keypad',
    x,
    // Low in the box, not level with the first system: the top of the viewport is where the music
    // being edited usually is, and a panel that opens over it hides the very thing you are typing
    // into. Clamped by the layer if the viewport is ever shorter than this.
    y: 260,
    width: KEYPAD_WIDTH,
    // Its own floor, or the DEFAULT floor (160) silently widens it: `fitContent` resizes through
    // `setSize`, which clamps to minWidth, and the extra pixels all land on the right — the panel
    // is narrower than any window the defaults were written for.
    minWidth: KEYPAD_WIDTH,
    minHeight: 0,
    // The panel is a fixed instrument: its keys are the size a finger expects, so there is nothing
    // to resize and nothing to scroll. `fitContent` makes the window exactly as tall as the grid.
    resizable: false,
    fitContent: true,
    // Glass. The keys on it stay solid (KeypadWidget), so what you see through is the panel's
    // background and the gaps between the keys — the score is never behind a glyph you must read.
    opacity: 0.45,
    content: new KeypadWidget(),
  })
  return keypad
}

export function toggleKeypad(windows: WindowLayer): void {
  if (isOpen(windows)) {
    keypad!.close()
    keypad = null
  } else {
    openKeypadWindow(windows)
  }
}

/**
 * Ctrl+Alt+K is Sibelius's own show/hide-Keypad key (Cmd+Opt+K there; the browser hands us Ctrl+Alt
 * on both). And like Sibelius, the panel is simply UP when the editor starts — it waits for the app
 * to donate the box, then opens itself.
 */
export function installKeypad(windows: WindowLayer): void {
  windows.whenMounted(() => openKeypadWindow(windows))

  if (typeof document === 'undefined') return
  document.addEventListener('keydown', (e) => {
    if (!e.ctrlKey || !e.altKey || e.key.toLowerCase() !== 'k') return
    e.preventDefault()
    toggleKeypad(windows)
  })
}
