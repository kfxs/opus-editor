/**
 * ⭐ **THE PANELS TABLE** — which controls the Properties window shows for each kind it can be
 * handed. `PropertiesWidget.paint` looks the kind up here and knows none by name: a new kind's
 * controls are a new module beside these and a row below.
 *
 * ⚠️ PARTIAL on purpose: most kinds have no control yet and show only their dump. Keyed by
 * `InspectedElement.kind`, which is wider than `SelectedElement['kind']` — a `note` and a `rest`
 * are reported from the multi-select, not from `selectedElement`.
 */
import { barlineRows } from './barline'
import { clefRows } from './clef'
import { dynamicRows } from './dynamic'
import { hairpinRows } from './hairpin'
import { keySignatureRows } from './keySignature'
import { noteRows } from './note'
import { ottavaRows } from './ottava'
import type { InspectedElement, InspectedOf } from '@/interactions/state/inspectedElement'
import type { PanelRows } from './panel'
import { pedalRows } from './pedal'
import { slurRows } from './slur'
import { tempoRows } from './tempo'
import { trillRows } from './trill'

// ⚠️ The row type is spelled as a FUNCTION, not as `PanelRows<K>`: a panel serving two kinds
// (`note | rest`, the two that name a LINE) is a panel for each of them, which holds structurally —
// but TypeScript compares an alias's arguments by name and would refuse the row.
const PANELS: { readonly [K in InspectedElement['kind']]?: (element: InspectedOf<K>) => HTMLElement[] } = {
  note: noteRows,
  rest: noteRows,
  grace: noteRows,
  bracketed: noteRows,
  clef: clefRows,
  dynamic: dynamicRows,
  tempo: tempoRows,
  trill: trillRows,
  pedal: pedalRows,
  ottava: ottavaRows,
  slur: slurRows,
  hairpin: hairpinRows,
  keySignature: keySignatureRows,
  // The two selections are the same LINE seen from either side, so they are one panel.
  barline: barlineRows,
  repeatStart: barlineRows,
}

/**
 * The rows for one inspected element — none for a kind with no panel.
 *
 * ⚠️ The ONE cast of this window: the table is keyed by kind and each row takes that kind's report,
 * which TypeScript cannot correlate through an indexed lookup. The table's own type is what makes
 * it sound — a row filed under the wrong kind does not compile.
 */
export function panelRowsFor(element: InspectedElement): HTMLElement[] {
  const rows = PANELS[element.kind] as PanelRows<InspectedElement['kind']> | undefined
  return rows?.(element) ?? []
}
