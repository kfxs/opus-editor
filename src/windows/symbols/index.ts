import type { WindowLayer } from '../WindowLayer'
import type { Window } from '../Window'
import { SymbolsWidget } from './SymbolsWidget'

/**
 * The Symbols window — every SMuFL glyph, browsable, on `Z` (Sibelius's own key).
 *
 * It is a REFERENCE and it puts nothing on the score (docs/symbols-window-plan.md). Two audiences
 * share it: a musician looking up a sign, and us looking up the codepoint behind one — the
 * `'' // metAugmentationDot` literals scattered through `tempoMenu.ts` and `TempoLayout.ts`
 * were each verified by eye against a website, which is the job this window takes over once its
 * detail bar lands (P2).
 *
 * ONE window at a time, like Properties: the single handle is what keeps `Z` a toggle rather than a
 * way to stack copies of a 2932-glyph chart. It is checked against the manager before use, because
 * the ✕ closes the window behind our back and a stale handle would then toggle nothing.
 */

let symbols: Window | null = null

// Three columns wide: the ranges (186), the chart, the detail (232). At 720 the chart was left with
// six cells across, which is a corridor rather than a wall of glyphs.
const WIDTH = 880
const HEIGHT = 560

function isOpen(windows: WindowLayer): boolean {
  return symbols !== null && windows.manager.list().includes(symbols)
}

export function openSymbolsWindow(windows: WindowLayer): Window {
  if (isOpen(windows)) return symbols!

  symbols = windows.open({
    title: 'Symbols',
    width: WIDTH,
    height: HEIGHT,
    // Centred and opaque: this one is READ, at length, and a chart you can see the stave through is
    // a chart you have to squint at. (The Keypad's glass is for a panel that sits ON the music.)
    center: true,
    resizable: true,
    content: new SymbolsWidget(),
    onCancel: () => toggleSymbolsWindow(windows),
  })
  return symbols
}

export function toggleSymbolsWindow(windows: WindowLayer): void {
  if (isOpen(windows)) {
    symbols!.close()
    symbols = null
  } else {
    openSymbolsWindow(windows)
  }
}
