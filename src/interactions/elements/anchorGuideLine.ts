/**
 * Draw the dashed ATTACHMENT LINE from the selected element to the rhythmic anchor it hangs off
 * (Dorico/MuseScore style — the mark to the note/beat it belongs to). It is a pure VISUALIZATION,
 * never part of the score: not engraved, not hit-tested, not serialized — just a hint that reads
 * "this is attached HERE", which matters once the mark has been nudged away from its note
 * (docs/plans/dynamic-offset-plan.md). Both endpoints are captured at render and shifted with the bar
 * (`offsetElement`), so the line tracks a translated measure. Cleared by the next render like
 * every other decoration.
 *
 * ⭐⭐ **KIND-AGNOSTIC, and that is the 2026-08-17 change** — his question: *"what about the rest
 * of the elements? the anchor line is not just for dynamic."* It was `applyDynamicAnchorLine` and
 * asked the state for a selected DYNAMIC. It now asks for whatever is selected and draws the line
 * if the render captured a pair of endpoints for it, so a second kind is TWO edits and neither is
 * here: the renderer that draws it captures `anchor` (+ `guideFrom`) into its registry entry, and
 * the kind's row in `ELEMENT_SPECS` calls this from its `highlight`. ⛔ Not a per-kind painter
 * each, and ⛔ not a switch — the two families of guide MuseScore has (to the staff at the
 * segment's x, or to the parent chord) are a choice made where the points are measured.
 *
 * ⏭️ What is still dynamic-only is the SUPPLY: only `DynamicsLayout` captures the points today.
 *
 * Only the single-click element selection gets the line — a Shift-box that swept up several
 * dynamics would otherwise draw a fan of lines. This is the first of what may become a family of
 * toggleable "guide" overlays (rulers, markers…); keeping it its own module keeps that door open.
 */
import type { HighlightContext } from './highlightContext'

export function paintAnchorGuideLine(ctx: HighlightContext): void {
  const selected = ctx.state.selectedElement
  // ⚠️ `id` rather than a kind: most members of the union carry one, and the ones that do not (a
  // measure range, a tie keyed by its start note) simply never register an anchor, so they fall
  // out here without this having to know which they are.
  const id = selected && 'id' in selected ? selected.id : null
  if (!id) return

  // ⭐ EVERY entry registered under this id, not just the first: a SPAN is registered per system
  // fragment, and each fragment's guides are in that system's own coordinates. A fragment with
  // nothing attached simply carries none.
  // ⚠️ The gate is the DATA, not the kind — an element whose render measured no guide has nothing
  // to point at, and a guide is never a guess.
  const guides = ctx.registry.getAll()
    .filter(el => el.id === id)
    .flatMap(el => el.guides ?? [])
  if (guides.length === 0) return

  // From the START of the mark's INK up to its note anchor point.
  //
  // ⭐ **THE ENDS ARE THE RENDER'S ANSWER, not this painter's**, and that is what makes the guide
  // kind-agnostic: `from` is a point on the element's own INK (measured per letter off the font
  // for a dynamic, from the tight extents for a tempo mark, from the drawn tip for a wedge) and
  // `to` is whatever it hangs off (a notehead for a dynamic or a trill, a beat's column at the
  // staff's edge for a tempo mark or a hairpin). Both were his corrections, 2026-08-17: *"change
  // that point to the beginning of the expression"* and *"the anchor line should be measuring ink
  // and not bbox"* — see `docs/plans/dynamic-offset-plan.md` for which kind attaches to what.
  for (const guide of guides) {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line')
    line.setAttribute('x1', String(guide.from.x))
    line.setAttribute('y1', String(guide.from.y))
    line.setAttribute('x2', String(guide.to.x))
    line.setAttribute('y2', String(guide.to.y))
    line.setAttribute('stroke', '#2563EB')
    line.setAttribute('stroke-width', '2')
    // Dotted, not dashed: a near-zero dash with a ROUND linecap renders each segment as a round
    // dot of diameter = stroke-width, spaced by the gap.
    line.setAttribute('stroke-dasharray', '0.1 6')
    line.setAttribute('stroke-linecap', 'round')
    line.setAttribute('stroke-opacity', '0.75')
    // ⚠️ Still `dynamic-anchor-line`, though four kinds draw it now: it is the class the sweep and
    // the specs already know, and renaming it is a rename in three places for no behaviour.
    line.setAttribute('class', 'dynamic-anchor-line')
    // A guide never eats a click meant for the music underneath it.
    line.style.pointerEvents = 'none'
    ctx.addNode(ctx.svg, line)
  }
}
