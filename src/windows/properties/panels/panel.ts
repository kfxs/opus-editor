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
import type { InspectedElement } from '@/interactions/selectionSnapshot'

export type PanelRows = (element: InspectedElement) => HTMLElement[]

/** The element's id when it still resolves — ⛔ a stale selection (`missing`) gets no control: it is
 *  shown in the dump, and a box that writes to nothing would be a control that lies. */
export function liveId(element: InspectedElement): string | null {
  const data = element.data as { id?: string; missing?: boolean }
  return data.id && !data.missing ? data.id : null
}
