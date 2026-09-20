/**
 * An ARTICULATION — accent, staccato, tenuto … , selected as the whole GROUP on its note.
 *
 * ⚠️ THE ONE EXCEPTION in the chain. Every other kind ends in the shared tail (clear the note
 * selection, become the one selected element); this one calls `selectArticulation`, which SELECTS
 * the note's whole articulation group Sibelius-style — a set, not a clear. So it has its own tail,
 * and `pickArticulationGroup` is why {@link ElementChainDeps} has two of them.
 */
import { dbg } from '@/utils/debug'
import type { ElementInfo, ElementRegistry } from '@/engine/ElementRegistry'
import type { ClickableElementSpec } from './chain'
import type { HighlightContext } from './highlightContext'
import { selectedOf } from '../state/EditorState'
import { voiceFillColor } from '@/utils/voiceColors'

/**
 * The articulation under the cursor, or null when the NOTE should keep the press.
 *
 * ⚠️ Shared with the Ctrl-click multi-select pre-step in `MouseController`, which toggles whole
 * articulation groups into the selection — the two must agree about what "on an articulation"
 * means, so there is one test.
 *
 * An articulation glyph sits right against its note head, and the padded bbox can cover the head
 * too — so a click aimed at the note would be "stolen" by the articulation. We only take the
 * articulation when the click is genuinely closer to the glyph than to the nearest note/rest;
 * otherwise the caller falls through to note selection.
 */
export function articulationHit(
  x: number, y: number, closestElement: ElementInfo | null, registry: ElementRegistry,
): ElementInfo | null {
  const artPad = 8
  const articulationAt = registry.getByType('articulation').find(el => {
    const b = el.bbox
    return x >= b.x - artPad && x <= b.x + b.width + artPad && y >= b.y - artPad && y <= b.y + b.height + artPad
  }) ?? null
  if (!articulationAt?.noteId) return null
  const artCx = articulationAt.bbox.x + articulationAt.bbox.width / 2
  const artCy = articulationAt.bbox.y + articulationAt.bbox.height / 2
  const artDist = Math.sqrt((x - artCx) ** 2 + (y - artCy) ** 2)
  const noteDist = closestElement && closestElement.id
    ? registry.noteOrRestHitDistance(closestElement, x, y)
    : Infinity
  if (artDist <= noteDist) return articulationAt
  dbg(`· Articulation skipped — note closer (artDist:${artDist.toFixed(1)} > noteDist:${noteDist.toFixed(1)})`)
  return null
}

export const ARTICULATION_ELEMENT: ClickableElementSpec = {
  kind: 'articulation',
  /** Select a whole articulation group (Sibelius-style) on the clicked note. */
  hit({ registry, x, y, closestElement }, deps) {
    const articulationAt = articulationHit(x, y, closestElement, registry)
    if (!articulationAt?.noteId) return false

    // Sibelius-style: clicking any articulation selects the whole group on that
    // note (all its articulations), not just the clicked glyph.
    dbg(`✓ Articulation group selected | noteId:${articulationAt.noteId} (clicked:${articulationAt.articulationType})`)
    return deps.pickArticulationGroup(articulationAt.noteId)
  },

  // Painted from the SET by `paintSelectedArticulations` below, which runs for every press — the element
  // is only the anchor, so being the selected element adds nothing of its own.
  highlight: () => {},
}

export function paintSelectedArticulations(ctx: HighlightContext): void {
  const engine = ctx.engine

  // Selected articulation groups live in the multi-select set (Ctrl-click adds more);
  // fall back to the element ANCHOR for safety. Each group covers EVERY articulation on
  // its note (Sibelius-style), so highlight all of them, each in its note's voice colour.
  const selectedNoteIds = new Set<string>()
  for (const item of ctx.state.selectedItems.values()) {
    if (item.kind === 'articulation') selectedNoteIds.add(item.noteId)
  }
  const anchor = selectedOf(ctx.state, 'articulation')?.noteId
  if (anchor) selectedNoteIds.add(anchor)

  for (const noteId of selectedNoteIds) {
    const voice = engine.getNote(noteId)?.voice ?? 0
    paintNoteArticulations(ctx, noteId, voiceFillColor(voice))
  }
}

/**
 * Colour every articulation glyph on `noteId` in `color`. Shared by the articulation-GROUP
 * highlight ({@link paintSelectedArticulations}) and the selected-NOTE highlight
 * ({@link paintNote}), so a note reads as fully selected (head + stem + accidental +
 * articulations). Uses the logged setAttr so `clearHighlights` reverts it.
 *
 * KEY DOM FACT: VexFlow renders a note's articulation glyphs INSIDE that note's own
 * `notehead` group — NoteHead.draw() opens the group, draws the head, then calls
 * stavenote.drawModifiers(this) before closing it. So an articulation lives at
 * `stavenote > notehead[noteIndex] > <text>`, scoped to the very note it belongs to;
 * searching ONLY within that notehead sub-group avoids grabbing a stacked voice's glyph (a
 * document-wide nearest-glyph scan was the old bug). Within the group, the notehead glyph is
 * drawn FIRST (skip index 0); geometry then picks the glyph whose centre is closest to the
 * registered articulation bbox — robust for a note carrying several stacked marks.
 */
export function paintNoteArticulations(ctx: HighlightContext, noteId: string, color: string): void {
  const engine = ctx.engine
  const artElements = engine.getElementRegistry().getByType('articulation').filter(el => el.noteId === noteId)
  if (!artElements.length) return

  // ⭐ A FANNED MEMBER's marks are not in a `notehead` at all — VexFlow never drew that head, so
  // `FanPass` paints the whole member (head, sign, ledgers, stem AND its articulations) into its
  // own `fanhead` group. Same search, one group over; without this a member's mark was drawn
  // and registered and selectable but never lit up.
  const memberGroup = engine.getFanMemberSVGGroup(noteId)?.group
  let scope: Element | null = memberGroup ?? null
  if (!scope) {
    const groupInfo = engine.getStaveNoteSVGGroup(noteId)
    if (!groupInfo) return
    const noteheadGroups = groupInfo.group.querySelectorAll('g.notehead')
    scope = noteheadGroups[groupInfo.noteIndex] ?? noteheadGroups[0] ?? null
  }
  if (!scope) return

  const glyphEls = scope.querySelectorAll<SVGGraphicsElement>('text, path')
  // In a `notehead` the head is drawn FIRST and is skipped by index; a member's group has its
  // ledgers before the head, so there is no fixed index to skip and the nearest-centre match below
  // does the work on its own (a mark sits a staff space clear of the head it belongs to).
  const skipFirst = !memberGroup
  for (const artEl of artElements) {
    const cx = artEl.bbox.x + artEl.bbox.width / 2
    const cy = artEl.bbox.y + artEl.bbox.height / 2
    let best: SVGGraphicsElement | null = null
    let bestDist = Infinity
    glyphEls.forEach((svgEl, i) => {
      if (skipFirst && i === 0) return // the notehead glyph itself
      const bb = svgEl.getBBox?.()
      if (!bb || bb.width === 0 || bb.height === 0) return
      const dx = bb.x + bb.width / 2 - cx
      const dy = bb.y + bb.height / 2 - cy
      const dist = dx * dx + dy * dy
      if (dist < bestDist) { bestDist = dist; best = svgEl }
    })
    if (best) {
      const el = best as SVGGraphicsElement
      ctx.setAttr(el, 'fill', color)
      ctx.setStyleProp(el, 'fill', color)
      ctx.addClass(el, 'selected-articulation')
    }
  }
}
