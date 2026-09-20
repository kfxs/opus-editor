/**
 * ⭐ **WHERE A SLOT BEGINS, MEASURED OFF THE LAST RENDER** — the edge a beat-anchored mark (a clef
 * change, a dynamic, a tempo mark) snaps to when it is clicked into a bar.
 *
 * *"Clef-tool click snaps to the nearest slot boundary"* (commit `588b817`) — the BOUNDARY is where
 * the slot's ink starts, so a note carrying a sharp begins at the sharp. That stays the rule here.
 *
 * ## What changed, and it is only the ruler (`docs/plans/own-engraving-engine.md` §5 P6b)
 *
 * The edge used to be `bbox.x` of a note's registry entry — VexFlow's union of every modifier, which
 * happened to start at the accidental. It is now asked of the parts the editor measures itself:
 *
 * | a slot's ink | its left edge | ruler |
 * |---|---|---|
 * | a notehead | `headCentreX` − half the font's notehead width × the staff's line spacing | `headX` + `fonts/` |
 * | its accidental | the accidental's own hit box | ⭐ ours since P6b (`rendering/drawnHitBox`) |
 * | a rest | its glyph box | ⚠️ still VexFlow's — the rest has not migrated |
 *
 * ⚠️ A note registered without a `headX` (a ghost's plain `StaveNote`), or on a staff with no geometry,
 * falls back to its `bbox.x` — ⛔ not a guess: it is the ruler that shipped until now.
 *
 * This is a derived view of a drawing, so it lives in `layout/` beside `measuredRoom` — and like
 * everything there it is only as current as the render it reads.
 */
import type { ElementInfo, ElementRegistry } from '@/engine/ElementRegistry'
import { headCentreX } from '@/engine/ElementRegistry'
import { noteheadInk } from '@/engine/fonts/fontMetrics'
import type { NoteDuration } from '@/types/music'
import { staffOf } from '@/utils/lanes'

const DURATIONS: readonly string[] = ['w', 'h', 'q', '8', '16', '32'] satisfies readonly NoteDuration[]

/** One note's head, left edge — or its union box's when the parts to measure it are missing. */
function noteHeadLeftX(registry: ElementRegistry, el: ElementInfo): number {
  const spacing = el.measure === undefined ? undefined : registry.getStaffGeometry(el.measure, staffOf(el))?.lineSpacing
  if (el.headX === undefined || spacing === undefined) return el.bbox.x
  const duration = (DURATIONS.includes(el.duration ?? '') ? el.duration : 'q') as NoteDuration
  return headCentreX(el) - (noteheadInk(duration) * spacing) / 2
}

/**
 * The beat of the slot whose left edge is nearest `x` in this bar, across every staff.
 *
 * @returns null when nothing is drawn in the bar — the caller decides what an empty bar means.
 */
export function nearestSlotBoundaryBeat(registry: ElementRegistry, x: number, measure: number): number | null {
  /** Per staff and beat: the leftmost ink of that slot. */
  const edges = new Map<string, { beat: number; x: number }>()
  const widen = (el: ElementInfo, left: number) => {
    if (el.beat === undefined) return
    const key = `${staffOf(el)}@${el.beat}`
    const seen = edges.get(key)
    if (!seen) edges.set(key, { beat: el.beat, x: left })
    else seen.x = Math.min(seen.x, left)
  }

  for (const el of registry.getByMeasure(measure)) {
    if (el.type === 'note') widen(el, noteHeadLeftX(registry, el))
    else if (el.type === 'rest') widen(el, el.bbox.x)
    else if (el.type === 'accidental') widen(el, el.bbox.x)
  }

  let best: { beat: number; x: number } | null = null
  for (const edge of edges.values()) {
    if (!best || Math.abs(x - edge.x) < Math.abs(x - best.x)) best = edge
  }
  return best ? best.beat : null
}
