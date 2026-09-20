/**
 * 🚧 **THE SKETCHED HEADER'S TWO LINES** — the title and the composer at the top of the first page,
 * clickable, and nothing more.
 *
 * ⛔ Read `engine/rendering/ScoreHeaderPass`'s note first: this is scaffolding over two optional
 * strings on `Score`, and the real thing is a FRAME of text items with ids of their own. This module
 * is what it takes to make the sketch answer a press, filed where every other kind's press lives so
 * that the nineteenth kind is a row in a table and not a slice through `MouseController`.
 *
 * ⭐ **ONE spec for BOTH lines**, discriminated by the `ScoreTextField` the registry entry carries.
 * They differ in nothing a press or a highlight cares about, so a second module would be a copy with
 * one word changed — the thing `engine/models/scoreTextOps`' table exists to prevent.
 *
 * ⭐ **FIRST in {@link ELEMENT_HIT_ORDER}, and the position is free.** The block is drawn in the
 * first page's TOP MARGIN, above the opening system — no staff, no bar, no other element's ink can
 * reach it — so nothing it precedes could ever have wanted the press. It goes first because it is
 * the cheapest test in the chain (two boxes, present only on page 1) and because "is this even in
 * the music?" is the right question to ask before any of the musical ones.
 *
 * ⚠️ **The boxes exist only when the ink was MEASURED** (`ScoreHeaderPass.registerScoreText` — no
 * estimate, ever), so under the unit runner there are no entries and this declines every press. That
 * is why the geometry of the press belongs in the browser suite, not here.
 */
import { dbg } from '@/utils/debug'
import type { ClickableElementSpec } from './chain'
import type { HighlightContext } from './highlightContext'
import { ELEMENT_SELECTION_FILL } from '@/utils/selectionColors'
import { scoreTextClass } from '@/engine/rendering/ScoreHeaderPass'
import { selectedOf } from '../state/EditorState'

export const SCORE_TEXT_ELEMENT: ClickableElementSpec = {
  kind: 'scoreText',

  /**
   * Select whichever header line the press landed on — or, on a DOUBLE-click, open the dialog that
   * changes it (his ask, 2026-08-27: *"double clicking on the title or in the composer in the score
   * should open the dialog to change it"*).
   *
   * ⭐ The TEMPO mark's arrangement exactly, and deliberately: click selects, double-click edits.
   * ⚠️ The thing counted is `('scoreText', field)` — there are two header lines and the field IS the
   * identity of one (see `DoubleClickMark` in `./chain`).
   *
   * ⛔ No pad. The marks engraved among the notes pad their boxes because a near-miss on a small
   * target is a miss; these two sit alone in the page's top margin, so their own ink is already a
   * generous target and a pad would only start claiming blank paper that belongs to nothing.
   *
   * ⚠️ FIRST match wins, which is the drawn order (title, then composer) — and it cannot matter:
   * the two lines never overlap. The title is centred at the top of the block and the composer sits
   * right-aligned at its foot, six staff spaces below.
   */
  hit({ event, registry, x, y }, deps) {
    for (const el of registry.getByType('scoreText')) {
      const b = el.bbox
      if (x < b.x || x > b.x + b.width || y < b.y || y > b.y + b.height) continue
      const field = el.scoreTextField
      if (!field) continue // registered without one — nothing to select

      if (deps.isDoubleClick('scoreText', field)) {
        // Stop the browser's default mousedown focus/selection — it would steal focus back from the
        // dialog's box right after it is focused, and typing would go nowhere.
        event.preventDefault()
        dbg(`✓ Editing score ${field}`)
        deps.openScoreTextDialog(field)
        return true
      }

      dbg(`✓ Score ${field} selected`)
      return deps.pick({ kind: 'scoreText', field })
    }
    return false
  },

  highlight: paintSelectedScoreText,
}

/**
 * 🚧 **THE SKETCHED HEADER LINE, LIT** — the title or the composer at the head of the first page,
 * recoloured in the element-selection ink (`engine/rendering/ScoreHeaderPass`; ⛔ read its note
 * before building on it).
 *
 * ⭐ It lights only the line that was SELECTED, which is what makes the two separable at all: the
 * class the pass wrote onto each `<text>` names its field, so the selection's own `field` finds
 * exactly one of them.
 *
 * ⭐ FILL only, never a stroke. It is text: an outlined glyph reads as BOLD, which is the mistake
 * the note highlight names out loud, and it would be worse on a 4.4-space title than anywhere.
 */
export function paintSelectedScoreText(ctx: HighlightContext): void {
  const selected = selectedOf(ctx.state, 'scoreText')
  if (!selected) return
  const text = ctx.svg.querySelector(`.${scoreTextClass(selected.field)}`) as SVGElement | null
  if (!text) return
  ctx.setAttr(text, 'fill', ELEMENT_SELECTION_FILL)
  ctx.setStyleProp(text, 'fill', ELEMENT_SELECTION_FILL)
}
