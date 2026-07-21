import { WindowLayer } from './WindowLayer'
import { installKeypad } from './keypad'
import { installProperties } from './properties'

/**
 * The app's one window layer.
 *
 * It lives here — plain TS — and not in `App.ts`, so that ANY module can open a window by importing
 * it: a shortcut handler, a controller in `interactions/`, the engine. If the instance lived in the
 * app, the app would have to hand it to every opener, and "add a window" would mean "edit App.ts" —
 * the one thing docs/windows-design.md forbids.
 *
 * `App.ts`'s entire share is therefore TWO lines, and both exist only because the app owns the DOM
 * node and decides how long it lives:
 *
 *   windows.mount(scoreViewport)   // here is the box
 *   windows.destroy()              // and here is how long it lives
 *
 * The app donates a box. The window system does everything else.
 */
export const windows = new WindowLayer()

/** The Keypad: up on startup, toggled by Ctrl+Alt+K. Wired here, not in App.ts — see above. */
installKeypad(windows)

/** Properties: NOT up on startup (it is still empty), toggled by Ctrl+Alt+P. Same deal. */
installProperties(windows)
