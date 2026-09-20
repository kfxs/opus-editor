/**
 * A TREMOLO MARK — the strokes (or the Penderecki sign) drawn on a stem.
 */
import { dbg } from '@/utils/debug'
import type { ClickableElementSpec } from './chain'
import type { HighlightContext } from './highlightContext'
import { selectedOf } from '../EditorState'
import { voiceFillColor } from '@/utils/voiceColors'
import { tremoloGlyph } from '@/utils/tremoloGlyphs'
import { TREMOLO_PAIR_GROUP } from '@/utils/tremoloPair'

export const TREMOLO_ELEMENT: ClickableElementSpec = {
  kind: 'tremolo',
  /**
   * Select a slot's TREMOLO mark — asked immediately before the stem, because it is drawn ON the
   * stem and the two rects overlap wherever the strokes are.
   *
   * THE MARK WINS ONLY INSIDE ITS OWN BOUNDARIES. Both are registered as INK, and this test is bare
   * containment (no pad, see {@link ElementRegistry.findTremoloAt}), so the border between the two
   * is the edge of the strokes themselves: press on the strokes and you get the mark; press on the
   * stem above or below them — which on a two-stroke tremolo is most of its length — and the stem is
   * still perfectly selectable.
   *
   * The notehead keeps its ground first, exactly as it does against the stem: a tremolo's stack is
   * centred on the stem and cannot reach the head, so this only ever declines a press the head
   * already owns.
   */
  hit({ engine, registry, x, y, closestElement }, deps) {
    if (closestElement && registry.hitsNoteOrRestBody(closestElement, x, y)) return false

    // A tremolo carries `noteId`, never `id` — like the stem it rides.
    const noteId = registry.findTremoloAt(x, y)?.noteId
    if (!noteId) return false

    dbg(`✓ Tremolo selected | noteId:${noteId} mark:${engine.getNote(noteId)?.tremolo}`)
    return deps.pick({ kind: 'tremolo', noteId })
  },

  highlight: paintSelectedTremolo,
}

/**
 * Colour the tremolo mark on `noteId` — every stroke of the stack, or the Penderecki sign.
 *
 * Shared by the selected-TREMOLO highlight ({@link paintSelectedTremolo}) and the selected-NOTE
 * highlight ({@link paintNote}), exactly as {@link paintNoteDots} and
 * {@link paintNoteArticulations} are shared: selecting the note lights everything that belongs to
 * it, and selecting the mark lights just the mark. No-op on a note without one.
 *
 * Found by GLYPH, not by geometry: the strokes are `<text>` elements inside the note's own
 * `stavenote` group whose content is the tremolo codepoint, so matching the character picks all
 * N of them and nothing else. The nearest-glyph matching the accidental and the articulations use
 * would be wrong here — the stack sits along the stem, where a chord's upper noteheads are, and it
 * is one registered rect covering N glyphs rather than one box per glyph.
 *
 * ⚠️ A TWO-NOTE PAIR takes the other branch entirely — see {@link paintTremoloPairGroup}. Its
 * strokes are not glyphs and not inside any note group, so the search above finds nothing.
 */
export function paintNoteTremolo(ctx: HighlightContext, noteId: string, color: string): void {
  const engine = ctx.engine
  const note = engine.getNote(noteId)
  const mark = note?.tremolo
  if (mark === undefined) return
  if (note?.tremoloPair) {
    paintTremoloPairGroup(ctx, noteId, color)
    return
  }
  const group = engine.getStaveNoteSVGGroup(noteId)?.group
  if (!group) return

  const glyph = tremoloGlyph(mark)
  group.querySelectorAll('text').forEach(el => {
    if (el.textContent !== glyph) return
    const svgEl = el as SVGElement
    ctx.setAttr(svgEl, 'fill', color)
    ctx.setStyleProp(svgEl, 'fill', color)
    ctx.addClass(svgEl, 'selected-tremolo')
  })
}

/**
 * Colour a TWO-NOTE tremolo's strokes — the one selection seam the pair could not inherit.
 *
 * Its strokes are our own beam quads (`<path>`s), drawn outside every note group, so
 * {@link paintNoteTremolo}'s glyph search has nothing to match: no `<text>`, no codepoint, and not
 * in the note's `stavenote` group to begin with. So the renderer PAINTS them into a named group
 * (`TREMOLO_PAIR_GROUP`) and this colours that group whole — the barline lesson again: paint a
 * highlight, do not go hunting for glyphs to recolour.
 *
 * ⚠️ Matched on the id ATTRIBUTE, not `getElementById` and not a `#id` selector: the id is
 * document-wide (reference_vexflow_getsvgelement_is_document_wide) and a note id is a uuid that may
 * start with a digit, which is not a legal CSS id selector. Scoped to the score canvas and read off
 * the class, so both problems go away.
 *
 * Fills AND strokes, because `fillBeamQuad` fills a path — a stroke-only recolour would leave the
 * strokes black.
 */
export function paintTremoloPairGroup(ctx: HighlightContext, noteId: string, color: string): void {
  const wanted = `${TREMOLO_PAIR_GROUP}-${noteId}`
  for (const group of ctx.svg.querySelectorAll(`.${TREMOLO_PAIR_GROUP}`)) {
    if (group.getAttribute('id') !== wanted) continue
    group.querySelectorAll('path').forEach(el => {
      const svgEl = el as SVGElement
      ctx.setAttr(svgEl, 'fill', color)
      ctx.setStyleProp(svgEl, 'fill', color)
      ctx.addClass(svgEl, 'selected-tremolo')
    })
  }
}

/** Highlight the tremolo selected on the score (a click on its strokes). Paints in the slot's
 *  voice colour, like every other sub-element highlight. */
export function paintSelectedTremolo(ctx: HighlightContext): void {
  const engine = ctx.engine
  const noteId = selectedOf(ctx.state, 'tremolo')?.noteId
  if (!noteId) return
  paintNoteTremolo(ctx, noteId, voiceFillColor(engine.getNote(noteId)?.voice ?? 0))
}
