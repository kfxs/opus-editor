/**
 * A TRILL — the `tr` and its wavy extension. Hit-tested against its drawn BAND, the hairpin's rule
 * and for the hairpin's reason: a trill spanning four bars has a bounding rectangle sitting above
 * all of them, and a press anywhere in that rectangle must not be able to claim the ornament when
 * what the pointer was over was a note.
 *
 * ⚠️ A trill repeated on a continuation system registers ONE ENTRY PER FRAGMENT, each carrying the
 * same trill id. That is what makes either piece clickable, and it is why the search below is a
 * `find` over all of them rather than a lookup: the id is the answer, whichever piece was hit.
 *
 * ⭐ **Unlike the hairpin's, the registered outline is a filled BAND rather than two thin arms** —
 * the ornament really is a solid run of glyphs from the sign to the end of the wiggle — so a press
 * INSIDE it is a hit, not just a press near an edge. `distToSegment` alone would leave the middle of
 * a tall band cold, which is why this tests containment first and proximity second.
 */
import { dbg } from '@/utils/debug'
import type { ClickableElementSpec } from './chain'
import { distToSegment } from './slur'

/** A few px of grace at the edges — the pad the slur and hairpin already share, for the same
 *  reason: a pointer cannot be aimed to the pixel, and the wiggle is a thin wave inside its band. */
const PAD = 7

export const TRILL_ELEMENT: ClickableElementSpec = {
  kind: 'trill',
  /** Select a trill for edit or removal (hit-tested against its drawn band). */
  hit({ registry, x, y }, deps) {
    const trillAt = registry.getByType('trill').find(el => {
      const pts = el.points
      if (!pts || pts.length < 2) return false
      // Inside the band — the ordinary case, since the glyphs fill it.
      const xs = pts.map(p => p.x)
      const ys = pts.map(p => p.y)
      const inside = x >= Math.min(...xs) - PAD && x <= Math.max(...xs) + PAD
        && y >= Math.min(...ys) - PAD && y <= Math.max(...ys) + PAD
      if (inside) return true
      // …and near an edge, for the same grace the other spanners give.
      for (let i = 1; i < pts.length; i++) {
        if (distToSegment(x, y, pts[i - 1], pts[i]) <= PAD) return true
      }
      return false
    }) ?? null
    if (!trillAt?.id) return false

    dbg(`✓ Trill selected | id:${trillAt.id}`)
    return deps.pick({ kind: 'trill', id: trillAt.id })
  },

  highlight: h => h.applyTrillSelectionHighlight(),
}
