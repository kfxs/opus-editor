/**
 * A KEY SIGNATURE — the row of signs at a bar's head, on one staff.
 *
 * Straight after the time signature, and the three of them are one argument: clef, key, meter are
 * big glyphs in their own columns of the header, laid out left to right with no overlap, so the
 * order among them decides nothing and asking each costs one array scan
 * (docs/plans/key-signature-plan.md §5).
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
import type { HighlightContext } from './highlightContext'
import { ELEMENT_SELECTION_FILL } from '@/utils/selectionColors'
import { keySignatureStavesAt } from '../keySignatureScope'
import { selectedOf } from '../EditorState'

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

  highlight: paintSelectedKeySignature,
}

/**
 * ⭐ **THE KEY SIGNATURE, LIT** — the row of signs at the head of the selected bar, on the staff it
 * was clicked on.
 *
 * ⭐ **It recolours OUR OWN GROUP's ink**, the barline's treatment and not the clef's: `keysig-<measure>-<staff>`
 * is a group this repo's own pass opened, rebuilt from scratch every render, holding exactly the
 * signs of one signature and nothing else. So there is no bbox scan to mis-aim and no neighbour to
 * bleed onto — the two failure modes `clef.paintSelectedClef`'s glyph scan has to guard
 * against by scoping itself to a measure group.
 *
 * ⭐⭐ **EVERY STAFF THAT SAYS THE SAME THING — his report, 2026-08-28:** *"the key is for all the
 * staves in this case however when i selected it only select the first stave."* Dead right. A key is
 * STORED per staff (that is what lets Bartók's two hands differ), but a plain drop writes them all,
 * so what stands at that bar is normally ONE statement drawn N times — exactly the time signature's
 * and the barline's case, and both of those light every staff.
 *
 * ⭐ **So the scope is READ FROM THE MODEL rather than assumed either way**
 * ({@link keySignatureStavesAt}): every staff whose signature at this bar IS the selected one. Two
 * staves in different keys light separately, because they are two statements; two staves in the same
 * key light together, because they are one. ⛔ Not "all staves" and ⛔ not "the clicked staff".
 *
 * ⚠️ Delete reads the SAME predicate, which is the rule that makes this honest — the highlight
 * promises what the edit does (`shortcutWiring`'s `keySignature` case).
 *
 * ⛔ FILL only, no stroke: these are glyphs, and an outlined glyph reads as bold (the note
 * highlight's own rule).
 */
export function paintSelectedKeySignature(ctx: HighlightContext): void {
  const engine = ctx.engine
  const selected = selectedOf(ctx.state, 'keySignature')
  const svg = ctx.svg
  if (!selected) return
  for (const staff of keySignatureStavesAt(engine, selected.measure, selected.staff)) {
    // ⭐⭐ **BOTH PIECES OF ITS INK.** A change that lands on a system break is engraved twice — the
    //    CAUTIONARY at the end of the previous line and the signature at the head of the new one
    //    (Gould p. 93) — and they are ONE statement, so selecting it lights both. His report,
    //    2026-08-28: *"the cautionary is not clickable and neither selectable."*
    //
    // ⚠️ The caution group is filed under the bar that DRAWS it, which is the bar BEFORE the change
    //    — that asymmetry is the pass's (`KeySignaturePass.drawCautionary`), and it is why this is
    //    two lookups rather than one id built from the selection.
    //
    // ⭐ The group's existence IS the "was this painted?" test — the pass draws one only for ink it
    //    actually put on the page (`ElementRegistry`'s `keySignature` note).
    const groups = [
      svg.querySelector<SVGGElement>(`[id="keysig-${selected.measure}-${staff}"]`),
      svg.querySelector<SVGGElement>(`[id="keysig-caution-${selected.measure - 1}-${staff}"]`),
    ]
    for (const group of groups) {
      if (!group) continue
      // ⛔ `text` only, never `rect`: the caution group also holds the five rects of the OPEN STAFF
      //    TAIL it draws, and recolouring the staff would paint a blue box under the signs.
      for (const el of group.querySelectorAll('text, path')) {
        ctx.setAttr(el as SVGElement, 'fill', ELEMENT_SELECTION_FILL)
        ctx.setStyleProp(el as SVGElement, 'fill', ELEMENT_SELECTION_FILL)
        ctx.addClass(el as SVGElement, 'selected-keysig')
      }
    }
  }
}
