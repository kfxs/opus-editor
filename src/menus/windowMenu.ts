import type { WindowLayer } from '@/windows/WindowLayer'
import { isKeypadOpen, toggleKeypad } from '@/windows/keypad'
import { isPropertiesOpen, togglePropertiesWindow } from '@/windows/properties'
import type { MenuBarTitle } from './menuBar'

/**
 * The **Window** menu — show/hide the editor's panels.
 *
 * ⭐ It needs NO app glue, and that is the point of the window layer: a panel's lifecycle belongs to
 * the panel (`windows/keypad`, `windows/properties` each own their open/close/toggle and their own
 * accelerator), so a menu row is a direct call and not a callback threaded through App.ts. Compare
 * `editMenu.ts`, whose commands are the EDITOR's and must come through the app.
 *
 * Each row ticks itself by ASKING THE WINDOW whether it is up. Nothing here remembers state — a
 * panel closed by its own ✕, or by Ctrl+Alt+K, leaves this menu correct without being told.
 *
 * ⚠️ `windows` is a PARAMETER, never the imported singleton — the convention every window definition
 * follows (`docs/DESIGN-PRINCIPLES.md` boundary case 5).
 */

/**
 * Build the Window menu.
 *
 * ⚠️ The keys are display echoes of the two windows' own `document` bindings (Ctrl+Alt+K in
 * `installKeypad`, Ctrl+Alt+P in `installProperties`) — not `ShortcutConfig`, which never sees them.
 * Keep them in step with those two files.
 */
export function buildWindowMenu(windows: WindowLayer): MenuBarTitle {
  return {
    label: 'Window',
    items: [
      {
        label: 'Keypad',
        shortcut: 'Ctrl+Alt+K',
        checked: () => isKeypadOpen(windows),
        onSelect: () => toggleKeypad(windows),
      },
      {
        label: 'Properties',
        shortcut: 'Ctrl+Alt+P',
        checked: () => isPropertiesOpen(windows),
        onSelect: () => togglePropertiesWindow(windows),
      },
    ],
  }
}
