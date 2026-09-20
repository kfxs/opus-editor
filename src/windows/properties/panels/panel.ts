/**
 * ⭐ **A KIND'S PANEL** — the controls the Properties window shows for one selected element of that
 * kind, above its dump. One module per kind (`./<kind>.ts`), one row per kind in `./index`'s table
 * (docs/code-shape-plan-2026-09-19.md, Phase 3.4).
 *
 * ⚠️ A panel is a DUMB PUBLISHER: it builds rows (`../rows`) and hands each a `publish` that writes
 * to the `bus` — ⛔ never the engine. The controller on the other side of the bus owns the apply.
 *
 * ⛔ The REPORT — what `element` holds — is not a panel's: `selectionSnapshot.selectedElements` stays
 * one exhaustive switch, by decision.
 */
import type { InspectedElement, InspectedOf, MissingElement } from '@/interactions/inspectedElement'
import type { EngravingOverride } from '@/types/music'

/** ⭐ A panel is handed the report for ITS kind, so it reads `data` and `derived` with no cast. */
export type PanelRows<K extends InspectedElement['kind']> = (element: InspectedOf<K>) => HTMLElement[]

/** The model's object when it still resolves — ⛔ a stale selection (`missing`) gets no control: it
 *  is shown in the dump, and a box that writes to nothing would be a control that lies. */
export function live<T extends object>(data: T | MissingElement): T | null {
  return 'missing' in data ? null : data
}

/**
 * The element's entry of one kind in the engraving-overrides compartment, as that kind's interface.
 *
 * ⚠️ The caller names the interface AND its `kind` string, and `T['kind']` holds the two together:
 * `EngravingOverride` is a base interface the kinds EXTEND, not a union, so the model's `kind` is
 * the discriminator by convention and this is the one place that convention is cast on.
 */
export function overrideOf<T extends EngravingOverride>(
  element: Pick<InspectedElement, 'overrides'>, kind: T['kind'],
): T | undefined {
  return element.overrides?.find((o) => o.kind === kind) as T | undefined
}
