/**
 * A TRILL — the `tr` and its wavy extension. Hit-tested against its drawn BAND, the hairpin's rule
 * and for the hairpin's reason: a trill spanning four bars has a bounding rectangle sitting above
 * all of them, and a press anywhere in that rectangle must not be able to claim the ornament when
 * what the pointer was over was a note.
 *
 * ⚠️ A trill repeated on a continuation system registers ONE ENTRY PER FRAGMENT, each carrying the
 * same trill id. That is what makes either piece clickable, and it is why the search below is a
 * `find` over all of them rather than a lookup: the id is the answer, whichever piece was hit.
 *
 * ⭐ **Unlike the hairpin's, the registered outline is a filled BAND rather than two thin arms** —
 * the ornament really is a solid run of glyphs from the sign to the end of the wiggle — so a press
 * INSIDE it is a hit, not just a press near an edge. `distToSegment` alone would leave the middle of
 * a tall band cold, which is why this tests containment first and proximity second.
 */
import { dbg } from '@/utils/debug'
import type { ClickableElementSpec } from './chain'
import { distToSegment } from './slur'
import { beginTrillBodyDrag } from '../drags/trillBody'
import { spanMarkKeys } from '../spanMarkKeys'
import { selectedOf } from '../EditorState'
import { voiceFillColor } from '@/utils/voiceColors'
import { paintFill } from './recolour'
import { paintEndpointHandles } from './endpointHandles'
import { trillEndpointHandles } from './trillHandles'

/** A few px of grace at the edges — the pad the slur and hairpin already share, for the same
 *  reason: a pointer cannot be aimed to the pixel, and the wiggle is a thin wave inside its band. */
const PAD = 7

export const TRILL_ELEMENT: ClickableElementSpec = {
  kind: 'trill',
  /** Select a trill for edit or removal (hit-tested against its drawn band). */
  hit({ registry, x, y, event }, deps) {
    const trillAt = registry.getByType('trill').find(el => {
      const pts = el.points
      if (!pts || pts.length < 2) return false
      // Inside the band — the ordinary case, since the glyphs fill it.
      const xs = pts.map(p => p.x)
      const ys = pts.map(p => p.y)
      const inside = x >= Math.min(...xs) - PAD && x <= Math.max(...xs) + PAD
        && y >= Math.min(...ys) - PAD && y <= Math.max(...ys) + PAD
      if (inside) return true
      // …and near an edge, for the same grace the other spanners give.
      for (let i = 1; i < pts.length; i++) {
        if (distToSegment(x, y, pts[i - 1], pts[i]) <= PAD) return true
      }
      return false
    }) ?? null
    if (!trillAt?.id) return false

    // ⭐ Click = select; drag = move the WHOLE ornament (his ask, 2026-08-20). ⚠️ The BODY, so
    // nothing is armed by it and nothing needs to be: **something armed → that end, nothing armed →
    // the whole thing** is already the arrows' rule (`nudgeSelectedTrill`), and this is the same
    // sentence with the mouse. A press on one of the SQUARES never reaches here —
    // `armTrillEndpointAt` is a pre-step in `MouseController` and consumes it.
    dbg(`✓ Trill selected | id:${trillAt.id}`)
    return deps.pick(
      { kind: 'trill', id: trillAt.id },
      () => deps.arm(door => beginTrillBodyDrag(door.host, trillAt.id!, x, y), event),
    )
  },

  // Recoloured, and — since 2026-08-17 — the attachment guide to the note it ornaments (the third
  // kind, after the dynamic and the tempo mark). ⭐ A trill's anchor is genuinely a NOTE: its
  // auxiliary is a step above that pitch, so the note is what the ornament is computed from.
  // …and the two endpoint squares, one beyond each end (`./trillHandles`, 2026-08-18) — the
  // family's pair, one look for every span in the editor.
  // ⚠️ The RECOLOUR is `ink` below and not here: a passage box can select this kind too, and the
  // ink has to paint for every selected one — not only for the one a click picked.
  highlight: ctx => {
    ctx.controller.applyAnchorGuideLine()
    const selected = selectedOf(ctx.state, 'trill')
    if (!selected) return
    paintEndpointHandles(ctx, 'trill', selected, trillEndpointHandles(ctx.registry.getByType('trill'), selected.id))
  },
  // ⚠️ **Drawn as TEXT, not as paths** — the `tr` and every wiggle repeat are `<text>` glyphs
  // (`TrillRenderer`) — so `fill` carries the colour and `stroke` would do nothing, silently. Every
  // fragment lives in the SAME group even when the ornament repeats on a later system.
  // ⭐ **A VOICE colour, and the one in this family that should be** (his call, 2026-08-19): *"a
  // trill is always associated to a note, so the trill has the color of the note voice it is
  // anchored to"*. ⚠️ Read off the anchor NOTE, not `Trill.voice` — the field is written at
  // creation and a later voice move does not chase it (the slur's rule).
  ink: (ctx, id) => {
    const group = ctx.engine.getTrillSVGGroup(id)
    if (!group) return
    const trill = ctx.engine.getTrillById(id)
    const anchorVoice = trill ? ctx.engine.getNote(trill.startNoteId)?.voice : undefined
    paintFill(ctx, group.querySelectorAll('text'), voiceFillColor(anchorVoice ?? trill?.voice ?? 0))
  },
  keys: spanMarkKeys('trill'),
}
