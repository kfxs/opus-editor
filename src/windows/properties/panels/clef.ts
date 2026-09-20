import { bus } from '@/bus'
import { scalarOffsetRow } from '../rows'
import type { PanelRows } from './panel'

/**
 * ⭐⭐ A selected INLINE CLEF gets ONE number — its horizontal offset (his ask, 2026-08-28: *"when
 * the clef is not in the beguining of a line (i mean a header clef) i want to be able to offset it
 * horizontally either by keys in the keyboard or be the property"*).
 *
 * ⚠️ **The row appears only when the clef can actually carry one** — `offsettable`, which the
 * snapshot takes from the engine's reading of the DRAWN ink, because a clef standing in a system's
 * header is laid out by the header and is exactly the one he excluded. ⛔ A row whose write is
 * always refused would be a control that lies.
 */
export const clefRows: PanelRows<'clef'> = (element) => {
  const { measure, beat, staff, offset, offsettable } = element.data
  if (!offsettable) return []
  return [scalarOffsetRow(
    'offset x', offset,
    'Horizontal nudge in staff-spaces, + right. The keyboard does the same: '
    + 'Ctrl+Shift+←/→ (wide) or Shift+Alt+←/→ (fine).',
    (x) => bus.clefOffset.set(measure, beat, staff, x),
  )]
}

