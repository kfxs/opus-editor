/**
 * An AUGMENTATION DOT — or rather all of a slot's dots at once: `dots` is a single value on the
 * chord/rest, so the glyphs (one per notehead per dot) share one anchor id and there is no
 * individual dot to select.
 */
import { dbg } from '@/utils/debug'
import type { ElementInfo } from '@/engine/ElementRegistry'
import type { ClickableElementSpec } from './chain'
import type { HighlightContext } from './highlightContext'
import { selectedOf } from '../state/EditorState'
import { voiceFillColor } from '@/utils/voiceColors'

export const DOT_ELEMENT: ClickableElementSpec = {
  kind: 'dot',
  /**
   * Select a slot's augmentation DOTS. Clicking any one dot selects them ALL. Works on a dotted
   * REST too — the dot is the only sub-element a rest carries, and it is a normal thing to author
   * (and what restFill picks for a compound beat).
   */
  hit({ engine, registry, x, y }, deps) {
    // A dot glyph is ~3px across, so its bare bbox is unclickable — pad it, like the tie (6) /
    // dynamic (6) / articulation (8) boxes.
    //
    // Padding alone is not enough here, though. The note's own hit-box is not the notehead: it is a
    // generous ±1.1 staff spaces from the head CENTRE (ElementRegistry.hitsNoteOrRestBody), while
    // the head is only ~0.65 spaces half-wide — and VexFlow parks the dot in the gap just beyond it.
    // So the dot lies INSIDE the note's click margin: the two boxes overlap by construction, and
    // whichever is tested first simply wins while the loser becomes unclickable. Ordering cannot
    // separate them, and shrinking the note's margin would make every note harder to hit.
    //
    // So discriminate by PROXIMITY: the click goes to whichever centre it is nearer. A dot sits
    // beside its head at much the same height, so the X distance is what separates the two.
    const dotPad = 6
    const centerX = (el: ElementInfo) => el.bbox.x + el.bbox.width / 2
    const hits = registry.getByType('dot').filter(el => {
      const b = el.bbox
      return x >= b.x - dotPad && x <= b.x + b.width + dotPad
        && y >= b.y - dotPad && y <= b.y + b.height + dotPad
    })
    if (!hits.length) return false
    const dotAt = hits.reduce((best, el) =>
      Math.abs(x - centerX(el)) < Math.abs(x - centerX(best)) ? el : best)
    if (!dotAt.noteId) return false

    const head = registry.findClosestNoteOrRest(x, y)
    if (head && registry.hitsNoteOrRestBody(head, x, y)) {
      const headX = head.headX ?? centerX(head)
      // Ties go to the note: it is the primary target, and its dots are reachable from it anyway.
      if (Math.abs(x - headX) <= Math.abs(x - centerX(dotAt))) return false
    }

    dbg(`✓ Dot selected | noteId:${dotAt.noteId} dots:${engine.getNote(dotAt.noteId)?.dots ?? 0}`)
    // The shared tail clears the whole note selection (the multi-select Map drives the note
    // highlight, not just selectedNoteId) so only the dots show selected — mirrors the accidental.
    return deps.pick({ kind: 'dot', noteId: dotAt.noteId })
  },

  highlight: paintSelectedDot,
}

/**
 * Colour every augmentation-dot glyph of the slot anchored at `noteId`. Shared by the selected-DOT
 * highlight ({@link paintSelectedDot}) and the selected-NOTE highlight ({@link paintNote}),
 * exactly as {@link paintNoteArticulations} is shared — so a dotted note reads as fully selected
 * and clicking one dot lights them all.
 *
 * Scoped to the whole `stavenote` group, NOT to one `notehead` like articulations are: a
 * chord's dots are spread across EVERY notehead group (VexFlow attaches one Dot per head, drawn
 * inside that head's group), yet they are one model value on the slot. Each registered dot bbox
 * then claims the nearest glyph in the group; a dot sits clear to the right of the head it belongs
 * to, so nearest is unambiguous, and requiring the glyph's centre to fall inside the (slightly
 * grown) bbox keeps a notehead from ever being picked when a dot glyph is missing.
 */
export function paintNoteDots(ctx: HighlightContext, noteId: string, color: string): void {
  const engine = ctx.engine
  const dotElements = engine.getElementRegistry().getByType('dot').filter(el => el.noteId === noteId)
  if (!dotElements.length) return
  const groupInfo = engine.getStaveNoteSVGGroup(noteId)
  if (!groupInfo) return

  const glyphEls = groupInfo.group.querySelectorAll<SVGGraphicsElement>('text')
  for (const dotEl of dotElements) {
    const cx = dotEl.bbox.x + dotEl.bbox.width / 2
    const cy = dotEl.bbox.y + dotEl.bbox.height / 2
    let best: SVGGraphicsElement | null = null
    let bestDist = Infinity
    glyphEls.forEach(svgEl => {
      const bb = svgEl.getBBox?.()
      if (!bb || bb.width === 0 || bb.height === 0) return
      const ex = bb.x + bb.width / 2
      const ey = bb.y + bb.height / 2
      if (Math.abs(ex - cx) > dotEl.bbox.width / 2 + 1.0) return
      if (Math.abs(ey - cy) > dotEl.bbox.height / 2 + 1.0) return
      const dist = (ex - cx) ** 2 + (ey - cy) ** 2
      if (dist < bestDist) { bestDist = dist; best = svgEl }
    })
    if (best) {
      const el = best as SVGGraphicsElement
      ctx.setAttr(el, 'fill', color)
      ctx.setStyleProp(el, 'fill', color)
      ctx.addClass(el, 'selected-dot')
    }
  }
}

/** Highlight the dots selected on the score (a click on any one of them). Paints in the slot's
 *  voice colour, like every other sub-element highlight. */
export function paintSelectedDot(ctx: HighlightContext): void {
  const engine = ctx.engine
  const noteId = selectedOf(ctx.state, 'dot')?.noteId
  if (!noteId) return
  const voice = engine.getNote(noteId)?.voice ?? 0
  paintNoteDots(ctx, noteId, voiceFillColor(voice))
}
