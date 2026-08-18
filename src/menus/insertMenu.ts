import type { WindowLayer } from '@/windows/WindowLayer'
import { openClefWindow } from '@/windows/clefWindow'
import { openFeatherWindow } from '@/windows/featherWindow'
import { openTimeSignatureWindow } from '@/windows/timeSignatureWindow'
import { openTupletWindow } from '@/windows/tupletWindow'
import type { MenuLayer } from './MenuLayer'
import type { MenuBarTitle } from './menuBar'
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
  /**
   * ⭐⭐ **The marks hanging off the SELECTED NOTE, as rows that select them** — the way back to a mark
   * whose ink has been nudged off screen (`interactions/attachedMarks`, and its header for why no
   * on-ink affordance can serve).
   *
   * ⚠️ Read at OPEN time, not at build time, because the answer changes with the selection — which is
   * why this menu's items are now composed per opening. ⛔ And the shapes stay the app's: this file
   * learns "a label and something to run", never what a slur is.
   */
  attachedMarks?: () => { label: string; select: () => void }[]
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
    // The shortcut is a display echo of ShortcutConfig's 'Ctrl+f'; keep them in step.
    { label: 'Feathered Beam', shortcut: 'Ctrl+F', onSelect: () => openFeatherWindow(windows) },
    {
      label: 'Text',
      items: [
        // The shortcuts are display echoes of ShortcutConfig ('Ctrl+e' / 'Shift+Alt+t'); keep them in step.
        { label: 'Expression', shortcut: 'Ctrl+E', onSelect: () => actions.insertExpression?.() },
        { label: 'Tempo', shortcut: 'Alt+Shift+T', onSelect: () => actions.insertTempo?.() },
      ],
    },
    { label: 'Time Signature', shortcut: 'T', onSelect: () => openTimeSignatureWindow(windows) },
    // U — a display echo of ShortcutConfig's 'u'; keep them in step. (Sibelius has no key for its
    // own tuplet dialog; U is the one its manual suggests for a tuplet command.)
    { label: 'Tuplet', shortcut: 'U', onSelect: () => openTupletWindow(windows) },
  ]
}

/**
 * The bar's **Create** title — THE SAME TREE as the right-click menu, built from the same function.
 *
 * ⭐ Deliberately not a copy. Two lists of the same commands drift the first time one of them gains a
 * row, and the drift is silent: both menus keep working, they just stop agreeing. This is the Edit
 * menu's rule ("a row is not a second implementation of its key") applied to a whole tree.
 *
 * ⚠️ WHICH ONE IS REAL: the right-click menu. It is where these commands have always lived, it is at
 * the pointer — which is where you are inserting — and it is not going away. The bar title is the
 * DEMO's copy of it, kept while we learn whether a menu bar is wanted at all; sharing the tree is
 * what makes dropping it a one-line deletion instead of an audit.
 *
 * Sibelius names this menu Create and reaches it by right-click, which is why the same tree can wear
 * the two names without either being a lie.
 */
export function buildCreateMenu(actions: InsertMenuActions, windows: WindowLayer): MenuBarTitle {
  return { label: 'Create', items: buildInsertItems(actions, windows) }
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
  /**
   * ⭐ Composed PER OPENING, which the static tree was not: the `Select` rows depend on what is
   * selected right now. The insert rows are the same list either way.
   *
   * ⚠️ These rows go on the RIGHT-CLICK menu only, not on the bar's Create title — deliberately, and
   * it is the one place the two trees diverge. The right-click menu is about what you are pointing at
   * and what you have; a static command list on a bar is not the place to answer "what is attached to
   * my selection". See the note above `buildCreateMenu` for which of the two is the real one.
   */
  const itemsNow = (): MenuItem[] => {
    const marks = actions.attachedMarks?.() ?? []
    const insertItems = buildInsertItems(actions, windows)
    if (marks.length === 0) return insertItems
    return [
      { label: 'Select', items: marks.map(m => ({ label: m.label, onSelect: m.select })) },
      { separator: true },
      ...insertItems,
    ]
  }

  // Host-relative coordinates the menu will open at. The mouse path overwrites this with the real
  // click; the key path has no pointer of its own, so it reuses wherever the cursor last was over
  // the score (host centre until the pointer has ever been there).
  const openAt = (x: number, y: number, viaKeyboard = false): void => {
    const box = host.getBoundingClientRect()
    menus.open({ x: x - box.left, y: y - box.top, items: itemsNow(), viaKeyboard })
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
