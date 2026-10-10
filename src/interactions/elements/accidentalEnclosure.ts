/**
 * ⭐ **A BRACKETED accidental's BRACKETS** (docs/plans/alteration-signs-plan.md K3) — a selectable kind of their
 * own, `accidentalEnclosure`, his ask (2026-10-10): *"i should be also able to select the parenthesis individual so
 * i can delete it"*. One pair per pitch — clicking either bracket selects both; Delete takes them off and the
 * note stays (`shortcutWiring`); the Keypad's `Enter` does the same (`stamps/accidentalEnclosureTool`).
 *
 * ⭐ Each bracket has its own hit box (`rendering/signBracketBoxes`), inside the accidental's own box (which
 * covers the whole run), so this kind is asked BEFORE the accidental in `ELEMENT_HIT_ORDER`: a press on a
 * bracket is the brackets', a press on the sign is the sign's.
 *
 * ⭐ Painted the accidental's way — the registered box matched to its `<text>` on both axes — so ONLY the two
 * brackets light, ⛔ not the sign between them.
 */
import { dbg } from '@/utils/debug'
import { voiceFillColor } from '@/utils/voiceColors'
import { selectedOf } from '../state/EditorState'
import type { ClickableElementSpec } from './chain'
import type { HighlightContext } from './highlightContext'

/** A bracket glyph is ~0.56 sp wide: pad its box a little, as the head's brackets' are. */
const PAD = 2

export const ACCIDENTAL_ENCLOSURE_ELEMENT: ClickableElementSpec = {
  kind: 'accidentalEnclosure',
  hit({ registry, x, y }, deps) {
    const at = registry.getByType('accidentalEnclosure').find(el => {
      const b = el.bbox
      return x >= b.x - PAD && x <= b.x + b.width + PAD && y >= b.y && y <= b.y + b.height
    })
    if (!at?.noteId) return false
    dbg(`✓ Accidental brackets selected | noteId:${at.noteId}`)
    return deps.pick({ kind: 'accidentalEnclosure', noteId: at.noteId })
  },
  highlight: paintSelectedAccidentalEnclosure,
}

/** Light the selected pair, in its note's voice colour — each bracket's `<text>` found by its registered box. */
export function paintSelectedAccidentalEnclosure(ctx: HighlightContext): void {
  const noteId = selectedOf(ctx.state, 'accidentalEnclosure')?.noteId
  if (!noteId) return
  const color = voiceFillColor(ctx.engine.getNote(noteId)?.voice ?? 0)
  const boxes = ctx.engine.getElementRegistry().getByType('accidentalEnclosure').filter(el => el.noteId === noteId)
  // ⚠️ Every `<text>`, ⛔ not `g.accidental text`: a grace's and a fan member's signs are stamped loose in their
  //    member group (K3b), and the box match on both axes is what picks the two brackets out.
  const texts = ctx.svg.querySelectorAll('text')
  for (const { bbox } of boxes) {
    const cx = bbox.x + bbox.width / 2
    const cy = bbox.y + bbox.height / 2
    for (const text of texts) {
      const b = (text as SVGGraphicsElement).getBBox?.()
      if (!b) continue
      if (Math.abs(b.x + b.width / 2 - cx) < 1.0 && Math.abs(b.y + b.height / 2 - cy) < bbox.height / 2 + 1.0) {
        const el = text as SVGElement
        ctx.setAttr(el, 'fill', color)
        ctx.setStyleProp(el, 'fill', color)
        ctx.addClass(el, 'selected-accidental')
      }
    }
  }
}
