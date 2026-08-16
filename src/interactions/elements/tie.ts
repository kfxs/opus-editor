/**
 * A TIE — the arc joining two soundings of the same pitch. Identified by the note it comes FROM,
 * because that is where the model keeps it (`tiedTo` on the pitch).
 *
 * ⭐ **Hit-tested against the sampled CURVE, like the slur** (docs/slur-plan.md §12 Phase 3b). It
 * used to be a padded RECTANGLE around the arc's bbox — so a press anywhere in the empty air under
 * a tie selected it, and the tie was the last span element that behaved that way. The points arrive
 * for free now that every tie draws through `drawCurveArc`, which is why this landed with the
 * migration rather than as its own errand.
 */
import { dbg } from '@/utils/debug'
import type { ClickableElementSpec } from './chain'
import { distToSegment } from './slur'

export const TIE_ELEMENT: ClickableElementSpec = {
  kind: 'tie',
  /** Select a tie arc for removal. */
  hit({ registry, x, y }, deps) {
    // Distance to the line SEGMENTS between consecutive samples, not to the samples themselves: a
    // cross-system half spans a whole system, so its ~17 points sit far apart (the slur's note).
    const tiePad = 6
    const tieAt = registry.getByType('tie').find(el => {
      const pts = el.points
      if (!pts?.length) {
        // No sampled arc (a tie drawn before the migration, or one whose draw failed) — fall back
        // to the padded bbox so a tie is never unselectable.
        const b = el.bbox
        return x >= b.x - tiePad && x <= b.x + b.width + tiePad
          && y >= b.y - tiePad && y <= b.y + b.height + tiePad
      }
      if (pts.length === 1) return (x - pts[0].x) ** 2 + (y - pts[0].y) ** 2 <= tiePad * tiePad
      for (let i = 1; i < pts.length; i++) {
        if (distToSegment(x, y, pts[i - 1], pts[i]) <= tiePad) return true
      }
      return false
    }) ?? null
    if (!tieAt?.fromNoteId) return false

    dbg(`✓ Tie selected | fromNoteId:${tieAt.fromNoteId} toNoteId:${tieAt.toNoteId} fromMeasure:${tieAt.fromMeasure} toMeasure:${tieAt.toMeasure}`)
    // The shared tail clears the whole note selection (the multi-select Map, not just the anchor)
    // and any previous element, so only the tie ends up selected.
    return deps.pick({ kind: 'tie', fromNoteId: tieAt.fromNoteId })
  },

  highlight: h => h.applyTieHighlight(),
}
