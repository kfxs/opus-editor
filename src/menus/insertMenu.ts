import type { WindowLayer } from '@/windows/WindowLayer'
import { openClefWindow } from '@/windows/clefWindow'
import { openFeatherWindow } from '@/windows/featherWindow'
import { openTimeSignatureWindow } from '@/windows/timeSignatureWindow'
import { openTupletWindow } from '@/windows/tupletWindow'
import type { MenuLayer } from './MenuLayer'
import type { MenuItem } from './MenuItem'

/**
 * The Insert menu — the score's own right-click / Menu-key menu, and the FIRST real menu built on
 * the primitive (`MenuLayer` + `MenuItem` + `placement`, which stay generic so the next menu — a
 * menu bar, an edit menu — reuses them without touching this file).
 *
 * Every row is now a real command. It began as lorem ipsum — the primitive proven with rows that only
 * logged, the way the Lorem window proved the window layer — and the placeholders went as the commands
 * replaced them, one at a time. Nothing was kept just to keep it: the deep chains and separators they
 * exercised are the PRIMITIVE's to prove, and MenuLayer's own tests do that (MenuLayer.keyboard /
 * .columns), not a menu the user opens.
 */

/**
 * The commands the Insert menu can invoke, supplied by the app's glue (they close over the editor's
 * controllers, which the framework-agnostic menu singleton cannot see). Read at CLICK time through a
 * shared object (see `menuActions` in ./index), so the menu can be built before the app has filled
 * them in — hence optional. Grows one field per command that needs the app; a command that only opens
 * a window needs no field here at all (see Clef below).
 */
export interface InsertMenuActions {
  /** Insert ▸ Text ▸ Expression — the same action as the Ctrl+E shortcut. */
  insertExpression?: () => void
  /** Insert ▸ Text ▸ Tempo — the same action as the Alt+Shift+T shortcut. */
  insertTempo?: () => void
}

/**
 * The Insert menu's rows. Leaf `onSelect`s read `actions` late (at click), so the app can wire the
 * callbacks after the menu is built.
 *
 * ⚠️ `windows` is a PARAMETER, like it is on every window definition (`openClefWindow(windows)`).
 * This file used to import the singleton instead — the one breach of the convention, and exactly the
 * case `docs/DESIGN-PRINCIPLES.md` boundary case 5 warns about: *"a definition module that imports
 * the singleton instead of receiving it turns a sweep into archaeology."*
 */
function buildInsertItems(actions: InsertMenuActions, windows: WindowLayer): MenuItem[] {
  return [
    // Opens the Clef window directly: a window is opened by importing the layer, not by asking the
    // app for a callback, so a command that only puts a window up needs no `actions` field at all.
    { label: 'Clef', shortcut: 'Q', onSelect: () => openClefWindow(windows) },
    // No accelerator: the window is still the Tuplet window's layout wearing a new title, so there
    // is nothing yet worth a key. The feather's real way in is the Keypad's `accel.`/`rit.` keys.
    { label: 'Feathered Beam', onSelect: () => openFeatherWindow(windows) },
    {
      label: 'Text',
      items: [
        // The shortcuts are display echoes of ShortcutConfig ('Ctrl+e' / 'Shift+Alt+t'); keep them in step.
        { label: 'Expression', shortcut: 'Ctrl+E', onSelect: () => actions.insertExpression?.() },
        { label: 'Tempo', shortcut: 'Alt+Shift+T', onSelect: () => actions.insertTempo?.() },
      ],
    },
    { label: 'Time Signature', shortcut: 'T', onSelect: () => openTimeSignatureWindow(windows) },
    // No accelerator: the window is still an empty shell, so there is nothing yet worth a key.
    { label: 'Tuplet', onSelect: () => openTupletWindow(windows) },
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
export function installInsertMenu(host: HTMLElement, menus: MenuLayer, windows: WindowLayer, actions: InsertMenuActions): void {
  const items = buildInsertItems(actions, windows)
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
