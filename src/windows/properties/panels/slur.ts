import { bus } from '@/bus'
import type { InspectedOf } from '@/interactions/inspectedElement'
import type { SlurEndpointOffsetOverride, SlurOffsetOverride } from '@/types/music'
import { buildPointRow } from '../rows'
import { live, overrideOf, type PanelRows } from './panel'

/**
 * ⭐ A selected SLUR gets its four handles as numbers — the two ends' offsets and the two arc control
 * points, the same points the mouse drags and the arrows nudge (his ask, 2026-08-17). Publishes to
 * `bus.slurGeometry`.
 */
export const slurRows: PanelRows<'slur'> = (element) => {
  const id = live(element.data)?.id
  return id ? [buildSlurGeometryRows(id, element)] : []
}

/**
 * ⭐ **THE SLUR'S FOUR HANDLES, AS NUMBERS** — one row per grabbable point: the blue square at each
 * end, then the two amber arc dots. Each row is an x/y pair in **staff-spaces** and a reset,
 * publishing to {@link bus.slurGeometry}; `SlurGeometryController` applies.
 *
 * ⚠️ **These are the MODEL's numbers, not screen positions**, and the two differ in sign for the
 * arc: an endpoint offset is screen-down-positive, while an arc control point's `y` bows the curve
 * OUTWARD whichever side the slur sits on. That is deliberate — the override's own JSON is printed
 * a few lines below this control, and an input that disagreed with the dump under it would be
 * unreadable. The keyboard is the surface that speaks screen ("↑ lifts the dot"); this one speaks
 * model.
 *
 * ⭐ **Blank means AUTO, and blank is not zero.** An unedited handle has no entry in the overrides
 * compartment at all, so its input shows a placeholder rather than `0` — the arc especially, whose
 * automatic shape is a whole arch and nothing like a zero pair. Reset returns a row to blank.
 *
 * ⚠️ On a cross-system slur the ARC rows address the segment whose dot is armed (the caption says
 * which); with none armed there is no system to write to, so they are shown disabled rather than
 * offered as a guess. The END rows are always live — a true end belongs to the whole slur.
 */
function buildSlurGeometryRows(slurId: string, element: InspectedOf<'slur'>): HTMLElement {
  const wrap = document.createElement('div')
  wrap.style.margin = '2px 0 4px'

  const ends = overrideOf<SlurEndpointOffsetOverride>(element, 'endpointOffset')
  const arc = element.derived?.arc

  // ⭐ The WHOLE curve first, because it is the coarsest thing on the panel and the one that
  // answers "this slur sits in the wrong place" — the two ends below answer "this END does".
  const whole = overrideOf<SlurOffsetOverride>(element, 'slurOffset')
  wrap.appendChild(buildPointRow(
    'whole curve (sp)',
    whole?.x === undefined && whole?.y === undefined ? undefined : { x: whole.x ?? 0, y: whole.y ?? 0 },
    (value) => bus.slurGeometry.set({ slurId, target: { kind: 'whole' }, value }),
  ))
  wrap.appendChild(buildPointRow('start end (sp)', ends?.start, (value) =>
    bus.slurGeometry.set({ slurId, target: { kind: 'endpoint', which: 'start' }, value })))
  wrap.appendChild(buildPointRow('end end (sp)', ends?.end, (value) =>
    bus.slurGeometry.set({ slurId, target: { kind: 'endpoint', which: 'end' }, value })))

  // A cross-system slur with nothing armed: the caption says why the rows are dead rather than
  // leaving the user to wonder which system a number would have gone to.
  const segment = arc?.segment ?? null
  const armedOnly = segment !== null && (arc?.armed ?? null) === null
  for (const cpIndex of [0, 1] as const) {
    const label = `arc ${cpIndex + 1}${segment ? ` (${segment})` : ''} (sp)`
    wrap.appendChild(buildPointRow(
      label,
      arc?.cps?.[cpIndex],
      (value) => bus.slurGeometry.set({ slurId, target: { kind: 'controlPoint', cpIndex }, value }),
      armedOnly ? 'select an arc handle first — a split slur shapes one system at a time' : undefined,
    ))
  }
  return wrap
}
