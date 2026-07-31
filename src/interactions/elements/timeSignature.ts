/**
 * A TIME SIGNATURE — the meter glyph, drawn at bar 1 and at every explicit change.
 *
 * Straight after the clef, and for the same reason: the TS column sits to the right of the clef (no
 * overlap), and the glyph is only registered where it is drawn.
 */
import { dbg } from '@/utils/debug'
import type { ClickableElementSpec } from './chain'

export const TIME_SIGNATURE_ELEMENT: ClickableElementSpec = {
  kind: 'timeSignature',
  /** Select a time-signature glyph for removal. */
  hit({ registry, x, y }, deps) {
    // Time-signature selection — click the TS glyph to select it for removal.
    // The TS column sits to the right of the clef (no overlap), and the glyph is
    // only registered where it's drawn (measure 1 + change measures).
    //
    // ⚠️ "Where it's drawn" means which BARS carry a meter, not which bars are on screen: the box is
    // a TIER 1 record and survives culling. Painted lanes only, like the clef and the barline
    // beside it (`ElementRegistry.painted`).
    const timeSigAt = registry.getByType('timeSignature').find(el => {
      const b = el.bbox
      return x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height
        && el.measure !== undefined && registry.isPainted(el.measure, el.staff ?? 0)
    }) ?? null
    if (timeSigAt?.measure === undefined) return false

    const isDefault = timeSigAt.measure === 1
    dbg(`✓ Time signature selected | measure:${timeSigAt.measure}${isDefault ? ' (measure 1 default: delete hides the glyph, meter kept)' : ' (delete reverts to prior meter + rebars)'}`)
    return deps.pick({ kind: 'timeSignature', measure: timeSigAt.measure })
  },

  highlight: h => h.applyTimeSignatureSelectionHighlight(),
}
