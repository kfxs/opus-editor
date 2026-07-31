import { windows } from '@/windows'
import { MenuLayer } from './MenuLayer'
import { buildCreateMenu, installInsertMenu, type InsertMenuActions } from './insertMenu'
import { buildFileMenu, type FileMenuActions } from './fileMenu'
import { buildEditMenu, type EditMenuActions } from './editMenu'
import { buildViewMenu, type ViewMenuActions } from './viewMenu'
import { buildStaffMenu, type StaffMenuActions } from './staffMenu'
import { buildPlayMenu, type PlayMenuActions } from './playMenu'
import { buildWindowMenu } from './windowMenu'
import type { MenuBarTitle } from './menuBar'
import type { MenuItem } from './MenuItem'

/**
 * The app's one menu layer — the same deal the window layer gets, and for the same reason: it lives
 * here, in plain TS, so ANY framework-agnostic module can open a menu by importing it, and "add a
 * menu" never means "edit App.ts".
 *
 * It needs the box the app donated, and `App.ts`'s share of all this stays TWO lines, forever. So
 * the menu layer does not ask the component for a third one — it waits on the layer that already has
 * the box. That is the whole reason this file imports `windows`: for the host element, and nothing
 * else. The two layers are otherwise strangers, and a menu is not a window.
 */
export const menus = new MenuLayer()

/**
 * The Insert menu's command callbacks. This plain object is the seam between the framework-agnostic
 * menu and the app's editor controllers: the menu reads it at click time, and the app's glue fills it
 * in once the controllers exist (`menuActions.insertExpression = () => mouse.insertExpression()`).
 * Keeping it here — not in App.ts — is what keeps "add a menu" from meaning "edit App.ts"; the app
 * only hands over the callback, it does not know the menu's shape.
 */
export const menuActions: InsertMenuActions & FileMenuActions & EditMenuActions & ViewMenuActions & StaffMenuActions & PlayMenuActions = {}

/**
 * THE MENU BAR'S RUNNING ORDER — the one list that says what is on the bar and in what sequence.
 *
 * ⚠️⚠️ **PROVISIONAL — the demo's chrome, not the app's UI.** These seven titles and their grouping
 * are conventional guesses, not a taxonomy anyone chose; the real interface is undecided and may have
 * no menu bar at all. See the banner in `./menuBar` and docs/menus-design.md §"The menu bar is
 * PROVISIONAL". **This function is where the bar is deleted from**: it and the `mountMenuBar` call in
 * App.ts are the whole of it, because no row here implements anything — each runs a command that
 * already existed, through the seam that already ran it.
 *
 * ⭐ Every title is REAL, though. The bar began as lorem (`demoMenus.ts`, now deleted — the way the
 * Insert menu began, and the Lorem window before it): placeholders proved the shape, and each was
 * replaced by a module as its commands were asked for. A title graduates by being written as a
 * builder and swapped in on one line here, and nothing else moves. Nothing on the bar lies; that it
 * works is still not a claim that it belongs there.
 */
export function buildMenuBarTitles(): MenuBarTitle[] {
  return [
    buildFileMenu(menuActions),
    buildEditMenu(menuActions),
    buildViewMenu(menuActions),
    // The right-click menu's own tree, under its other name — one list, two ways in.
    buildCreateMenu(menuActions, windows),
    buildStaffMenu(menuActions),
    buildPlayMenu(menuActions),
    buildWindowMenu(windows),
  ]
}

windows.whenMounted((host) => {
  menus.mount(host)
  installInsertMenu(host, menus, windows, menuActions)
})

/**
 * Open a menu at VIEWPORT coordinates. The layer's own arithmetic is host-relative (it fills the box
 * the window layer donated), so anything working in client pixels — a `position: fixed` overlay, a
 * raw MouseEvent — converts here rather than each caller rediscovering the offset.
 */
export function openMenuAtViewport(
  x: number,
  y: number,
  items: MenuItem[],
  opts: { viaKeyboard?: boolean } = {},
): void {
  const host = menus.host
  if (!host) return
  const box = host.getBoundingClientRect()
  menus.open({ x: x - box.left, y: y - box.top, items, viaKeyboard: opts.viaKeyboard })
}
