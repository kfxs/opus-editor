/**
 * An OTTAVA — the octave numeral and its dashed bracket. Hit-tested against its drawn BAND, the
 * trill's rule and for the trill's reason: an octave line spanning four bars has a bounding
 * rectangle sitting above all of them, and a press anywhere in that rectangle must not be able to
 * claim the line when what the pointer was over was a note.
 *
 * ⚠️ A line crossing a system break registers ONE ENTRY PER FRAGMENT, each carrying the same ottava
 * id. That is what makes either piece clickable, and it is why the search below is a `find` over all
 * of them rather than a lookup: the id is the answer, whichever piece was hit.
 *
 * ⭐ Containment first, proximity second — {@link TRILL_ELEMENT}'s arrangement, and here it matters
 * a little more: the bracket's ink is a numeral and a DASHED line, so most of the band is literally
 * empty. A test that only measured distance to the drawn ink would make the gaps between dashes
 * cold, and the reader has no way to know where they are.
 */
import { dbg } from '@/utils/debug'
import type { ClickableElementSpec } from './chain'
import { distToSegment } from './slur'

/** A few px of grace at the edges — the pad the slur, hairpin and trill already share. */
const PAD = 7

export const OTTAVA_ELEMENT: ClickableElementSpec = {
  kind: 'ottava',
  /** Select an octave line for edit or removal (hit-tested against its drawn band). */
  hit({ registry, x, y }, deps) {
    const ottavaAt = registry.getByType('ottava').find(el => {
      const pts = el.points
      if (!pts || pts.length < 2) return false
      const xs = pts.map(p => p.x)
      const ys = pts.map(p => p.y)
      const inside = x >= Math.min(...xs) - PAD && x <= Math.max(...xs) + PAD
        && y >= Math.min(...ys) - PAD && y <= Math.max(...ys) + PAD
      if (inside) return true
      for (let i = 1; i < pts.length; i++) {
        if (distToSegment(x, y, pts[i - 1], pts[i]) <= PAD) return true
      }
      return false
    }) ?? null
    if (!ottavaAt?.id) return false

    dbg(`✓ Ottava selected | id:${ottavaAt.id}`)
    return deps.pick({ kind: 'ottava', id: ottavaAt.id })
  },

  // Recoloured, plus the attachment guide (the fifth kind, 2026-08-17). ⭐ At the bracket's BEGINNING
  // only, and to a PLACE rather than a note — an octave line governs a region, so it belongs to no
  // single pitch. Its side follows the shift, like everything else about the bracket.
  // …and the two endpoint squares, one beyond each end (`./ottavaHandles`) — the hairpin's pair.
  highlight: h => {
    h.applyOttavaSelectionHighlight()
    h.applyAnchorGuideLine()
    h.applyOttavaHandles()
  },
}
