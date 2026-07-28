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

  // Painted from the SET by `applyArticulationHighlight`, which runs for every press — the element
  // is only the anchor, so being the selected element adds nothing of its own.
  highlight: () => {},
}
