/**
 * ⭐ **A PARENTHESISED head's BRACKETS** (`docs/plans/parenthesised-note-plan.md` P4 + N10 reversed) — a
 * selectable kind of their own, `headEnclosure`, since his ask (2026-09-23): *"i want to be able to select
 * just the parenthesis too so i can remove it with delete key"*. One pair per HEAD — clicking either
 * bracket selects both; Delete takes them off and the note stays (`shortcutWiring`).
 *
 * ⭐ And the painter the selected-NOTE pass (`./notePaint`) calls, as it calls `paintNoteDots`: a selected
 * note lights its brackets too. One owner per ink.
 *
 * ⭐ Found by its pair group's id (`rendering/EnclosurePass.enclosurePairId`), scoped to the score's own
 * `<svg>` — the key signature's and barline's way. ⚠️ A GRACE's pair stands loose in its member group (its
 * highlight colours direct children only), so a selected grace bracket lights the grace's whole group.
 */
import { enclosurePairId } from '@/engine/rendering/EnclosurePass'
import type { ElementInfo } from '@/engine/ElementRegistry'
import { dbg } from '@/utils/debug'
import { voiceFillColor } from '@/utils/voiceColors'
import { selectedOf } from '../state/EditorState'
import type { ClickableElementSpec } from './chain'
import type { HighlightContext } from './highlightContext'

/** Colour the brackets `noteId`'s head wears — a GLYPH, so filled, never stroked (an outline reads bold). */
export function paintNoteEnclosure(ctx: HighlightContext, noteId: string, color: string): void {
  const group = ctx.svg.querySelector(`[id="${enclosurePairId(noteId)}"]`)
  if (!group) return
  group.querySelectorAll('text').forEach(el => {
    ctx.setAttr(el, 'fill', color)
    ctx.setStyleProp(el as SVGElement, 'fill', color)
    ctx.addClass(el, 'selected-note')
  })
}

/** A bracket glyph is ~0.56 sp wide: pad its box a little, as the dot's and the tie's are. */
const PAD = 3

export const HEAD_ENCLOSURE_ELEMENT: ClickableElementSpec = {
  kind: 'headEnclosure',
  /**
   * Select a head's brackets. ⚠️ Like the dot, a bracket sits INSIDE the note's generous click margin
   * (±1.1 sp from the head's centre, `ElementRegistry.hitsNoteOrRestBody`), so the press goes to whichever
   * centre it is NEARER in x — the head, or the bracket.
   */
  hit({ registry, x, y }, deps) {
    const centerX = (el: ElementInfo) => el.bbox.x + el.bbox.width / 2
    const hits = registry.getByType('headEnclosure').filter(el => {
      const b = el.bbox
      return x >= b.x - PAD && x <= b.x + b.width + PAD && y >= b.y - PAD && y <= b.y + b.height + PAD
    })
    if (!hits.length) return false
    const at = hits.reduce((best, el) => (Math.abs(x - centerX(el)) < Math.abs(x - centerX(best)) ? el : best))
    if (!at.noteId) return false
    const head = registry.findClosestNoteOrRest(x, y)
    if (head && registry.hitsNoteOrRestBody(head, x, y)) {
      const headX = head.headX ?? centerX(head)
      if (Math.abs(x - headX) <= Math.abs(x - centerX(at))) return false
    }
    dbg(`✓ Brackets selected | noteId:${at.noteId}`)
    return deps.pick({ kind: 'headEnclosure', noteId: at.noteId })
  },

  highlight: paintSelectedEnclosure,
}

/** Highlight the selected brackets, in their note's voice colour. A grace's pair has no group of its own
 *  (see the header), so its member group's highlight — the note's own painter — carries it. */
export function paintSelectedEnclosure(ctx: HighlightContext): void {
  const noteId = selectedOf(ctx.state, 'headEnclosure')?.noteId
  if (!noteId) return
  const voice = ctx.engine.getNote(noteId)?.voice ?? 0
  paintNoteEnclosure(ctx, noteId, voiceFillColor(voice))
}
