/**
 * A TIE — the arc joining two soundings of the same pitch. Identified by the note it comes FROM,
 * because that is where the model keeps it (`tiedTo` on the pitch).
 */
import { dbg } from '@/utils/debug'
import type { ClickableElementSpec } from './chain'

export const TIE_ELEMENT: ClickableElementSpec = {
  kind: 'tie',
  /** Select a tie arc for removal. */
  hit({ registry, x, y }, deps) {
    const tiePad = 6
    const tieAt = registry.getByType('tie').find(el => {
      const b = el.bbox
      return x >= b.x - tiePad && x <= b.x + b.width + tiePad
        && y >= b.y - tiePad && y <= b.y + b.height + tiePad
    }) ?? null
    if (!tieAt?.fromNoteId) return false

    dbg(`✓ Tie selected | fromNoteId:${tieAt.fromNoteId} toNoteId:${tieAt.toNoteId} fromMeasure:${tieAt.fromMeasure} toMeasure:${tieAt.toMeasure}`)
    // The shared tail clears the whole note selection (the multi-select Map, not just the anchor)
    // and any previous element, so only the tie ends up selected.
    return deps.pick({ kind: 'tie', fromNoteId: tieAt.fromNoteId })
  },

  highlight: h => h.applyTieHighlight(),
}
