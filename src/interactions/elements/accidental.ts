/**
 * An ACCIDENTAL — the sharp/flat/natural in front of a notehead. A property of the note, so it is
 * located by `noteId`; Delete reverts the note to the bar's prevailing alteration.
 */
import { dbg } from '@/utils/debug'
import type { ClickableElementSpec } from './chain'

export const ACCIDENTAL_ELEMENT: ClickableElementSpec = {
  kind: 'accidental',
  /** Select an accidental glyph for removal. */
  hit({ registry, x, y }, deps) {
    const accidentalAt = registry.getByType('accidental').find(el => {
      const b = el.bbox
      return x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height
    }) ?? null
    if (!accidentalAt?.noteId) return false

    dbg(`✓ Accidental selected | noteId:${accidentalAt.noteId} type:${accidentalAt.accidentalType}`)
    // The shared tail clears the whole note selection (the multi-select Map drives the note
    // highlight, not just selectedNoteId) so only the accidental shows selected.
    return deps.pick({
      kind: 'accidental', noteId: accidentalAt.noteId, type: accidentalAt.accidentalType || null,
    })
  },

  highlight: h => h.applyAccidentalHighlight(),
}
