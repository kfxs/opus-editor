import { bus } from '@/bus'
import type { GlyphMarkOffsetOverride } from '@/types/music'
import { buildMarkOffsetRow } from '../rows'
import { live, overrideOf, type PanelRows } from './panel'

/**
 * ⭐ A selected user SYMBOL gets its hand offset as two numbers (docs/plans/symbol-plan.md P4) — the dynamic's
 * row, read from the same override the arrows and the drag write, so the three always agree. Publishes to
 * `bus.glyphMarkOffset`.
 */
export const glyphMarkRows: PanelRows<'glyphMark'> = (element) => {
  const id = live(element.data)?.id
  if (!id) return []
  const entry = overrideOf<GlyphMarkOffsetOverride>(element, 'glyphMarkOffset')
  return [buildMarkOffsetRow({ x: entry?.x ?? 0, y: entry?.y ?? 0 }, (x, y) => bus.glyphMarkOffset.set({ id, x, y }))]
}
