import type { WindowLayer } from '../WindowLayer'
import type { Window } from '../Window'
import { readPlacement, writePlacement } from '../windowPlacement'
import { KeypadWidget, KEYPAD_WIDTH } from './KeypadWidget'

/**
 * The Keypad's life: open on startup, toggled by Ctrl+Alt+K, closed by its ✕ — and left, between
 * sessions, exactly where and how the user left it (`../windowPlacement`).
 *
 * Plain TS, like everything about a window — the panel is composed and opened here, and App.ts is
 * not consulted. The single `keypad` handle is what keeps the panel a THING rather than a stack of
 * copies: there is one, or there is none. It is always checked against the manager before use,
 * because the ✕ closes the window behind our back and a stale handle would then toggle nothing.
 */

let keypad: Window | null = null

/** The name the placement is filed under — see `../windowPlacement`, and why it is not an id. */
const PLACEMENT_KEY = 'keypad'

/** Low in the box, not level with the first system — see {@link openKeypadWindow}. */
const DEFAULT_Y = 260

function isOpen(windows: WindowLayer): boolean {
  return keypad !== null && windows.manager.list().includes(keypad)
}

export function openKeypadWindow(windows: WindowLayer): Window {
  if (isOpen(windows)) return keypad!

  // Pinned to the RIGHT edge instead of joining the cascade: the Keypad is not one of a stack of
  // windows, it is the panel that is always there, and it opens in the same place every time — out
  // of the way of the music, which grows from the left.
  //
  // …unless the user has MOVED it, in which case that is where the panel lives now. A remembered
  // corner beats the opening rule for the same reason an explicit `x`/`y` beats the cascade: the
  // rule exists to answer "where, when nobody has said". Out-of-date coordinates are safe — the
  // manager reclamps every window it opens, so a corner saved against a wider viewport comes back
  // inside this one.
  const margin = 8
  const placed = readPlacement(PLACEMENT_KEY)
  const x = placed?.x ?? Math.max(margin, windows.manager.bounds().width - KEYPAD_WIDTH - margin)

  keypad = windows.open({
    title: 'Keypad',
    x,
    // Low in the box, not level with the first system: the top of the viewport is where the music
    // being edited usually is, and a panel that opens over it hides the very thing you are typing
    // into. Clamped by the layer if the viewport is ever shorter than this.
    y: placed?.y ?? DEFAULT_Y,
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
  // Explicitly, and not on the manager's event: that fires INSIDE `open()`, before the handle above
  // has been assigned — so at that moment there is no panel to record. Opening is also the one act
  // that can arrive with no pointer release behind it (Ctrl+Alt+K), so nothing else would catch it.
  rememberPlacement(windows)
  return keypad
}

/** Is the panel up? Exported so a MENU ROW can tick itself — the window's own state, asked of the
 *  window, rather than a second copy of it kept by whoever drew the row. */
export function isKeypadOpen(windows: WindowLayer): boolean {
  return isOpen(windows)
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
 * File the panel's corner and whether it is up.
 *
 * The corner is saved even while the panel is DOWN — a closed Keypad still knows where it was, so
 * reopening it puts it back rather than throwing it at the right edge. That is why the handle is read
 * here and not the manager's list: a closed `Window` keeps its `rect`.
 *
 * Nothing is written before the panel has existed this session: the first window event of a run
 * would otherwise record "closed at nowhere" over what the last run left.
 */
function rememberPlacement(windows: WindowLayer): void {
  if (!keypad) return
  const { x, y } = keypad.rect
  writePlacement(PLACEMENT_KEY, { open: isOpen(windows), x, y })
}

/**
 * Ctrl+Alt+K is Sibelius's own show/hide-Keypad key (Cmd+Opt+K there; the browser hands us Ctrl+Alt
 * on both). And like Sibelius, the panel is simply UP when the editor starts — unless the user shut
 * it, which is a decision and outlives the tab. It waits for the app to donate the box, then opens
 * itself.
 */
export function installKeypad(windows: WindowLayer): void {
  windows.whenMounted(() => {
    // Never opened before ⇒ no placement ⇒ up, as always.
    if (readPlacement(PLACEMENT_KEY)?.open === false) return
    openKeypadWindow(windows)
  })

  // OPENNESS changes through the manager — the ✕ closes the window behind our back, so the event is
  // the only honest signal that the panel went down.
  windows.manager.subscribe(() => rememberPlacement(windows))

  if (typeof document === 'undefined') return

  // The CORNER changes on a drag, which the layer writes straight to the DOM and tells nobody about
  // (deliberately — a drag frame must not go through a reactive system). A pointer release is the
  // end of every drag there is, and `writePlacement` drops a placement that has not moved, so this
  // costs nothing on the clicks that are not drags.
  document.addEventListener('pointerup', () => rememberPlacement(windows))

  document.addEventListener('keydown', (e) => {
    if (!e.ctrlKey || !e.altKey || e.key.toLowerCase() !== 'k') return
    e.preventDefault()
    toggleKeypad(windows)
  })
}
