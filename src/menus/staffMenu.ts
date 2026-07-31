import type { MenuBarTitle } from './menuBar'
import type { MenuCommand, MenuToggle } from './menuCommands'

/**
 * The **Staff** menu — the dev shell's `Staff:` and `Measure:` palettes, in one title.
 *
 * They are two groups in the toolbar because they answer to two DIFFERENT selection gestures, and
 * that distinction is real (`devToolbar.ts` states it): the staff commands act on a plain-clicked bar
 * (the SINGLE box) — a staff-structure edit relative to the staff you clicked — while the measure
 * commands act on a Ctrl+Shift+click span (the DOUBLE box) — a measure-structure edit. One menu, two
 * groups, a rule between them.
 *
 * ⭐ STAFF FIRST. The title says Staff, so what it opens with had better be staff commands; and the
 * staff group needs the simpler gesture, so it is also the pair you are more likely to be able to
 * use. Measures follow under the rule.
 *
 * ⭐ The rows GREY OUT when their gesture has not been made — the first menu to need `disabled`, and
 * the reason that field now exists. These commands are unusually easy to try in vain: nothing on
 * screen says "Ctrl+Shift+click a bar first", and the same user report ("`Small` can be clicked with
 * no bar selected") is what put `isEnabled` on the toolbar's buttons. A greyed row says the command
 * is real and its target is missing, which is the whole of the answer.
 */

/**
 * The Staff menu's commands, supplied by the app's glue — each carrying its own `enabled`, because
 * whether a row can act is a question about the selection and only the editor can answer it.
 */
export interface StaffMenuActions {
  /** `PaletteController.addStaffAbove` — needs a plain-clicked bar. */
  addStaffAbove?: MenuCommand
  /** `PaletteController.addStaffBelow` — needs a plain-clicked bar. */
  addStaffBelow?: MenuCommand
  /** The clicked bar's staff drawn small (0.7) or full size. Its light is a question about the SCORE. */
  smallStaff?: MenuToggle
  /** `PaletteController.addMeasureBefore` — needs a Ctrl+Shift+click span. */
  addMeasureBefore?: MenuCommand
  /** `PaletteController.addMeasureAfter` — needs a Ctrl+Shift+click span. */
  addMeasureAfter?: MenuCommand
}

/** An unwired row is greyed, not silently dead. */
const off = (c: MenuCommand | MenuToggle | undefined): boolean => !c || c.enabled?.() === false

/**
 * Build the Staff menu.
 *
 * ⚠️ `Ctrl+Shift+B` is a display echo of `ShortcutConfig`'s 'Ctrl+Shift+b'; keep them in step. The
 * other four have no key bound, and so print none — *Insert Measure Before* is palette-only by
 * design (Sibelius binds only the "after" insert).
 */
export function buildStaffMenu(actions: StaffMenuActions): MenuBarTitle {
  return {
    label: 'Staff',
    items: [
      {
        label: 'Add Staff Above',
        disabled: () => off(actions.addStaffAbove),
        onSelect: () => actions.addStaffAbove?.run(),
      },
      {
        label: 'Add Staff Below',
        disabled: () => off(actions.addStaffBelow),
        onSelect: () => actions.addStaffBelow?.run(),
      },
      {
        label: 'Small Staff',
        checked: () => actions.smallStaff?.isOn() === true,
        disabled: () => off(actions.smallStaff),
        onSelect: () => actions.smallStaff?.toggle(),
      },
      { separator: true },
      {
        label: 'Insert Measure Before',
        disabled: () => off(actions.addMeasureBefore),
        onSelect: () => actions.addMeasureBefore?.run(),
      },
      {
        label: 'Insert Measure After',
        shortcut: 'Ctrl+Shift+B',
        disabled: () => off(actions.addMeasureAfter),
        onSelect: () => actions.addMeasureAfter?.run(),
      },
    ],
  }
}
