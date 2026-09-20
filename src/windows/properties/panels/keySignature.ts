import { bus } from '@/bus'
import { buildNumberRow } from '../rows'
import type { PanelRows } from './panel'

/**
 * ⭐⭐ A selected KEY SIGNATURE gets the trailing gap of its CAUTIONARY — his ask, 2026-08-28: *"lets
 * make what we have now default but give the user the freedom to change the number in properties."*
 * The number is where the sources disagree most (Gould's measured 1.9 sp against all three engines'
 * 0.5, ours 0.75 between them), which is exactly when a default should not be the last word.
 *
 * ⚠️ It is offered whether or not the change currently lands on a system break: the decision belongs
 * to the CHANGE, and which bar ends a system moves on every reflow.
 */
export const keySignatureRows: PanelRows = (element) => {
  const where = element.data as { measure?: number; staff?: number }
  const gap = element.derived?.cautionaryGap as { value: number; authored: boolean } | null | undefined
  if (!gap || where.measure === undefined) return []
  const measure = where.measure
  const staff = where.staff ?? 0
  return [buildNumberRow(
    // ⭐ A quarter-space step: the whole interesting range is 0.5–2 sp (the two sources' answers and
    //   a little either side), so a finer step would offer stops nobody can see.
    'courtesy tail (sp)', gap.value, 0.25, 0, 4,
    (value) => bus.cautionaryKeyGap.set({ measure, staff, gap: value }),
    gap.authored
      ? 'bare staff after a courtesy key signature at a system break — yours; reset returns it to 0.75'
      : 'bare staff after a courtesy key signature at a system break — the default 0.75 (Gould measures 1.9, the three engines 0.5)',
  )]
}

