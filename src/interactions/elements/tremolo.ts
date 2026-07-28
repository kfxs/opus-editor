/**
 * A TREMOLO MARK — the strokes (or the Penderecki sign) drawn on a stem.
 */
import { dbg } from '@/utils/debug'
import type { ClickableElementSpec } from './chain'

export const TREMOLO_ELEMENT: ClickableElementSpec = {
  kind: 'tremolo',
  /**
   * Select a slot's TREMOLO mark — asked immediately before the stem, because it is drawn ON the
   * stem and the two rects overlap wherever the strokes are.
   *
   * THE MARK WINS ONLY INSIDE ITS OWN BOUNDARIES. Both are registered as INK, and this test is bare
   * containment (no pad, see {@link ElementRegistry.findTremoloAt}), so the border between the two
   * is the edge of the strokes themselves: press on the strokes and you get the mark; press on the
   * stem above or below them — which on a two-stroke tremolo is most of its length — and the stem is
   * still perfectly selectable.
   *
   * The notehead keeps its ground first, exactly as it does against the stem: a tremolo's stack is
   * centred on the stem and cannot reach the head, so this only ever declines a press the head
   * already owns.
   */
  hit({ engine, registry, x, y, closestElement }, deps) {
    if (closestElement && registry.hitsNoteOrRestBody(closestElement, x, y)) return false

    // A tremolo carries `noteId`, never `id` — like the stem it rides.
    const noteId = registry.findTremoloAt(x, y)?.noteId
    if (!noteId) return false

    dbg(`✓ Tremolo selected | noteId:${noteId} mark:${engine.getNote(noteId)?.tremolo}`)
    return deps.pick({ kind: 'tremolo', noteId })
  },

  highlight: h => h.applyTremoloHighlight(),
}
