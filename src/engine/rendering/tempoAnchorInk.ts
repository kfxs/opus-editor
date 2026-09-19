/**
 * ⭐⭐ **HOW FAR A TEMPO MARK'S ANCHOR HAS TRAVELLED SINCE ITS GLYPH WAS DRAWN** — the number a
 * PREVIEW needs and did not have.
 *
 * ## The identity, and the half that was missing
 *
 * A dragged mark is `drawn = base(anchor) + offset`, and the walk's crossing moves BOTH halves at
 * once (`interactions/markWalk`: anchor += gap, offset −= gap) precisely so the drawing does not
 * move. A preview re-applies the mark's transform without re-engraving anything, and until now it
 * could only rewrite the OFFSET — `base` is baked into the glyph's `x` at draw time
 * (`TempoLayout.drawTempoMarks`, which stamps the address it used on the group).
 *
 * 🚨 So a frame that had crossed found the two halves disagreeing and the mark snapped back to the
 * beat it was engraved at — his report, 2026-08-22 (*"it gets stuck at certain points"*, the ink
 * sawtoothing ~39 px per stop). The fix taken then was to REFUSE such a frame and let a full render
 * draw it. ⭐⭐ **That was the wrong fix, and it is his call, 2026-08-31**: *"i think it was the wrong
 * fix to the issue described here"*. Measured on the Prelude the same day, with the drag traced
 * (`interactions/dragTrace`): a frame the preview accepts repaints in **0.3–0.7 ms** and one it
 * refuses in **33–46 ms**, and since a horizontal drag crosses a stop on most frames the preview was
 * switched off in practice — the hand's own delta ballooned from ~3 px to 24–35 px, and the latch
 * then ate 70 px of a 564 px gesture.
 *
 * ⭐ **What a preview was missing is one number**: how far `base` moved. Add it to the transform and
 * the identity holds without re-engraving anything.
 *
 * ⚠️ **Measured off the LAST RENDER, from the same ink the WALK measures**: the drawn onsets in the
 * `ElementRegistry`. That is deliberate — the walk pays `gap = stopX(next) − stopX(here)` into the
 * offset from exactly these boxes (`interactions/tempoAnchors.drawnOnsets`), so the travel this returns
 * and the gap that walk subtracted are the same distance, and the two cancel to the pixel. ⛔ Not
 * `TempoLayout.anchorX`, which is the same question asked of VexFlow objects a preview does not have
 * — and which would cancel only approximately.
 *
 * ⛔ **Null is "the picture cannot say"**, and the caller must then refuse the cheap frame rather
 * than guess: an onset that drew nothing (culled, or another system) has no x to subtract.
 */
import type { RenderPass } from './RenderPass'
import type { ElementRegistry } from '../ElementRegistry'
import { fracToNumber } from '@/utils/fraction'

/** The stamp `TempoLayout.drawTempoMarks` puts on the group: `"<measure>:<beat>"`, the address the
 *  glyph's own `x` was measured from. ⛔ Only a real draw rewrites it — a preview that re-stamped it
 *  would forget where the baked x came from and stop being able to compute this at all. */
export const TEMPO_ANCHOR_ATTR = 'data-tempo-anchor'

/** Beats are compared as floats here (the stamp and the registry both carry `fracToNumber`), so a
 *  tuplet's third of a beat needs a hair of tolerance. ⛔ Nothing here rounds a POSITION. */
const BEAT_EPSILON = 1e-9

/**
 * Where one onset was DRAWN, left to right, in the page's own pixels — the centre of its ink.
 *
 * ⭐ **The TOP staff's element wins**, because that is the staff a tempo mark is engraved above;
 * a stop that exists only lower down still answers, with that staff's point, since the two share a
 * column. `interactions/tempoAnchors.drawnOnsets`' rule, and it has to stay that rule.
 */
export function onsetInkX(registry: ElementRegistry, measure: number, beat: number): number | null {
  let best: { x: number; staff: number } | null = null
  for (const el of [...registry.getByType('note'), ...registry.getByType('rest')]) {
    if (el.measure !== measure || el.beat === undefined) continue
    if (Math.abs(el.beat - beat) > BEAT_EPSILON) continue
    const staff = el.staff ?? 0
    if (best && best.staff <= staff) continue
    best = { x: el.bbox.x + el.bbox.width / 2, staff }
  }
  return best?.x ?? null
}

/**
 * ⭐⭐ **The distance between where this glyph's `x` was measured and where the mark is anchored
 * NOW**, in the page's own pixels. **0** when they agree — which is every mark on every full render,
 * so this is a no-op outside a drag that has crossed.
 *
 * @returns null when the picture cannot say: no glyph, no stamp, no mark, or either address drew no
 *   ink. The caller REFUSES the cheap frame on a null (`./markPreviewPass`) — ⛔ never guesses 0,
 *   which would put the mark back on the beat it was engraved at.
 */
export function tempoAnchorTravelPx(pass: RenderPass, id: string): number | null {
  const svg = pass.painter?.svg as SVGSVGElement | undefined
  const el = svg?.querySelector(`#vf-${id}`) as SVGGraphicsElement | null
  const stamp = el?.getAttribute(TEMPO_ANCHOR_ATTR)
  if (!stamp) return null

  const [drawnMeasure, drawnBeat] = stamp.split(':').map(Number)
  if (!Number.isFinite(drawnMeasure) || !Number.isFinite(drawnBeat)) return null

  const measure = pass.score.measures.find(m => m.tempos?.some(t => t.id === id))
  const mark = measure?.tempos?.find(t => t.id === id)
  if (!measure || !mark) return null
  const beat = fracToNumber(mark.beat)

  // ⭐ The common case, and it must be exactly 0 rather than "near enough": every full render lands
  //   here, and a stray pixel would move a mark nobody touched.
  if (measure.number === drawnMeasure && Math.abs(beat - drawnBeat) <= BEAT_EPSILON) return 0

  // 🚨🚨 **HORIZONTAL ONLY, so ⛔ ONE SYSTEM ONLY.** A translate would happily carry the glyph into
  // another bar's `<g>` — SVG does not clip it — but it cannot put the mark on the other system's
  // ROW, and the x's of two systems are not one ruler anyway
  // (`interactions/markSystemJump`: *"two systems' x's are not one ruler"*). So a frame whose two
  // addresses were drawn on different staff rows refuses and lets a real render place it.
  // ⚠️ A staff-top y does not name a system in general — sheets stand side by side and share rows
  // (`reference_a_staff_top_y_does_not_name_a_system`) — but neither road that re-anchors a tempo
  // mark can reach another SHEET: the walk refuses to cross a break at all, and the jump chooses
  // within the sheet under the hand. Same row here therefore means same system.
  const row = (m: number): number | null =>
    pass.elementRegistry.getStaffGeometry(m, 0)?.lineYPositions[0] ?? null
  const wasRow = row(drawnMeasure)
  const nowRow = row(measure.number)
  if (wasRow === null || nowRow === null || Math.abs(wasRow - nowRow) > 0.5) return null

  // ⭐⭐ **THE SAME FUNCTION THE ENGRAVER USED**, published by the render
  // (`ElementRegistry.tempoAnchorX` ← `TempoLayout.anchorX`), ⛔ never the noteheads: this is the
  // distance the mark's BASE moved, and the base is where `anchorX` put it. Asking anything else
  // makes this preview disagree with the render that follows it, which is what the drop's jump was.
  const from = pass.elementRegistry.tempoAnchorX(drawnMeasure, drawnBeat)
  const to = pass.elementRegistry.tempoAnchorX(measure.number, beat)
  return from !== null && to !== null ? to - from : null
}
