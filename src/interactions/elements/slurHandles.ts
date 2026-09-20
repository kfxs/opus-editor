/**
 * ⭐ **WHAT A SINGLE-CLICKED SLUR DRAWS TO BE EDITED BY** — three kinds of handle, each registered
 * for hit-testing, and the tint on the note an armed end is anchored to.
 *
 *  - **round** (amber) control-point handles that reshape the arc;
 *  - **blue squares** on the two TRUE ends, which re-anchor the slur onto a different note;
 *  - **orange squares** on the OPEN joins of a cross-system slur — keyboard-nudge only.
 *
 * A same-line slur is ONE partial carrying `controlPoints` + `slurEndpoints` → one round pair +
 * squares. A cross-system slur is N partials (BEGIN/MIDDLE…/END), EACH carrying its own
 * `controlPoints` + `segmentEndpoints` → a round pair per segment; the squares are the slur's TRUE
 * ends, carried as `slurEndpoints` on a single partial. ⚠️ So the rounds LOOP all partials and the
 * squares pick the one true-ends partial (the §4a fix — a single `.find` served only the first
 * segment). Each round handle carries its OWN segment's drag context, so the drag reads everything
 * off the picked handle without re-resolving which segment it belongs to.
 *
 * ⛔ The entries are the highlight pass's own — `clearHighlights` removes all three types.
 */
import { selectedOf } from '../state/EditorState'
import { HANDLE_HIT, HANDLE_R, handleHitBox, paintHandleSquare } from './handleSquare'
import type { HighlightContext } from './highlightContext'
import { paintNote } from './notePaint'

/** The tint a note wears while it is a slur endpoint's ANCHOR — the blue-square blue, so the note
 *  and the square that points at it read as one thing. ⚠️ NOT `selectionColors`' element blue: this
 *  is the slur handles' own colour language (orange = open join, blue = true end), not "something
 *  is selected". */
const SLUR_ANCHOR_FILL = '#2563EB'
const SLUR_ANCHOR_STROKE = '#1D4ED8'

export function paintSlurHandles(ctx: HighlightContext): void {
  const slur = selectedOf(ctx.state, 'slur')
  if (!slur) return
  // No slur geometry editing in linear view. A slur's control points are a 2-D shape relative
  // to endpoints whose horizontal span differs between the views, so a curve tuned against
  // unjustified linear spacing looks wrong once the line is justified — read-only here is the
  // end state, not a phase-1 shortcut (docs/plans/linear-view-plan.md §4.2–4.3). Drawing no handles
  // is also what keeps them out of the registry, so there is nothing to grab.
  if (ctx.engine.getViewMode() === 'linear') return

  const partials = ctx.registry.getByType('slur').filter(e => e.id === slur.id)
  if (partials.length === 0) return

  // Round handles: one pair per shape-bearing partial. The drag endpoints are the segment's own
  // ends (`segmentEndpoints`), falling back to `slurEndpoints` for a same-line arc — ⛔ a control
  // point with no endpoints cannot be inverted into a cps delta, so it is not drawn.
  for (const partial of partials) {
    if (!partial.controlPoints) continue
    const dragEnds = partial.segmentEndpoints ?? partial.slurEndpoints
    if (!dragEnds) continue
    partial.controlPoints.forEach((cp, i) => {
      // ⭐ The dot you grabbed reads as PICKED — bigger, a darker amber, a thicker white ring (his
      // ask, 2026-08-17: *"we do not know when the control points for the arc is selected"*).
      // Matched on the SEGMENT too, not just the index: a cross-system slur draws a pair per
      // system and `cpIndex` alone would light one on each. Cosmetic only — the hit-box is untouched.
      const picked = slur.controlPoint?.cpIndex === i
        && slur.controlPoint.segmentRole === partial.segmentRole
        && slur.controlPoint.segmentOrdinal === partial.segmentOrdinal
      const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
      dot.setAttribute('cx', String(cp.x))
      dot.setAttribute('cy', String(cp.y))
      dot.setAttribute('r', String(picked ? HANDLE_R + 1.5 : HANDLE_R))
      dot.setAttribute('fill', picked ? '#B45309' : '#F59E0B')
      dot.setAttribute('stroke', '#ffffff')
      dot.setAttribute('stroke-width', picked ? '2.5' : '1.5')
      dot.setAttribute('class', picked ? 'slur-handle slur-handle--selected' : 'slur-handle')
      dot.style.cursor = 'grab'
      ctx.addNode(ctx.svg, dot)

      ctx.registry.add({
        type: 'slur-handle',
        slurId: slur.id,
        cpIndex: i as 0 | 1,
        // This segment's full drag context, read straight off the handle on mousedown.
        controlPoints: partial.controlPoints,
        slurEndpoints: dragEnds,
        staffSpacePx: partial.staffSpacePx,
        segmentRole: partial.segmentRole,
        segmentOrdinal: partial.segmentOrdinal,
        slurSpanCount: partial.slurSpanCount,
        bbox: { x: cp.x - HANDLE_HIT, y: cp.y - HANDLE_HIT, width: HANDLE_HIT * 2, height: HANDLE_HIT * 2 },
      })
    })
  }

  // Blue squares: the two TRUE endpoints — these re-anchor the whole slur onto a different note.
  // Carried as `slurEndpoints` on exactly one partial (same-line: the single arc; cross-system: the
  // first registered segment). The one armed for the keyboard reads as picked.
  const trueEnds = partials.find(e => e.slurEndpoints)?.slurEndpoints
  if (trueEnds) {
    for (const which of ['start', 'end'] as const) {
      const p = which === 'start' ? trueEnds.p0 : trueEnds.p1
      const armed = which === slur.endpoint
      paintHandleSquare(ctx, p, {
        className: armed ? 'slur-endpoint-handle slur-endpoint-handle--selected' : 'slur-endpoint-handle',
        cursor: 'grab',
        armed,
      })
      ctx.registry.add({ type: 'slur-endpoint', slurId: slur.id, endpoint: which, bbox: handleHitBox(p) })
    }
  }

  // Orange squares: the OPEN join points of a cross-system slur (where it leaves one system and
  // resumes on the next) — keyboard-nudge-only (no note to re-anchor onto). One on the BEGIN
  // segment's right end, one on the END segment's left end, two on each MIDDLE. The round handles'
  // colour (same family — layout-ephemeral, resets with the span count); the square shape marks it
  // a position handle, not a curve bend. A same-line slur has no segments → none.
  const armedJoin = slur.segmentEndpoint
  for (const partial of partials) {
    if (!partial.segmentRole || !partial.segmentEndpoints) continue
    const role = partial.segmentRole
    const ends = partial.segmentEndpoints
    const opens: { p: { x: number; y: number }; side: 'left' | 'right' }[] =
      role === 'begin' ? [{ p: ends.p1, side: 'right' }]          // p0 is the true start
      : role === 'end' ? [{ p: ends.p0, side: 'left' }]           // p1 is the true end
      : [{ p: ends.p0, side: 'left' }, { p: ends.p1, side: 'right' }] // middle: both open
    for (const { p, side } of opens) {
      const armed = !armedJoin ? false
        : role === 'middle'
          ? armedJoin.role === 'middle' && armedJoin.ordinal === partial.segmentOrdinal && armedJoin.side === side
          : armedJoin.role === role
      paintHandleSquare(ctx, p, {
        className: armed
          ? 'slur-segment-endpoint-handle slur-segment-endpoint-handle--selected'
          : 'slur-segment-endpoint-handle',
        cursor: 'grab',
        armed,
        tone: 'join',
      })
      ctx.registry.add({
        type: 'slur-segment-endpoint',
        slurId: slur.id,
        segmentRole: role,
        segmentOrdinal: partial.segmentOrdinal,
        segmentSide: role === 'middle' ? side : undefined,
        slurSpanCount: partial.slurSpanCount,
        bbox: handleHitBox(p),
      })
    }
  }
}

/**
 * ⭐ **Tint the note an ARMED slur endpoint is anchored TO** (his ask, 2026-08-18: *"when
 * reanchoring with keyboard we dont highlight the note, i think we should, that is the way to let
 * know the user the new anchor"*).
 *
 * ⭐ **It serves the mouse too.** The drag is the same carried move as the arrows
 * (`interactions/walks/slurEndpointWalk`), so there is no candidate distinct from the anchor: the anchor
 * follows the ink live, and tinting the anchor IS tinting where the end is going.
 *
 * ⭐ **Standing, not a flash.** A blink needs a timer, an undo of itself, and a rule for a second
 * press mid-blink — and answers only for the half-second after you asked. This is DERIVED from
 * `selectedElement` + the slur, so nothing has to be set, cleared, or kept in step; a re-anchor
 * shows as the tint being on a different note afterwards, and it answers BEFORE the first press.
 */
export function paintArmedSlurAnchorNote(ctx: HighlightContext): void {
  const armed = selectedOf(ctx.state, 'slur')
  if (!armed?.endpoint) return
  const slur = ctx.engine.getSlurById(armed.id)
  if (!slur) return
  paintNote(ctx, armed.endpoint === 'start' ? slur.startNoteId : slur.endNoteId, SLUR_ANCHOR_FILL, SLUR_ANCHOR_STROKE)
}
