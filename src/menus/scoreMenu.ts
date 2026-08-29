import type { MenuBarTitle } from './menuBar'
import type { MenuCommand, MenuToggle } from './menuCommands'

/**
 * The **Score** menu — the dev shell's `Staff:` and `Measure:` palettes, in one title.
 *
 * ⚠️ It was titled **Staff** until 2026-08-27 (his call). The rows did not change; the title did,
 * and it is the better name for what they are: these edit the score's STRUCTURE — how many staves it
 * has, how many bars, how big a staff is drawn — rather than the music written on it. "Staff" named
 * the first group and left the measure commands filed under something they are not. ⛔ Still DEMO
 * chrome either way (see `./index`): every row runs a command that already existed.
 *
 * They are two groups because they answer to two DIFFERENT selection gestures, and that distinction
 * is real (`devToolbar.ts` states it): the staff commands act on a plain-clicked bar (the SINGLE box)
 * — a staff-structure edit relative to the staff you clicked — while the measure commands act on a
 * Ctrl+Shift+click span (the DOUBLE box) — a measure-structure edit. One menu, two groups, a rule
 * between them.
 *
 * ⭐ STAFF FIRST — the group needing the simpler gesture leads, so it is also the pair you are more
 * likely to be able to use. Measures follow under the rule.
 *
 * ⭐ The rows GREY OUT when their gesture has not been made — the first menu to need `disabled`, and
 * the reason that field now exists. These commands are unusually easy to try in vain: nothing on
 * screen says "Ctrl+Shift+click a bar first", and the same user report ("`Small` can be clicked with
 * no bar selected") is what put `isEnabled` on the toolbar's buttons. A greyed row says the command
 * is real and its target is missing, which is the whole of the answer.
 */

/**
 * The Score menu's commands, supplied by the app's glue — each carrying its own `enabled`, because
 * whether a row can act is a question about the selection and only the editor can answer it.
 */
export interface ScoreMenuActions {
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
  /**
   * `PaletteController.pressGroupSymbol('brace')` — the SAME method the toolbar's `{ Brace` runs.
   *
   * ⭐ **Always enabled, and that is the point of the gesture**: it APPLIES to the selected staves,
   * else it ARMS a stamp and the next click says where (his rule, 2026-08-29). ⛔ So there is no
   * selection to require — unlike the four rows above, which grey out because they genuinely have
   * nothing to act on.
   */
  insertBrace?: MenuCommand
  /** `PaletteController.pressGroupSymbol('bracket')`. Always enabled, for {@link insertBrace}'s
   *  reason. */
  insertBracket?: MenuCommand
  /** 🚧 Open the Title dialog. Always enabled — it edits the SCORE, not a selection. */
  addTitle?: MenuCommand
  /** 🚧 Open the Composer dialog. Always enabled, for {@link addTitle}'s reason. */
  addComposer?: MenuCommand
}

/** An unwired row is greyed, not silently dead. */
const off = (c: MenuCommand | MenuToggle | undefined): boolean => !c || c.enabled?.() === false

/**
 * Build the Score menu.
 *
 * ⚠️ `Ctrl+Shift+B` is a display echo of `ShortcutConfig`'s 'Ctrl+Shift+b'; keep them in step. The
 * other four have no key bound, and so print none — *Insert Measure Before* is palette-only by
 * design (Sibelius binds only the "after" insert).
 */
export function buildScoreMenu(actions: ScoreMenuActions): MenuBarTitle {
  return {
    label: 'Score',
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
      { separator: true },
      // ⭐⭐ **THE GROUPING SIGNS** — his ask, 2026-08-29: a section before the title one, *"wired
      // like the palette"*. Each row runs `PaletteController.pressGroupSymbol`, the very method the
      // dev shell's `Group:` buttons run — ⛔ nothing is reimplemented here, which is this menu's
      // whole rule (`./index`).
      //
      // ⭐ **Their own group, and no `disabled`.** The four rows above grey out because they need a
      // bar selected by a particular gesture; these never can, because APPLIES-else-ARMS means an
      // empty selection is a legal input rather than a missing one — it arms a stamp and the next
      // click says where. A row that greys and a row that cannot should not share a block, which is
      // the same argument the title group below makes for itself.
      //
      // ⛔ **No sub-bracket row, by his call**: *"i don't need a palette with sub-bracket… just make
      // the console for it"* (`__groups.subBracket()`).
      {
        label: 'Insert Brace',
        disabled: () => off(actions.insertBrace),
        onSelect: () => actions.insertBrace?.run(),
      },
      {
        label: 'Insert Bracket',
        disabled: () => off(actions.insertBracket),
        onSelect: () => actions.insertBracket?.run(),
      },
      { separator: true },
      // 🚧 **THE SCORE'S OWN TEXT** — its title and its composer, each opening a one-box dialog
      // (`windows/scoreTextWindow`). ⛔ SCAFFOLDING: read `engine/rendering/ScoreHeaderPass`'s note.
      //
      // ⭐ Under a rule of their own, and the separator is the argument: the two groups above edit
      // the score's STRUCTURE and each needs a bar selected by a specific gesture, where these two
      // are about the DOCUMENT and are always available. A row that greys out and a row that never
      // does should not sit in one block.
      //
      // ⚠️ Labelled *Add*, as he asked, even though each opens on what is already there and so
      // edits as much as it adds. Kept because it is what he typed and because *Add Title* is what
      // you go looking for when there is no title — which is the case the row exists for.
      {
        label: 'Add Title…',
        disabled: () => off(actions.addTitle),
        onSelect: () => actions.addTitle?.run(),
      },
      {
        label: 'Add Composer…',
        disabled: () => off(actions.addComposer),
        onSelect: () => actions.addComposer?.run(),
      },
    ],
  }
}
