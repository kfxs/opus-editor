/**
 * A DYNAMIC — the glyph or expression text below the staff. The other kind a DOUBLE-click edits in
 * place: any dynamic is editable, a level ('p'/'f') seeding the editor with its letters and custom
 * text with its text (expression == dynamic, Step 1).
 */
import { dbg } from '@/utils/debug'
import type { ClickableElementSpec } from './chain'

export const DYNAMIC_ELEMENT: ClickableElementSpec = {
  kind: 'dynamic',
  /** Select a dynamic mark for removal, or open the text editor on a double-click. */
  hit({ engine, event, registry, x, y, closestElement }, deps) {
    // Dynamic selection — click a dynamic mark (below the staff) to select it for
    // removal. Small pad makes the small glyph/text easier to hit.
    const dynPad = 6
    const dynamicAt = registry.getByType('dynamic').find(el => {
      const b = el.bbox
      return x >= b.x - dynPad && x <= b.x + b.width + dynPad
        && y >= b.y - dynPad && y <= b.y + b.height + dynPad
    }) ?? null
    if (!dynamicAt?.id) return false

    // A dynamic's padded hit-box can overlap a notehead/rest; never let it steal a
    // click that actually lands on a note/rest body — the note is the intended target.
    if (closestElement && registry.hitsNoteOrRestBody(closestElement, x, y)) return false

    // ⚠️ The model lookup is a guard on OPENING the editor, not on counting the double-click: a
    // second press now consumes the pair either way, where it used to leave it countable when the
    // id resolved to nothing. That case cannot arise — the registry is rebuilt from the model on
    // every render, so a registered dynamic has a model object — and making both double-click paths
    // identical is worth more than preserving it.
    if (deps.isDoubleClick('dynamic', dynamicAt.id) && engine.getDynamicById(dynamicAt.id)) {
      // Stop the browser's default mousedown focus/selection — otherwise it
      // steals focus back from the overlay right after we focus it, and typing
      // goes nowhere.
      event.preventDefault()
      dbg(`✓ Editing dynamic | id:${dynamicAt.id}`)
      deps.openEditor('dynamic', dynamicAt.id)
      return true
    }

    dbg(`✓ Dynamic selected | id:${dynamicAt.id}`)
    return deps.pick({ kind: 'dynamic', id: dynamicAt.id })
  },

  // The mark is already coloured by the set pass; the anchor line is the single-click extra.
  highlight: h => h.applyDynamicAnchorLine(),
}
