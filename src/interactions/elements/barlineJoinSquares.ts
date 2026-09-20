/**
 * ⭐⭐ **THE SELECTED BARLINE'S JOIN SQUARES** — one under each staff and one over the staff below
 * it, at every gap of the system (docs/barline-join-plan.md §1, P2). Grabbing one is how a gap is
 * joined, and how a joined one is disjoined (`drags/barlineJoin`). WHERE they sit is
 * `./barlineJoinHandles`'; this paints them and registers what a press finds them by.
 *
 * ⭐ **THE SQUARE NEVER CHANGES WITH THE STATE** — his call, 2026-08-28: *"always the same square"*.
 * A joined gap is told by the ink running through it; the square only ever says *grab here*, and it
 * has to look the same on a joined gap because that is the one you grab to disjoin.
 *
 * ⚠️ **And none of them is ARMED**, unlike a span's: a join square is not a selectable element (there
 * is no `SelectedElement` kind for it), so there is no "picked" square to draw bigger.
 *
 * ⛔ The `barline-join` entries are the highlight pass's own — `clearHighlights` removes them.
 */
import { signAtBoundary } from '@/engine/models/boundarySign'
import { selectedOf } from '../EditorState'
import { barlineJoinHandles } from './barlineJoinHandles'
import { handleHitBox, paintHandleSquare } from './handleSquare'
import type { HighlightContext } from './highlightContext'

export function paintBarlineJoinSquares(ctx: HighlightContext): void {
  const selected = selectedOf(ctx.state, 'barline')
  const measure = selected?.measure ?? null
  if (measure === null) return

  // ⭐ WHICH SIGN stands on this line, so the square can centre on the ink the join would draw
  // rather than on the boundary coordinate — his report, and `strokeCentrePx`'s reason. The
  // two-measure question is `signAtBoundary`'s, the same one the recolour asks by group id.
  const measures = ctx.engine.getScore().measures
  const kind = signAtBoundary(measures[measure - 1], measures[measure]) ?? 'plain'
  // ⭐ …and only the ONE square at the spot that was pressed — his calls: *"just in the stave we
  // clicked"*, then *"the spot to click is critical"*. An absent spot (a keyboard walk with no
  // press behind it) narrows nothing rather than guessing one (`offeredAt`).
  const pressedAt = { staff: selected?.staff, end: selected?.pressedAt }
  for (const handle of barlineJoinHandles(ctx.registry, measure, kind, pressedAt)) {
    paintHandleSquare(ctx, handle, {
      className: `barline-join-handle barline-join-handle--${handle.side}`,
      cursor: 'pointer',
    })
    // ⚠️ `staff` is the staff ABOVE the gap — the model's key — so both squares of one gap register
    // the same (measure, staff) pair and a press writes one fact whichever it grabbed.
    ctx.registry.add({
      type: 'barline-join',
      measure,
      staff: handle.staffAbove,
      bbox: handleHitBox(handle),
    })
  }
}
