import { windows } from '@/windows'
import { MenuLayer } from './MenuLayer'
import { installInsertMenu, type InsertMenuActions } from './insertMenu'
import { buildEditMenu, type EditMenuActions } from './editMenu'
import { buildDemoMenus } from './demoMenus'
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
export const menuActions: InsertMenuActions & EditMenuActions = {}

/**
 * THE MENU BAR'S RUNNING ORDER — the one list that says what is on the bar and in what sequence.
 *
 * Real titles and placeholders sit side by side here on purpose: a menu graduates by being written
 * as a module and swapped in on this line, and nothing else moves. Everything not named by a builder
 * is still lorem (`demoMenus.ts`) — inert, and obviously so.
 *
 * The fallback on a missing placeholder is an EMPTY menu rather than a throw: a bar with one dead
 * title is a far better failure than an editor that will not start.
 */
export function buildMenuBarTitles(): MenuBarTitle[] {
  const demo = buildDemoMenus()
  const lorem = (label: string): MenuBarTitle => demo.get(label) ?? { label, items: [] }
  return [
    lorem('File'),
    buildEditMenu(menuActions),
    lorem('View'),
    lorem('Create'),
    lorem('Staff'),
    lorem('Play'),
    lorem('Window'),
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
