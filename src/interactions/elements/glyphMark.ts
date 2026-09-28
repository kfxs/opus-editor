/**
 * A user SYMBOL — a SMuFL glyph anchored to an event, drawn above (or below) the staff
 * (docs/plans/symbol-plan.md P3). Selected by its own id, since several may stand on one note.
 *
 * ⏭️ No drag and no arrows yet — its hand offset is P4.
 */
import { dbg } from '@/utils/debug'
import type { ClickableElementSpec } from './chain'
import { ELEMENT_SELECTION_FILL } from '@/utils/selectionColors'
import { paintTextMark } from './recolour'
import { selectedOf } from '../state/EditorState'

/** How far outside its ink a press still lands on a symbol — its box is the glyph's tight INK (from the
 *  glyph table), so a few pixels of slack keep a thin sign (a staccato-like dot) pickable. */
const PAD_PX = 3

export const GLYPH_MARK_ELEMENT: ClickableElementSpec = {
  kind: 'glyphMark',
  hit({ registry, x, y, closestElement }, deps) {
    const at = registry.getByType('glyphMark').find(el => {
      const b = el.bbox
      return x >= b.x - PAD_PX && x <= b.x + b.width + PAD_PX
        && y >= b.y - PAD_PX && y <= b.y + b.height + PAD_PX
    }) ?? null
    if (!at?.id) return false
    // Never steal a press that lands on a note or rest body — a high note can reach up into the pad.
    if (closestElement && registry.hitsNoteOrRestBody(closestElement, x, y)) return false
    dbg(`✓ Symbol selected | id:${at.id}`)
    return deps.pick({ kind: 'glyphMark', id: at.id })
  },
  // Its own ink, recoloured inside its OWN `<g>` (`glyphMarkLayout` opens it as `#<id>`), so the colour
  // cannot bleed. ⚠️ Here and not in an `ink` row: that column is for the kinds a passage BOX can hold
  // (`clipboard/enclosedMarks.MARK_KINDS`), and a box does not take symbols yet.
  highlight: ctx => {
    const id = selectedOf(ctx.state, 'glyphMark')?.id
    const group = id ? ctx.svg.querySelector(`[id="${id}"]`) : null
    if (!group) return
    paintTextMark(ctx, group, ELEMENT_SELECTION_FILL, 'selected-glyph-mark')
  },
}
