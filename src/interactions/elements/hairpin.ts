/**
 * A HAIRPIN — the crescendo / diminuendo wedge. Hit-tested against its drawn OUTLINE, the slur's
 * rule and for the slur's reason: the bbox of a wedge spanning four bars is a wide flat rectangle
 * sitting under all of them, and selecting a hairpin by clicking anywhere in that band would steal
 * presses from every note above it.
 *
 * ⚠️ A wedge split across a system break registers ONE ENTRY PER FRAGMENT, each carrying the same
 * hairpin id. That is what makes either half clickable, and it is why the search below is a `find`
 * over all of them rather than a lookup: the id is the answer, whichever piece was hit.
 */
import { dbg } from '@/utils/debug'
import type { ClickableElementSpec } from './chain'
import { distToSegment } from './slur'

export const HAIRPIN_ELEMENT: ClickableElementSpec = {
  kind: 'hairpin',
  /** Select a wedge for edit or removal (hit-tested against its outline). */
  hit({ registry, x, y }, deps) {
    // The same pad as the slur's: a hairline is 0.16 staff spaces, far thinner than a pointer can
    // be aimed, so both arms carry a few px of grace. It also covers the wedge's INTERIOR, which is
    // never more than half an aperture (~0.66 spaces) from an arm.
    const pad = 7
    const hairpinAt = registry.getByType('hairpin').find(el => {
      const pts = el.points
      if (!pts || pts.length < 2) return false
      for (let i = 1; i < pts.length; i++) {
        if (distToSegment(x, y, pts[i - 1], pts[i]) <= pad) return true
      }
      return false
    }) ?? null
    if (!hairpinAt?.id) return false

    dbg(`✓ Hairpin selected | id:${hairpinAt.id}`)
    return deps.pick({ kind: 'hairpin', id: hairpinAt.id })
  },

  // Recoloured, plus the attachment guide (the fourth kind, 2026-08-17). ⭐ At the wedge's BEGINNING
  // only — his call, where MuseScore draws one line per END of a spanner: the extent is already
  // visible as ink, so what the guide adds is where the gesture is anchored.
  // …plus the two endpoint SQUARES, one per end of the wedge (his ask, 2026-08-17). Drawing only
  // for now — see `./hairpinHandles`, which owns where they sit.
  highlight: h => { h.applyHairpinSelectionHighlight(); h.applyAnchorGuideLine(); h.applyHairpinHandles() },
}
