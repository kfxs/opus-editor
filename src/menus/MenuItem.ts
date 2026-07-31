/**
 * What is IN a menu: data, and nothing else.
 *
 * The Keypad settled this shape — `keypadLayouts.ts` is a table of cells and one widget paints from
 * it. A menu is a TREE of rows and one layer paints from it. A row is never a `Button` widget: that
 * road ends with hover-to-open-flyout, the roving highlight and keyboard navigation all bolted onto
 * `Button`, which knows nothing about what it is for and must keep knowing nothing.
 *
 * A DISCRIMINATED union, not `{ label, onSelect?, items? }` with both optional. A row that has both a
 * callback and a submenu is nonsense, and this makes that nonsense unspellable rather than merely
 * discouraged.
 *
 * ⚠️ Radio groups and icons are deliberately NOT here. Each earns its place when a menu actually
 * wants it — the same guard the widget toolkit lives under. Four have:
 *
 * `disabled` — the Staff menu's rows need a bar selected, by a SPECIFIC gesture (a plain click for
 * the staff commands, Ctrl+Shift+click for the measure ones). A row that looks pressable and does
 * nothing is worse than one that says it cannot: the user's report about the dev toolbar's `Small`
 * button was exactly that, which is why those buttons carry `isEnabled` already. A greyed row is the
 * menu telling you the command exists but its target does not.
 *
 * `checked` — the View menu is nothing but toggles (linear view, justify-last, pages), and a toggle
 * whose state you cannot see is a button you press twice to find out what it did. A FUNCTION, not a
 * boolean, for the same reason `onSelect` is one: the items are built once, at mount, and a captured
 * boolean would show whatever was true that morning. It is read when the row is PAINTED, which is
 * enough — a menu never survives the action that changes its answer.
 *
 * `shortcut` — Insert ▸ Text ▸ Expression shows its `Ctrl+E` accelerator so the menu teaches the
 * keystroke. A pure display string; the binding itself lives in ShortcutConfig and this only echoes it.
 *
 * `labelFont` — the label is not ordinary UI text, and must be set the way it will APPEAR. Not an
 * icon flag, and not styling leaking into data: on a palette the label is a specimen of the thing
 * you are about to place. A row reading `sfz` in the system font DESCRIBES a dynamic; one reading 𝆑
 * IS the dynamic — the same distinction the score model itself turns on (utils/dynamics) — and a
 * row reading `dolce` upright describes a word the score will engrave leaning.
 *
 * One field rather than a `music` and an `italic` flag, because a label set in BOTH is nonsense and
 * this makes it unspellable — the same reason the union above exists at all. Rides the LEAF variant
 * only: a submenu is a word.
 *
 * An item never learns where it is: not its x/y, not that it sits in a flyout. Placement is the menu
 * system's arithmetic (docs/windows-design.md rule 3, inherited whole).
 */
/**
 * How a label is SET, when plain UI text would misrepresent it.
 *   `music`  — SMuFL glyphs sized for a DYNAMIC (𝆑, big): the score's notation font, blown up.
 *   `note`   — SMuFL note-VALUE glyphs (metNote/text-note family) — designed to sit inline in tempo
 *              text, so smaller than a dynamic and centred on the notehead, not the whole glyph.
 *   `italic` — the serif italic the score engraves expression text in (`dolce`, `sempre`).
 *   `bold`   — the upright bold serif the score engraves tempo text in (`Allegro`, `Moderato`).
 */
export type LabelFont = 'music' | 'note' | 'italic' | 'bold'

/**
 * A row's text — or a function read as the row is PAINTED, for the row whose label IS its state.
 * Play ⇄ Stop is the case: one command, one key, and a word that has to tell you which way it will
 * go. Same late-read rule as `checked`, and the same reason (items are built once, at mount).
 *
 * ⚠️ A dynamic label is for a row that CHANGES WHAT IT SAYS, never for one that changes what it
 * does. Two commands hiding behind one row that renames itself is how a menu stops being readable.
 */
export type MenuLabel = string | (() => string)

export type MenuItem =
  | {
      label: MenuLabel
      onSelect: () => void
      shortcut?: string
      labelFont?: LabelFont
      checked?: () => boolean
      /** Greyed, unclickable, and skipped by the arrow keys. Read once, as the panel is built. */
      disabled?: () => boolean
    }
  | { label: string; items: MenuItem[] }
  | { separator: true }
  | { columnBreak: true }

export function isSeparator(item: MenuItem): item is { separator: true } {
  return 'separator' in item
}

/**
 * Start a new COLUMN. A palette menu — Sibelius's expressions window is the model — is a wide grid
 * of related markings, not a list you scroll: stacked, its two groups run past the bottom of the
 * viewport, side by side they fit on screen at once.
 *
 * A marker item rather than `MenuOptions.columns: MenuItem[][]`, for the same reason `separator` is
 * one: items stay a single flat list, so building, measuring, hovering and the keyboard's row order
 * all keep working untouched — a column break is a rendering instruction sitting in the data, and
 * nothing downstream has to learn a second shape.
 */
export function isColumnBreak(item: MenuItem): item is { columnBreak: true } {
  return 'columnBreak' in item
}

export function isSubmenu(item: MenuItem): item is { label: string; items: MenuItem[] } {
  return 'items' in item
}
