/**
 * A TEMPO MARK — the words and/or metronome above the staff. System-level: the mark is drawn once,
 * above the TOP staff, so the press is NOT scoped to the clicked staff.
 *
 * One of the two kinds a DOUBLE-click edits in place instead of selecting.
 */
import { dbg } from '@/utils/debug'
import type { ClickableElementSpec } from './chain'

export const TEMPO_ELEMENT: ClickableElementSpec = {
  kind: 'tempo',
  /** Select a tempo mark for removal, or open the text editor on a double-click. */
  hit({ event, registry, x, y, closestElement }, deps) {
    const pad = 6
    const tempoAt = registry.getByType('tempo').find(el => {
      const b = el.bbox
      return x >= b.x - pad && x <= b.x + b.width + pad
        && y >= b.y - pad && y <= b.y + b.height + pad
    }) ?? null
    if (!tempoAt?.id) return false

    // Never steal a click that lands on a note/rest body — a high note can sit under the
    // mark's padded box (it is engraved on a fixed line above the staff).
    if (closestElement && registry.hitsNoteOrRestBody(closestElement, x, y)) return false

    // Double-click → edit the whole mark in place, as one string ('Allegro (♩ = 144)'). The
    // model is read back out of what was typed — see TempoTextSource / utils/tempoText.
    if (deps.isDoubleClick('tempo', tempoAt.id)) {
      // Stop the browser's default mousedown focus/selection — it would steal focus back
      // from the overlay right after we focus it, and typing would go nowhere.
      event.preventDefault()
      dbg(`✓ Editing tempo mark | id:${tempoAt.id}`)
      deps.openEditor('tempo', tempoAt.id)
      return true
    }

    // ⭐ Click = select; drag (decided on move, past the same time threshold every other handle
    // uses) walks the mark through the music and moves its ink (`interactions/tempoWalk`). The MARK
    // is its own handle — a tempo mark is a point, like a dynamic and unlike the span families.
    // Armed inside `pick` so the order matches theirs: assignment, then arm, then repaint.
    dbg(`✓ Tempo mark selected | id:${tempoAt.id}`)
    return deps.pick(
      { kind: 'tempo', id: tempoAt.id },
      () => deps.armTempoDrag(tempoAt.id!, event),
    )
  },

  // The mark is recoloured, and — since 2026-08-17 — it also draws the attachment guide to the place
  // in time it governs (his call; the dynamic was the first kind, this is the second). ⭐ The row is
  // ONE of the two edits a kind needs: the other is capturing the two endpoints in the pass that
  // draws it (`TempoLayout.drawTempoMarks`). Nothing about the guide itself is per-kind.
  highlight: h => { h.applyTempoSelectionHighlight(); h.applyAnchorGuideLine() },
}
