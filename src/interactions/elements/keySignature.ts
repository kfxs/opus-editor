/**
 * A KEY SIGNATURE — the row of signs at a bar's head, on one staff.
 *
 * Straight after the time signature, and the three of them are one argument: clef, key, meter are
 * big glyphs in their own columns of the header, laid out left to right with no overlap, so the
 * order among them decides nothing and asking each costs one array scan
 * (docs/key-signature-plan.md §5).
 *
 * ⭐ **ONE BOX FOR THE WHOLE ROW**, registered by the drawing pass itself
 * (`engine/rendering/KeySignaturePass`): the signature is what you select and delete — there is no
 * removing the C♯ from D major and keeping the F♯ — so the target is the statement, not its letters.
 *
 * ⚠️ **No `isPainted` filter, unlike the clef and the meter above.** Their boxes are TIER 1 records,
 * written for every bar in the score whether it is on screen or not, so a culled bar keeps a box with
 * no glyph under it. This box is written by the PEN: its existence is proof it was painted, which is
 * `repeatStart`'s position exactly.
 *
 * ⛔ **A C-major signature cannot be reached from here at all** — it draws no ink, so it registers no
 * box, and our whole selection design rests on ink (*"a press may only reach ink"*). That is the
 * SIGNPOST's job when it is drawn, and ⛔ deliberately NOT a zero-width hit box: an invisible target
 * that steals presses from the barline beside it is worse than no target (plan §5).
 */
import { dbg } from '@/utils/debug'
import { staffOf } from '@/utils/lanes'
import type { ClickableElementSpec } from './chain'

export const KEY_SIGNATURE_ELEMENT: ClickableElementSpec = {
  kind: 'keySignature',
  /** Select a key signature — the row of signs drawn at this bar's head, on this staff. */
  hit({ registry, x, y }, deps) {
    const keyAt = registry.getByType('keySignature').find(el => {
      const b = el.bbox
      return x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height
        && el.measure !== undefined
    }) ?? null
    if (keyAt?.measure === undefined) return false

    dbg(`✓ Key signature selected | measure:${keyAt.measure} staff:${staffOf(keyAt)}`)
    return deps.pick({ kind: 'keySignature', measure: keyAt.measure, staff: staffOf(keyAt) })
  },

  highlight: h => h.applyKeySignatureSelectionHighlight(),
}
