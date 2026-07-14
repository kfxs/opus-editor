import { windows } from '@/windows'
import { MenuLayer } from './MenuLayer'
import { installLoremContextMenu } from './demo/loremMenu'

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

windows.whenMounted((host) => {
  menus.mount(host)
  installLoremContextMenu(host, menus)
})
