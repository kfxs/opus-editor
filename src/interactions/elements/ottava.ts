/**
 * An OTTAVA — the octave numeral and its dashed bracket. Hit-tested against its drawn BAND, the
 * trill's rule and for the trill's reason: an octave line spanning four bars has a bounding
 * rectangle sitting above all of them, and a press anywhere in that rectangle must not be able to
 * claim the line when what the pointer was over was a note.
 *
 * ⚠️ A line crossing a system break registers ONE ENTRY PER FRAGMENT, each carrying the same ottava
 * id. That is what makes either piece clickable, and it is why the search below is a `find` over all
 * of them rather than a lookup: the id is the answer, whichever piece was hit.
 *
 * ⭐ Containment first, proximity second — {@link TRILL_ELEMENT}'s arrangement, and here it matters
 * a little more: the bracket's ink is a numeral and a DASHED line, so most of the band is literally
 * empty. A test that only measured distance to the drawn ink would make the gaps between dashes
 * cold, and the reader has no way to know where they are.
 */
import { dbg } from '@/utils/debug'
import type { ClickableElementSpec } from './chain'
import { paintAnchorGuideLine } from './anchorGuideLine'
import { distToSegment } from './slur'
import { beginOttavaBodyDrag } from '../drags/ottavaBody'
import { spanMarkKeys } from '../stamps/spanMarkKeys'
import { selectedOf } from '../state/EditorState'
import { ELEMENT_SELECTION_FILL } from '@/utils/selectionColors'
import { paintFill, paintStroke } from './recolour'
import { paintEndpointHandles } from './endpointHandles'
import { ottavaEndpointHandles } from './ottavaHandles'

/** A few px of grace at the edges — the pad the slur, hairpin and trill already share. */
const PAD = 7

export const OTTAVA_ELEMENT: ClickableElementSpec = {
  kind: 'ottava',
  /** Select an octave line for edit or removal (hit-tested against its drawn band). */
  hit({ event, registry, x, y }, deps) {
    const ottavaAt = registry.getByType('ottava').find(el => {
      const pts = el.points
      if (!pts || pts.length < 2) return false
      const xs = pts.map(p => p.x)
      const ys = pts.map(p => p.y)
      const inside = x >= Math.min(...xs) - PAD && x <= Math.max(...xs) + PAD
        && y >= Math.min(...ys) - PAD && y <= Math.max(...ys) + PAD
      if (inside) return true
      for (let i = 1; i < pts.length; i++) {
        if (distToSegment(x, y, pts[i - 1], pts[i]) <= PAD) return true
      }
      return false
    }) ?? null
    if (!ottavaAt?.id) return false

    // ⭐ Click = select; drag = move the WHOLE bracket (his ask, 2026-08-21) — through the music
    // sideways, and DOWN ONTO ANOTHER SYSTEM vertically. ⚠️ The BODY, so nothing is armed by it and
    // nothing needs to be: **something armed → that end, nothing armed → the whole thing** is already
    // the arrows' rule (`nudgeSelectedOttava`), and this is the same sentence with the mouse. A press
    // on one of the SQUARES never reaches here — `armOttavaEndpointAt` is a pre-step in
    // `MouseController` and consumes it.
    dbg(`✓ Ottava selected | id:${ottavaAt.id}`)
    return deps.pick(
      { kind: 'ottava', id: ottavaAt.id },
      () => deps.arm(door => beginOttavaBodyDrag(door.host, ottavaAt.id!, x, y), event),
    )
  },

  // Recoloured, plus the attachment guide (the fifth kind, 2026-08-17). ⭐ At the bracket's BEGINNING
  // only, and to a PLACE rather than a note — an octave line governs a region, so it belongs to no
  // single pitch. Its side follows the shift, like everything else about the bracket.
  // …and the two endpoint squares, one beyond each end (`./ottavaHandles`) — the hairpin's pair.
  // ⚠️ The RECOLOUR is `ink` below and not here: a passage box can select this kind too, and the
  // ink has to paint for every selected one — not only for the one a click picked.
  highlight: ctx => {
    paintAnchorGuideLine(ctx)
    const selected = selectedOf(ctx.state, 'ottava')
    if (!selected) return
    paintEndpointHandles(ctx, 'ottava', selected, ottavaEndpointHandles(ctx.registry.getByType('ottava'), selected.id))
  },
  // ⭐ **The one mark drawn in BOTH kinds of ink**: the numeral (and its continuation parens) are
  // `<text>` that must be FILLED, the dashed line and the hook are `<path>`s that must be STROKED.
  // ⭐ The ELEMENT ink, not a voice's (his call, 2026-08-19): an ottava HAS no voice — it governs the
  // staff, whose music may be in any of them (`Ottava.staffId`). See `utils/selectionColors`.
  ink: (ctx, id) => {
    const group = ctx.engine.getOttavaSVGGroup(id)
    if (!group) return
    paintFill(ctx, group.querySelectorAll('text'), ELEMENT_SELECTION_FILL)
    paintStroke(ctx, group.querySelectorAll('path'), ELEMENT_SELECTION_FILL)
  },
  keys: spanMarkKeys('ottava'),
}
