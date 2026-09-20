/**
 * A TUPLET — the bracket and its number.
 *
 * ⚠️ NO chain entry, deliberately. A tuplet press is resolved by a PRE-STEP
 * (`MouseController.handleTupletMouseDown`), which runs BEFORE `selectedElement` is cleared,
 * because pressing a bracket is a gesture that may also start a drag and must keep the existing
 * selection intact through it. It is a kind here for the paint, and for the exhaustiveness that
 * makes a fifteenth kind fail to build.
 */
import type { ElementKindSpec } from './chain'
import type { HighlightContext } from './highlightContext'
import { voiceFillColor } from '@/utils/voiceColors'
import { selectedOf } from '../EditorState'

export const TUPLET_ELEMENT: ElementKindSpec = {
  kind: 'tuplet',
  highlight: paintSelectedTuplet,
}

export function paintSelectedTuplet(ctx: HighlightContext): void {
  const engine = ctx.engine
  const tupletId = selectedOf(ctx.state, 'tuplet')?.id
  if (!tupletId) return

  // Recolor inside the tuplet's OWN group only — never a document-wide region — so it
  // cannot bleed onto a neighbouring system (the old bbox scan did exactly that).
  // The group holds the bracket (thin filled <rect>s), the number (<text>), and a
  // transparent pointer-rect hit-area (opacity 0 — leave it alone).
  const group = engine.getTupletSVGGroup(tupletId)
  if (!group) return


  // Float the selected tuplet to the front of its siblings. Two voices' tuplets can
  // sit at the exact same pixels (e.g. a flipped voice-2 bracket landing on top of
  // voice 1); whichever is drawn last wins, so without this the unselected bracket
  // would paint over the recoloured one and the selection would be invisible.
  ctx.raiseToFront(group)

  // Paint in the tuplet's own voice colour, matching note/cursor selection.
  const SELECTION_COLOR = voiceFillColor(engine.getTupletVoice(tupletId))

  // Bracket segments: thin rects (1px in one dimension). Skip the full-size pointer
  // hit-area, which spans the whole tuplet bbox.
  group.querySelectorAll('rect').forEach(rect => {
    const w = rect.width.baseVal.value
    const h = rect.height.baseVal.value
    if (w <= 2 || h <= 2) {
      ctx.setAttr(rect, 'fill', SELECTION_COLOR)
      ctx.setStyleProp(rect, 'fill', SELECTION_COLOR)
      ctx.addClass(rect, 'selected-tuplet')
    }
  })

  // The tuplet number (e.g. "3").
  group.querySelectorAll('text').forEach(text => {
    ctx.setAttr(text, 'fill', SELECTION_COLOR)
    ctx.setStyleProp(text, 'fill', SELECTION_COLOR)
    ctx.addClass(text, 'selected-tuplet')
  })
}
