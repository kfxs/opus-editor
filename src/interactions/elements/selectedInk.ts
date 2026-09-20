/**
 * ⭐ **THE INK PASS — every selected MARK painted in its selection colour**, by its own row's `ink`
 * (`./chain`). One loop where `RenderController` had a call per kind: it asks each kind a box can
 * hold "which ids of yours are selected?" (`selectedIdsOf` — the click's one AND the box's many) and
 * hands each id to that kind's row.
 *
 * ⚠️ It runs BEFORE the selected element's `highlight`, so what a single click adds — the squares,
 * the guide — lands OVER what this draws (the pedal's tether).
 */
import { selectedIdsOf } from '../state/EditorState'
import { MARK_KINDS, type MarkKind } from '../enclosedMarks'
import { ELEMENT_SPECS } from './chain'
import type { HighlightContext } from './highlightContext'

export function paintSelectedMarkInk(ctx: HighlightContext): void {
  for (const kind of MARK_KINDS as ReadonlySet<MarkKind>) {
    const ink = ELEMENT_SPECS[kind].ink
    if (!ink) continue
    for (const id of selectedIdsOf(ctx.state, kind)) ink(ctx, id)
  }
}
