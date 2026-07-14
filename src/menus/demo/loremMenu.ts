import type { MenuLayer } from '../MenuLayer'
import type { MenuItem } from '../MenuItem'

/**
 * The test rig for the menu primitive, and nothing more — the Lorem WINDOW's opposite number.
 *
 * Right-click empty paper in Sibelius and a floating list appears; some rows carry a ▸ and open a
 * flyout. This is that shape, with lorem for labels: selecting a row does `console.log` and touches
 * no score. Nothing here is a command, on purpose — the point is to prove the primitive before any
 * real menu is designed on top of it (and a real one may well be a menu bar instead).
 */

/** A leaf that only says what was picked. The item knows its label; it never learns where it is. */
function say(label: string): MenuItem {
  return { label, onSelect: () => console.log(`[menu] selected: ${label}`) }
}

const LOREM_ITEMS: MenuItem[] = [
  say('Lorem ipsum dolor'),
  say('Consectetur adipiscing'),
  { separator: true },
  {
    label: 'Sed do eiusmod',
    items: [
      say('Tempor incididunt'),
      say('Ut labore et dolore'),
      { separator: true },
      {
        label: 'Magna aliqua',
        // A second level, because a chain that only ever goes one deep proves nothing about the chain.
        items: [say('Ut enim ad minim'), say('Quis nostrud'), say('Exercitation ullamco')],
      },
    ],
  },
  {
    label: 'Duis aute irure',
    items: [say('Reprehenderit in voluptate'), say('Velit esse cillum'), say('Fugiat nulla pariatur')],
  },
  { separator: true },
  say('Excepteur sint occaecat'),
  say('Sunt in culpa qui officia'),
]

/**
 * Right-click anywhere in the score viewport opens it, at the pointer.
 *
 * `preventDefault` is scoped to the HOST — the browser's own context menu is suppressed over the
 * score and nowhere else, so the palette, the JSON panel and the rest of the page still behave like
 * a web page.
 *
 * The coordinates handed to the menu are relative to the host, because that is the box the layer
 * fills — the same arithmetic a window's geometry lives in, and the reason a menu neither scrolls
 * with the music nor scales with the zoom.
 */
export function installLoremContextMenu(host: HTMLElement, menus: MenuLayer): void {
  host.addEventListener('contextmenu', (e: MouseEvent) => {
    e.preventDefault()
    const box = host.getBoundingClientRect()
    menus.open({ x: e.clientX - box.left, y: e.clientY - box.top, items: LOREM_ITEMS })
  })
}
