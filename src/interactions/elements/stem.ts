/**
 * A STEM — the line off a notehead. Selection only: nothing acts on a selected stem yet (see
 * {@link SelectedElement}'s `stem`), and Delete deliberately declines — a stem is a property every
 * non-rest note has, not an object you can remove.
 */
import { dbg } from '@/utils/debug'
import type { ClickableElementSpec } from './chain'
import type { HighlightContext } from './highlightContext'
import { selectedOf } from '../EditorState'
import { voiceStrokeColor } from '@/utils/voiceColors'

export const STEM_ELEMENT: ClickableElementSpec = {
  kind: 'stem',
  /**
   * Select a slot's STEM — the twin of the dot/accidental handlers, and the pointer half of the
   * `'stem'` element the renderer already registers.
   *
   * THE NOTE COMES FIRST. `hitsNoteOrRestBody` deliberately ignores the stem (its tall box is what
   * made selection feel over-eager), so a stem click can only ever be one the note itself declined
   * — but the two rects DO overlap where the stem meets the head, so the note is asked first and
   * keeps that ground. What is left is the stem's free length, which is exactly what "click the
   * stem" means.
   *
   * Containment on the stem's own ink (padded), never nearest-note: a click at the TIP of a stem is
   * a whole stem-length from its own notehead, so proximity would hand it to a denser neighbour —
   * the same reason the tremolo stamp resolves through {@link ElementRegistry.findStemAt}.
   */
  hit({ registry, x, y, closestElement }, deps) {
    if (closestElement && registry.hitsNoteOrRestBody(closestElement, x, y)) return false

    // A stem carries `noteId`, never `id` (a stem must never answer a lookup for its note).
    const noteId = registry.findStemAt(x, y)?.noteId
    if (!noteId) return false

    dbg(`✓ Stem selected | noteId:${noteId}`)
    // The shared tail clears the whole note selection (the multi-select Map drives the note
    // highlight, not just selectedNoteId) so only the stem shows selected — mirrors the accidental
    // and the dots.
    return deps.pick({ kind: 'stem', noteId })
  },

  highlight: paintSelectedStem,
}

/**
 * Highlight the selected STEM — its own paths inside the note's `stavenote` group, in the
 * slot's voice colour like every other sub-element highlight.
 *
 * Resolved by IDENTITY (`getStaveNoteSVGGroup` hands back the stem element), so it works whether
 * the note drew its own stem or the beam drew it — the same lookup {@link paintNote} uses for
 * the head+stem case. Nothing else in the group is touched: the point of selecting a stem is that
 * it is not the note.
 */
export function paintSelectedStem(ctx: HighlightContext): void {
  const engine = ctx.engine
  const noteId = selectedOf(ctx.state, 'stem')?.noteId
  if (!noteId) return
  const stem = engine.getStaveNoteSVGGroup(noteId)?.stem
  if (!stem) return

  const color = voiceStrokeColor(engine.getNote(noteId)?.voice ?? 0)
  stem.querySelectorAll('path, line').forEach(el => {
    const svgEl = el as SVGElement
    ctx.setAttr(svgEl, 'stroke', color)
    ctx.setStyleProp(svgEl, 'stroke', color)
    ctx.addClass(svgEl, 'selected-stem')
  })
}
