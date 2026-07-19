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
 * ⚠️ Checkmarks, radio groups, disabled rows and icons are deliberately NOT here. Each earns its
 * place when a menu actually wants it — the same guard the widget toolkit lives under. The `shortcut`
 * hint is the first to earn it: Insert ▸ Text ▸ Expression shows its `Ctrl+E` accelerator so the
 * menu teaches the keystroke. It rides the LEAF variant only — a submenu opens a flyout, it is not a
 * keystroke — and is a pure display string (the binding itself lives in ShortcutConfig; this only
 * echoes it).
 *
 * An item never learns where it is: not its x/y, not that it sits in a flyout. Placement is the menu
 * system's arithmetic (docs/windows-design.md rule 3, inherited whole).
 */
export type MenuItem =
  | { label: string; onSelect: () => void; shortcut?: string }
  | { label: string; items: MenuItem[] }
  | { separator: true }

export function isSeparator(item: MenuItem): item is { separator: true } {
  return 'separator' in item
}

export function isSubmenu(item: MenuItem): item is { label: string; items: MenuItem[] } {
  return 'items' in item
}
