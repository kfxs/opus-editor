import { dbg } from '@/utils/debug'
import { windows } from '@/windows'
import { openClefWindow } from '@/windows/clefWindow'
import type { MenuLayer } from './MenuLayer'
import type { MenuItem } from './MenuItem'

/**
 * The Insert menu — the score's own right-click / Menu-key menu, and the FIRST real menu built on
 * the primitive (`MenuLayer` + `MenuItem` + `placement`, which stay generic so the next menu — a
 * menu bar, an edit menu — reuses them without touching this file).
 *
 * The wiring below is final; the ITEMS are not. They are still the lorem placeholders the primitive
 * was proven with — selecting a row just `dbg`s and touches no score. We keep them only so
 * the menu has something to show while its real commands (insert note, clef, time signature, …) are
 * added one at a time, each replacing a lorem row. Nothing here is a command yet, on purpose.
 */

/**
 * The commands the Insert menu can invoke, supplied by the app's glue (they close over the editor's
 * controllers, which the framework-agnostic menu singleton cannot see). Read at CLICK time through a
 * shared object (see `menuActions` in ./index), so the menu can be built before the app has filled
 * them in — hence optional. Grows one field per real command as the lorem rows are replaced.
 */
export interface InsertMenuActions {
  /** Insert ▸ Text ▸ Expression — the same action as the Ctrl+E shortcut. */
  insertExpression?: () => void
  /** Insert ▸ Text ▸ Tempo — the same action as the Alt+Shift+T shortcut. */
  insertTempo?: () => void
}

/**
 * TEMPORARY placeholder leaf — says what was picked and nothing more. Replace each `say(...)` with a
 * real `{ label, onSelect }` as the command behind it lands; the helper goes when the last one does.
 */
function say(label: string): MenuItem {
  return { label, onSelect: () => dbg(`[menu] selected: ${label}`) }
}

/**
 * The Insert menu's rows. The Text submenu is the first REAL command; the lorem rows below it are
 * still placeholders, replaced one at a time. Leaf `onSelect`s read `actions` late (at click), so the
 * app can wire the callbacks after the menu is built.
 */
function buildInsertItems(actions: InsertMenuActions): MenuItem[] {
  return [
    // Opens the Clef window directly: a window is opened by importing the layer, not by asking the
    // app for a callback, so a command that only puts a window up needs no `actions` field at all.
    { label: 'Clef', shortcut: 'Q', onSelect: () => openClefWindow(windows) },
    {
      label: 'Text',
      items: [
        // The shortcuts are display echoes of ShortcutConfig ('Ctrl+e' / 'Shift+Alt+t'); keep them in step.
        { label: 'Expression', shortcut: 'Ctrl+E', onSelect: () => actions.insertExpression?.() },
        { label: 'Tempo', shortcut: 'Alt+Shift+T', onSelect: () => actions.insertTempo?.() },
      ],
    },
    { separator: true },
    // TEMPORARY: lorem rows, to be replaced by real insert commands little by little.
    say('Consectetur adipiscing'),
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
}

/**
 * Right-click anywhere in the score viewport opens it, at the pointer — and so does the Menu key
 * (the one right of AltGr; `key === 'ContextMenu'` on every layout that has it), the keyboard's
 * standing invitation to "open the context menu for where I am". Both are the SAME gesture — "give
 * me the menu here" — so both call one open path; only the anchor point differs.
 *
 * `preventDefault` is scoped to the HOST — the browser's own context menu is suppressed over the
 * score and nowhere else, so the palette, the JSON panel and the rest of the page still behave like
 * a web page.
 *
 * The coordinates handed to the menu are relative to the host, because that is the box the layer
 * fills — the same arithmetic a window's geometry lives in, and the reason a menu neither scrolls
 * with the music nor scales with the zoom.
 */
export function installInsertMenu(host: HTMLElement, menus: MenuLayer, actions: InsertMenuActions): void {
  const items = buildInsertItems(actions)
  // Host-relative coordinates the menu will open at. The mouse path overwrites this with the real
  // click; the key path has no pointer of its own, so it reuses wherever the cursor last was over
  // the score (host centre until the pointer has ever been there).
  const openAt = (x: number, y: number, viaKeyboard = false): void => {
    const box = host.getBoundingClientRect()
    menus.open({ x: x - box.left, y: y - box.top, items, viaKeyboard })
  }

  let lastPointer: { x: number; y: number } | null = null
  host.addEventListener('pointermove', (e: PointerEvent) => {
    lastPointer = { x: e.clientX, y: e.clientY }
  })

  host.addEventListener('contextmenu', (e: MouseEvent) => {
    e.preventDefault()
    openAt(e.clientX, e.clientY)
  })

  // The Menu key is a global keystroke, not a host event — it fires wherever focus is. Guard on the
  // key and nothing else: it has one job.
  document.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key !== 'ContextMenu') return
    e.preventDefault()
    // viaKeyboard: the menu opens AT the last pointer position, so without it the row under that
    // very pointer would light up as a selection the keyboard does not own.
    if (lastPointer) {
      openAt(lastPointer.x, lastPointer.y, true)
    } else {
      const box = host.getBoundingClientRect()
      openAt(box.left + box.width / 2, box.top + box.height / 2, true)
    }
  })
}
