import { bus } from '@/bus'
import type { TempoOffsetOverride } from '@/types/music'
import type { InspectedOf } from '@/interactions/state/inspectedElement'
import { buildMarkOffsetRow } from '../rows'
import { live, overrideOf, type PanelRows } from './panel'

/**
 * ⭐ A selected TEMPO MARK gets the dynamic's two numbers (his ask, 2026-08-19), through
 * `bus.tempoOffset`. The mark rides the row the ladder gives it and may be moved off it in either
 * direction, so it takes the dynamic's row rather than the note's single horizontal — ⚠️ with its
 * own `y` caption: a tempo mark's vertical is OUTWARD (+up).
 */
export const tempoRows: PanelRows<'tempo'> = (element) => {
  const id = live(element.data)?.id
  if (!id) return []
  return [buildMarkOffsetRow(
    currentTempoOffset(element), (x, y) => bus.tempoOffset.set({ tempoId: id, x, y }),
    'Vertical offset, + is UP (away from the staff)')]
}

/** The tempo mark's current offset in staff-spaces (0,0 when none) — the reader above's twin, on the
 *  entry `nudgeTempoOffset` accumulates into. */
function currentTempoOffset(element: InspectedOf<'tempo'>): { x: number; y: number } {
  const entry = overrideOf<TempoOffsetOverride>(element, 'tempoOffset')
  return { x: entry?.x ?? 0, y: entry?.y ?? 0 }
}
