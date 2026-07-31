import type { MenuBarTitle } from './menuBar'
import type { MenuToggle } from './menuCommands'

/**
 * The **View** menu — the dev shell's `View:` palette, in the bar where it belongs.
 *
 * Those three buttons are not scaffolding: linear-vs-wrapped, a justified or ragged last system, and
 * whether the music is drawn on PAGES are all decisions about the document you are looking at. They
 * only ever lived in `dev/` because that strip was the one place to put a control. This menu is where
 * they graduate to; the dev toggles stay for now (both drive the same `PaletteController`, so they
 * cannot disagree) and can go when the shell does.
 *
 * ⭐ Every row is a TOGGLE, and shows its state with a tick — the first menu to want `checked`, which
 * is why that field now exists on `MenuItem`. A toggle you cannot read is a button you press twice to
 * find out what it did.
 *
 * ONE row for the view mode, not the palette's two. The palette offers `Wrapped` and `Linear` as a
 * radio pair; a tick on "Linear view" says the same thing in half the space AND is exactly what
 * `Ctrl+Shift+L` does, so the row can honestly print that key. A radio pair cannot: the accelerator
 * next to `Wrapped` would be a key that switches you AWAY from wrapped.
 */

/**
 * The View menu's toggles, supplied by the app's glue — the same late-read seam as
 * `InsertMenuActions` / `EditMenuActions`. Optional, so the menu can be built before the app has
 * filled them in; an unwired row reads as off and does nothing.
 */
export interface ViewMenuActions {
  /** Linear view (one endless system) vs wrapped. `PaletteController.toggleViewMode`. */
  linearView?: MenuToggle
  /** Stretch the LAST system to the page width, or leave it ragged. */
  justifyLastSystem?: MenuToggle
  /** Draw on pages instead of the endless sketching canvas. */
  useLayout?: MenuToggle
}

/** Read a toggle that may not be wired yet. */
const isOn = (t: MenuToggle | undefined): boolean => t?.isOn() === true

/**
 * Build the View menu.
 *
 * ⚠️ `Ctrl+Shift+L` is a DISPLAY echo of `ShortcutConfig`'s 'Ctrl+Shift+l'; keep them in step. The
 * other two rows have no key, and so print none.
 */
export function buildViewMenu(actions: ViewMenuActions): MenuBarTitle {
  return {
    label: 'View',
    items: [
      {
        label: 'Linear view',
        shortcut: 'Ctrl+Shift+L',
        checked: () => isOn(actions.linearView),
        onSelect: () => actions.linearView?.toggle(),
      },
      { separator: true },
      {
        label: 'Pages',
        checked: () => isOn(actions.useLayout),
        onSelect: () => actions.useLayout?.toggle(),
      },
      {
        label: 'Justify last system',
        checked: () => isOn(actions.justifyLastSystem),
        onSelect: () => actions.justifyLastSystem?.toggle(),
      },
    ],
  }
}
