import { bus } from '@/bus'
import type { InspectedElement } from '@/interactions/selectionSnapshot'
import { buildMarkOffsetRow } from '../rows'
import { liveId, type PanelRows } from './panel'

/**
 * ⭐ A selected DYNAMIC or expression gets its offset as two numbers (his ask, 2026-08-17: *"we also
 * should be able to control the offset of expression (dynamics) on the properties"*). Two axes where
 * the note has one — a note's vertical is its PITCH, while a dynamic rides the dynamics line and may
 * be lifted off it. Publishes to `bus.dynamicOffset`.
 */
export const dynamicRows: PanelRows = (element) => {
  const id = liveId(element)
  if (!id) return []
  return [buildMarkOffsetRow(currentDynamicOffset(element), (x, y) => bus.dynamicOffset.set(id, x, y))]
}

/** The dynamic's current offset in staff-spaces (0,0 when none), read from its own overrides — the
 *  same entry `nudgeDynamicOffset` accumulates into, so the panel and the arrow keys always agree
 *  about what is stored. */
function currentDynamicOffset(element: InspectedElement): { x: number; y: number } {
  const entry = element.overrides?.find((o) => o.kind === 'dynamicOffset') as
    { x?: number; y?: number } | undefined
  return { x: entry?.x ?? 0, y: entry?.y ?? 0 }
}
