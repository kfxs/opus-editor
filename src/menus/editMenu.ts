import type { MenuBarTitle } from './menuBar'

/**
 * The **Edit** menu — the first menu-bar title that is REAL. Every row runs a command the editor
 * already has, and every accelerator shown is one the editor already binds.
 *
 * ⭐ A row is not a second implementation of its key. Each `onSelect` runs the SAME registered action
 * the accelerator runs (`ShortcutManager.run`, reached through the callbacks below) — `Delete` alone
 * is a switch over every selectable element kind, and a copy of it would drift the first time one of
 * the two was fixed. The menu's job is to NAME the command and show its key, nothing more.
 *
 * WHAT IS NOT HERE, and why:
 *   • **Cut** — the editor has no cut. `ClipboardController` has `copy` and `paste`; nothing removes
 *     while copying, and no key is bound to it. A row that quietly meant copy-then-delete would be a
 *     new feature wearing a menu row's clothes.
 *   • **Select All** — likewise unbound.
 *   • **Greyed-out rows** — `MenuItem` has no disabled state yet (deliberately; see its doc). Copy
 *     with nothing selected does nothing, exactly as Ctrl+C does. When the menu genuinely wants the
 *     grey, that is when `disabled` earns its place in the union.
 */

/**
 * The commands the Edit menu invokes, supplied by the app's glue — the same seam and the same reason
 * as `InsertMenuActions`: this file is framework-agnostic and cannot see the editor's controllers.
 * Read LATE (at click), so the menu can be built before the app has filled them in.
 */
export interface EditMenuActions {
  /** Ctrl+Z — the `undo` action. */
  undo?: () => void
  /** Ctrl+Shift+Z — the `redo` action. */
  redo?: () => void
  /** Ctrl+C — the `copySelection` action. */
  copy?: () => void
  /** Ctrl+V — the `pasteClipboard` action. */
  paste?: () => void
  /** Delete / Backspace — the `deleteSelected` action. */
  deleteSelection?: () => void
}

/**
 * Build the Edit menu.
 *
 * ⚠️ The `shortcut` strings are DISPLAY echoes of `ShortcutConfig` ('Ctrl+z', 'Ctrl+Shift+z',
 * 'Ctrl+c', 'Ctrl+v', 'Delete'); keep them in step, as every other menu that shows a key does.
 */
export function buildEditMenu(actions: EditMenuActions): MenuBarTitle {
  return {
    label: 'Edit',
    items: [
      { label: 'Undo', shortcut: 'Ctrl+Z', onSelect: () => actions.undo?.() },
      { label: 'Redo', shortcut: 'Ctrl+Shift+Z', onSelect: () => actions.redo?.() },
      { separator: true },
      { label: 'Copy', shortcut: 'Ctrl+C', onSelect: () => actions.copy?.() },
      { label: 'Paste', shortcut: 'Ctrl+V', onSelect: () => actions.paste?.() },
      { separator: true },
      { label: 'Delete', shortcut: 'Del', onSelect: () => actions.deleteSelection?.() },
    ],
  }
}
