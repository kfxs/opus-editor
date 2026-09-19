/**
 * A SUSTAIN PEDAL — `Ped.` and its release `✻`. Hit-tested against the TWO GLYPHS, ⛔ never against
 * the band between them.
 *
 * ⭐⭐ **That is the one thing this module decides, and it is a rule rather than a tuning.** The
 * ottava next door hit-tests its whole drawn band, because a dashed bracket is *mostly* empty and a
 * reader cannot see where the gaps are. A `Ped.✻` pedal is not mostly empty — it is **entirely**
 * empty between its signs, and *a press may only reach INK* (docs/barline-selection.md). A band test
 * here would hand the pedal every press over four bars of music it merely passes over.
 *
 * ⚠️ So there is no proximity half either: `TRILL_ELEMENT` and `OTTAVA_ELEMENT` fall back to
 * distance-to-segment because their ink is a line with holes in it. Every box here is solid glyph,
 * so containment alone is the honest test — and the `PAD` is the family's usual few px of grace at
 * the edges, not a reach into empty space.
 *
 * ⚠️ A pedal registers ONE ENTRY PER DRAWN GLYPH — both signs, plus a `(Ped.)` for every system it
 * resumes on — each carrying the same pedal id. That is why the search below is a `find` over all of
 * them rather than a lookup: the id is the answer, whichever sign was hit (docs/pedal-plan.md §5.3).
 *
 * ⭐ When the bracket style arrives the line becomes ink and the band test becomes the right one — a
 * change here and in `PedalRenderer`, nowhere else.
 *
 * ## ⚠️⚠️ AMENDED, EXPLORATORY (2026-08-30) — the TETHER'S strip is hittable before it is drawn
 *
 * *"first it will be good if i can select the pedal by clickin on the invisible dotted line that
 * later is visible when selected"*. The paragraphs above stay, because what they argue is still
 * true of the PAGE: there is no ink between the signs, and the reason this is defensible is that the
 * strip claimed is not the band — it is the dashed line's own thin row (`./pedalTether.TETHER_HIT`,
 * the same six pixels the drawn line answers a press in), on the pedal's rung below everything the
 * ladder placed. ⛔ Nothing about it is settled: it is one thing to look at, and it trades the
 * fall-through in that row for a target the user says they are already aiming at.
 */
import { dbg } from '@/utils/debug'
import type { ClickableElementSpec } from './chain'
import { pedalTetherAt } from './pedalTether'
import { beginPedalBodyDrag } from '../drags/pedalBody'
import { spanMarkKeys } from '../spanMarkKeys'

/** A few px of grace at the edges — the pad the slur, hairpin, trill and ottava already share. */
const PAD = 7

export const PEDAL_ELEMENT: ClickableElementSpec = {
  kind: 'pedal',
  /** Select a sustain pedal for edit or removal (hit-tested against its drawn SIGNS). */
  hit({ event, registry, x, y }, deps) {
    const pedalAt = registry.getByType('pedal').find(el => {
      const pts = el.points
      if (!pts || pts.length < 2) return false
      const xs = pts.map(p => p.x)
      const ys = pts.map(p => p.y)
      return x >= Math.min(...xs) - PAD && x <= Math.max(...xs) + PAD
        && y >= Math.min(...ys) - PAD && y <= Math.max(...ys) + PAD
    }) ?? null

    // ⭐⭐ **…OR THE DASHED TETHER, WHICH IS INK WHILE IT IS DRAWN** — his ask, 2026-08-21: *"when the
    // pedal is selected, the dashed line should be selectable too for the draging, now is invisible
    // for the click"*. The LINE the selection draws is registered by the highlight pass and removed
    // with it (`'pedal-tether'`), so the selected pedal's own line answers a press for exactly as
    // long as the user can see it.
    //
    // ⭐ It answers the same press as a sign — select, and arm the body drag — because that is what
    // the line is a picture of: the pedal as one object.
    //
    // ⚠️⚠️ **EXPLORATORY (2026-08-30) — …AND SO DOES THE LINE THAT IS NOT DRAWN YET.** His ask:
    // *"first it will be good if i can select the pedal by clickin on the invisible dotted line that
    // later is visible when selected"*. Same strip, same band, one gesture earlier — the geometry is
    // a pure read off the last render (`./pedalTether.pedalTetherAt`), so the press that SELECTS the
    // pedal and the line it then shows cannot be two different answers.
    const id = pedalAt?.id ?? registry.getByType('pedal-tether').find(el => {
      const b = el.bbox
      return x >= b.x - PAD && x <= b.x + b.width + PAD && y >= b.y && y <= b.y + b.height
    })?.pedalId ?? pedalTetherAt(registry.getByType('pedal'), registry, x, y, PAD)
    if (!id) return false

    // ⭐ Click = select; drag = move the WHOLE pedal (his ask, 2026-08-21) — through the music
    // sideways, and DOWN ONTO ANOTHER SYSTEM vertically. ⚠️ The BODY, so nothing is armed by it and
    // nothing needs to be: **something armed → that sign, nothing armed → the pair** is already the
    // arrows' rule (`nudgeSelectedPedal`), and this is the same sentence with the mouse. A press on
    // one of the SQUARES never reaches here — `armPedalEndpointAt` is a pre-step in `MouseController`
    // and consumes it.
    dbg(`✓ Pedal selected | id:${id}`)
    return deps.pick(
      { kind: 'pedal', id },
      () => deps.arm(door => beginPedalBodyDrag(door.host, id, x, y), event),
    )
  },

  // Recoloured, plus the attachment guide (the sixth kind, 2026-08-17). ⭐ It rides the `Ped.` — the
  // sign the gesture begins with — and runs UP to the staff's bottom line: a PLACE, since a pedal
  // governs a region (every voice, every note struck while the damper is down) rather than a pitch.
  //
  // …and the two endpoint squares, one beyond each sign (`./pedalHandles`, 2026-08-18) — the
  // ottava's pair, one look for every span in the editor.
  // ⚠️ The RECOLOUR is not here since 2026-08-19: it moved to the SET pass in `RenderController`
  // (the dynamic's own arrangement), because a passage box can now select this kind too and the
  // ink has to paint for every selected one — not only for the one a click picked.
  // ⚠️ The DASHED TETHER is not here either, and for the recolour's reason: a passage box can hold
  // several pedals, and *which `✻` closes which `Ped.`* is the question it asks hardest (his report,
  // 2026-08-21). It runs in the SET pass beside the recolour — `RenderController.applyHighlights` —
  // and still before this row, so a handle sits over the line rather than under it (`./pedalTether`).
  highlight: h => {
    h.applyAnchorGuideLine()
    h.applyPedalHandles()
  },
  keys: spanMarkKeys('pedal'),
}
