import { windows } from '@/windows'
import { MenuLayer } from './MenuLayer'
import { installInsertMenu, type InsertMenuActions } from './insertMenu'

/**
 * The app's one menu layer — the same deal the window layer gets, and for the same reason: it lives
 * here, in plain TS, so ANY framework-agnostic module can open a menu by importing it, and "add a
 * menu" never means "edit App.vue".
 *
 * It needs the box the app donated, and `App.vue`'s share of all this stays TWO lines, forever. So
 * the menu layer does not ask the component for a third one — it waits on the layer that already has
 * the box. That is the whole reason this file imports `windows`: for the host element, and nothing
 * else. The two layers are otherwise strangers, and a menu is not a window.
 */
export const menus = new MenuLayer()

/**
 * The Insert menu's command callbacks. This plain object is the seam between the framework-agnostic
 * menu and the app's editor controllers: the menu reads it at click time, and the app's glue fills it
 * in once the controllers exist (`menuActions.insertExpression = () => mouse.insertExpression()`).
 * Keeping it here — not in App.vue — is what keeps "add a menu" from meaning "edit App.vue"; the app
 * only hands over the callback, it does not know the menu's shape.
 */
export const menuActions: InsertMenuActions = {}

windows.whenMounted((host) => {
  menus.mount(host)
  installInsertMenu(host, menus, menuActions)
})
