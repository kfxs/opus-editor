import { dbg } from '@/utils/debug'
import type { MenuBarTitle } from './menuBar'
import type { MenuItem } from './MenuItem'

/**
 * PLACEHOLDER menu-bar contents — deliberately lorem ipsum, deliberately inert.
 *
 * ┌──────────────────────────────────────────────────────────────────────────────────────────────┐
 * │  THIS IS NOT THE APP'S MENU. The demo is published so the editor can be TRIED (and so the     │
 * │  production build can be watched running); what its commands should be is not decided, and    │
 * │  nothing here is a proposal. The top-level TITLES are real words only because a menu bar with │
 * │  no File/Edit/View does not read as a menu bar — the rows under them are lorem, so no row can │
 * │  be mistaken for a command that exists, or for one we have promised.                          │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠️ No `shortcut` hints. A row's accelerator is the one part of a menu that acts BEHIND the menu:
 * printing `Ctrl+S` beside a placeholder either promises a keystroke that does nothing, or names one
 * the editor has already bound to something else. The rows are silent about keys until they are real.
 *
 * The real commands the editor already has are NOT duplicated here either — they live on the score's
 * own Insert menu (`insertMenu.ts`), reached by right-click, where they have always been. Two ways to
 * invoke one action is convenience; two DIFFERENT menus each half-true is confusion.
 */

/** The word pool. Plain lorem, in short label-sized phrases. */
const LOREM = [
  'Lorem ipsum',
  'Dolor sit amet',
  'Consectetur',
  'Adipiscing elit',
  'Sed do eiusmod',
  'Tempor incididunt',
  'Ut labore et dolore',
  'Magna aliqua',
  'Ad minim veniam',
  'Quis nostrud',
  'Exercitation ullamco',
  'Laboris nisi',
  'Aliquip ex ea',
  'Commodo consequat',
  'Duis aute irure',
  'In reprehenderit',
  'Voluptate velit',
  'Esse cillum',
  'Excepteur sint',
  'Occaecat cupidatat',
  'Non proident',
  'Sunt in culpa',
  'Qui officia deserunt',
  'Mollit anim',
]

/**
 * The SHAPES the bar's menus are drawn from — how many rows, where the rules fall, which row opens a
 * flyout. Written as a shape rather than as authored trees because the labels carry no meaning: what
 * a placeholder menu has to be right about is its FORM (a short menu and a long one, a submenu, rules
 * that group), and that is exactly what this table says. A number is N plain rows; `'-'` is a
 * separator; a number in brackets is a submenu of that many rows.
 */
type Shape = Array<number | '-' | [number]>

/**
 * The placeholder set — every bar title whose commands are still undecided. A title LEAVES this
 * table the day it becomes real (Edit did: `editMenu.ts`), which is what keeps "what is still lorem"
 * a fact you can read rather than one you have to test.
 *
 * ⚠️ The bar's ORDER is not here. It is in `menus/index.ts`, the one list that names real and
 * placeholder titles together — this table would otherwise be a running order that goes stale every
 * time a menu graduates.
 */
const MENUS: Array<{ label: string; shape: Shape }> = [
  { label: 'File', shape: [3, '-', 2, [3], '-', 1] },
  { label: 'View', shape: [3, '-', [4], 2] },
  { label: 'Create', shape: [2, [3], [2], '-', 3] },
  { label: 'Staff', shape: [3, '-', [3], 2] },
  { label: 'Play', shape: [3, '-', 2] },
  { label: 'Window', shape: [4, '-', 2] },
]

/**
 * Build every placeholder menu, keyed by its label. Every leaf's `onSelect` is a dev-log and NOTHING
 * else — the row closes the menu (the layer does that before the callback runs) and the score is
 * untouched. It logs rather than being empty so that a click is still traceable while we iterate.
 */
export function buildDemoMenus(): Map<string, MenuBarTitle> {
  let cursor = 0
  const nextLabel = (): string => LOREM[cursor++ % LOREM.length]

  const leaf = (): MenuItem => {
    const label = nextLabel()
    return { label, onSelect: () => dbg(`[menubar] placeholder row "${label}" — no command bound`) }
  }

  const rows = (n: number): MenuItem[] => Array.from({ length: n }, leaf)

  const expand = (shape: Shape): MenuItem[] =>
    shape.flatMap((part) => {
      if (part === '-') return [{ separator: true } as MenuItem]
      if (Array.isArray(part)) return [{ label: nextLabel(), items: rows(part[0]) } as MenuItem]
      return rows(part)
    })

  return new Map(MENUS.map(({ label, shape }) => [label, { label, items: expand(shape) }]))
}
