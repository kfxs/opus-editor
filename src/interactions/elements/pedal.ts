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
 */
import { dbg } from '@/utils/debug'
import type { ClickableElementSpec } from './chain'

/** A few px of grace at the edges — the pad the slur, hairpin, trill and ottava already share. */
const PAD = 7

export const PEDAL_ELEMENT: ClickableElementSpec = {
  kind: 'pedal',
  /** Select a sustain pedal for edit or removal (hit-tested against its drawn SIGNS). */
  hit({ registry, x, y }, deps) {
    const pedalAt = registry.getByType('pedal').find(el => {
      const pts = el.points
      if (!pts || pts.length < 2) return false
      const xs = pts.map(p => p.x)
      const ys = pts.map(p => p.y)
      return x >= Math.min(...xs) - PAD && x <= Math.max(...xs) + PAD
        && y >= Math.min(...ys) - PAD && y <= Math.max(...ys) + PAD
    }) ?? null
    if (!pedalAt?.id) return false

    dbg(`✓ Pedal selected | id:${pedalAt.id}`)
    return deps.pick({ kind: 'pedal', id: pedalAt.id })
  },

  // Recoloured, plus the attachment guide (the sixth kind, 2026-08-17). ⭐ It rides the `Ped.` — the
  // sign the gesture begins with — and runs UP to the staff's bottom line: a PLACE, since a pedal
  // governs a region (every voice, every note struck while the damper is down) rather than a pitch.
  highlight: h => { h.applyPedalSelectionHighlight(); h.applyAnchorGuideLine() },
}
