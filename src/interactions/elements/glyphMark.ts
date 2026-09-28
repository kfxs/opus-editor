/**
 * A user SYMBOL — a SMuFL glyph anchored to an event, drawn above (or below) the staff
 * (docs/plans/symbol-plan.md P3). Selected by its own id, since several may stand on one note.
 *
 * The arrows nudge its ink (`./glyphMarkKeys`); a drag moves it (`../drags/glyphMark`).
 */
import { dbg } from '@/utils/debug'
import type { ClickableElementSpec } from './chain'
import { ELEMENT_SELECTION_FILL } from '@/utils/selectionColors'
import { paintTextMark } from './recolour'
import { paintAnchorGuideLine } from './anchorGuideLine'
import { GLYPH_MARK_KEYS } from './glyphMarkKeys'
import { beginGlyphMarkDrag } from '../drags/glyphMark'

/** How far outside its ink a press still lands on a symbol — its box is the glyph's tight INK (from the
 *  glyph table), so a few pixels of slack keep a thin sign (a staccato-like dot) pickable. */
const PAD_PX = 3

export const GLYPH_MARK_ELEMENT: ClickableElementSpec = {
  kind: 'glyphMark',
  hit({ event, registry, x, y, closestElement }, deps) {
    const at = registry.getByType('glyphMark').find(el => {
      const b = el.bbox
      return x >= b.x - PAD_PX && x <= b.x + b.width + PAD_PX
        && y >= b.y - PAD_PX && y <= b.y + b.height + PAD_PX
    }) ?? null
    if (!at?.id) return false
    // Never steal a press that lands on a note or rest body — a high note can reach up into the pad.
    if (closestElement && registry.hitsNoteOrRestBody(closestElement, x, y)) return false
    dbg(`✓ Symbol selected | id:${at.id}`)
    // Click = select; a press that travels drags its ink (`../drags/glyphMark`) — armed inside `pick`,
    // the order every mark uses: assignment, then arm, then repaint.
    const id = at.id
    return deps.pick(
      { kind: 'glyphMark', id },
      () => deps.arm(door => beginGlyphMarkDrag(door.host, id, { x, y }), event),
    )
  },
  // ⭐ The dotted ATTACHMENT GUIDE to the note it belongs to (his ask, 2026-09-28) — the dynamic's and the
  //   tempo mark's, drawn from the two ends the render measured (`glyphMarkLayout`).
  highlight: ctx => paintAnchorGuideLine(ctx),
  // ⭐ Its ink, recoloured inside its OWN `<g>` (`glyphMarkLayout` opens it as `#<id>`) — asked for EVERY
  //   selected symbol, the one a click picked and each one a passage box swept in (P4).
  ink: (ctx, id) => {
    const group = ctx.svg.querySelector(`[id="${id}"]`)
    if (!group) return
    paintTextMark(ctx, group, ELEMENT_SELECTION_FILL, 'selected-glyph-mark')
  },
  keys: GLYPH_MARK_KEYS,
}
