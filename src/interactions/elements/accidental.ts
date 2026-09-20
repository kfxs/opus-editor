/**
 * An ACCIDENTAL — the sharp/flat/natural in front of a notehead. A property of the note, so it is
 * located by `noteId`; Delete reverts the note to the bar's prevailing alteration.
 */
import { dbg } from '@/utils/debug'
import type { ClickableElementSpec } from './chain'
import type { HighlightContext } from './highlightContext'
import { selectedOf } from '../EditorState'
import { voiceFillColor } from '@/utils/voiceColors'

export const ACCIDENTAL_ELEMENT: ClickableElementSpec = {
  kind: 'accidental',
  /** Select an accidental glyph for removal. */
  hit({ registry, x, y }, deps) {
    const accidentalAt = registry.getByType('accidental').find(el => {
      const b = el.bbox
      return x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height
    }) ?? null
    if (!accidentalAt?.noteId) return false

    dbg(`✓ Accidental selected | noteId:${accidentalAt.noteId} type:${accidentalAt.accidentalType}`)
    // The shared tail clears the whole note selection (the multi-select Map drives the note
    // highlight, not just selectedNoteId) so only the accidental shows selected.
    return deps.pick({
      kind: 'accidental', noteId: accidentalAt.noteId, type: accidentalAt.accidentalType || null,
    })
  },

  highlight: paintSelectedAccidental,
}

/**
 * Colour the accidental(s) belonging to a selected note in the note's selection colour. The
 * accidental glyph lives inside the note's own `stavenote` group, so we scope the search there
 * (cheaper than a full-SVG scan) and match it to the registered `accidental` element by bbox on
 * BOTH axes — an X-only match would catch a chord neighbour's accidental or a notehead sharing the
 * column (same reasoning as {@link paintSelectedAccidental}). Uses the logged setAttr/addClass, so
 * `clearHighlights` reverts it with the rest of the note highlight.
 */
export function paintNoteAccidentals(ctx: HighlightContext, noteId: string, group: Element, color: string): void {
  const engine = ctx.engine
  const accElements = engine.getElementRegistry().getByType('accidental').filter(el => el.noteId === noteId)
  if (!accElements.length) return

  const textEls = group.querySelectorAll('text')
  for (const accEl of accElements) {
    const bbox = accEl.bbox
    const centerX = bbox.x + bbox.width / 2
    const centerY = bbox.y + bbox.height / 2
    for (const svgEl of textEls) {
      const elBBox = (svgEl as SVGGraphicsElement).getBBox?.()
      if (!elBBox) continue
      const elX = elBBox.x + elBBox.width / 2
      const elY = elBBox.y + elBBox.height / 2
      if (Math.abs(elX - centerX) < 1.0 && Math.abs(elY - centerY) < bbox.height / 2 + 1.0) {
        const el = svgEl as SVGElement
        ctx.setAttr(el, 'fill', color)
        ctx.setStyleProp(el, 'fill', color)
        ctx.addClass(el, 'selected-note')
      }
    }
  }
}

export function paintSelectedAccidental(ctx: HighlightContext): void {
  const engine = ctx.engine
  const selected = selectedOf(ctx.state, 'accidental')
  if (!selected) return

  const registry = engine.getElementRegistry()
  const accElements = registry.getByType('accidental').filter(
    el => el.noteId === selected.noteId && el.accidentalType === selected.type,
  )
  if (!accElements.length) return

  const svg = ctx.svg

  // Paint the accidental in ITS voice's colour (V1 blue, V2 green — Sibelius-style;
  // matches the notehead/tie highlight) rather than a uniform orange.
  const voice = engine.getNote(selected.noteId)?.voice ?? 0
  const ACCIDENTAL_COLOR = voiceFillColor(voice)

  for (const accEl of accElements) {
    const bbox = accEl.bbox
    const centerX_bbox = bbox.x + bbox.width / 2
    const centerY_bbox = bbox.y + bbox.height / 2
    const textEls = svg.querySelectorAll('text')
    for (const svgEl of textEls) {
      const elBBox = (svgEl as SVGGraphicsElement).getBBox?.()
      if (!elBBox) continue

      const centerX_el = elBBox.x + elBBox.width / 2
      const centerY_el = elBBox.y + elBBox.height / 2
      // Match on BOTH axes: an X-only match paints every glyph in the accidental
      // column — the other voice's accidental and any notehead sharing that X —
      // when stacked voices put a sharp and flat in the same column.
      if (Math.abs(centerX_el - centerX_bbox) < 1.0 &&
          Math.abs(centerY_el - centerY_bbox) < bbox.height / 2 + 1.0) {
        const el = svgEl as SVGElement
        ctx.setAttr(el, 'fill', ACCIDENTAL_COLOR)
        ctx.setStyleProp(el, 'fill', ACCIDENTAL_COLOR)
        ctx.addClass(el, 'selected-accidental')
      }
    }
  }
}
