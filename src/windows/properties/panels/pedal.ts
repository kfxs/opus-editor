import { bus } from '@/bus'
import type { InspectedOf } from '@/interactions/inspectedElement'
import type { PedalOffsetOverride } from '@/types/music'
import { scalarOffsetRow } from '../rows'
import { live, overrideOf, type PanelRows } from './panel'

/** A selected PEDAL — the bracket's three numbers, reached by a different road (see below). */
export const pedalRows: PanelRows<'pedal'> = (element) => {
  const id = live(element.data)?.id
  return id ? [buildPedalOffsetRows(id, element)] : []
}

/**
 * ⭐⭐ **A SUSTAIN PEDAL'S INK: two horizontals and ONE vertical.** His ask, 2026-08-18 — the typed
 * twin of the arrows on its two squares, and the bracket's panel above verbatim in shape.
 *
 * ⛔ **Not two point rows**, for a reason that is this family's own rather than the bracket's
 * borrowed: a pedal and its own release share one baseline, so two height boxes could disagree
 * about a quantity the notation has one of (Gould p. 333, the copy in `reference/`). An octave
 * line's single height is geometry — a straight rule cannot tilt; this one is a CONVENTION about
 * how the pair reads, and it is the stronger of the two reasons.
 *
 * ⭐ **0 is the automatic position**, so the boxes show `0` rather than a blank "auto", and `reset`
 * publishes 0 through the same seam — the model's zero-pruning then drops the entry.
 *
 * ⚠️ **`+` is UP in the box and DOWN in the model**, so this is the one line that negates. The
 * bracket's row does the same flip from the other direction (its store is a distance from the
 * staff), which is the point: every offset box in this panel reads *+ is up on screen*, whatever
 * its model happens to store.
 */
function buildPedalOffsetRows(pedalId: string, element: InspectedOf<'pedal'>): HTMLElement {
  const wrap = document.createElement('div')
  wrap.style.margin = '2px 0 4px'
  const off = overrideOf<PedalOffsetOverride>(element, 'pedalOffset')

  wrap.appendChild(scalarOffsetRow(
    'start x (sp)', off?.startX ?? 0,
    'the Ped. sign — + reaches right; the release stays put',
    (x) => bus.pedalGeometry.set({ pedalId, which: 'start', x })))
  wrap.appendChild(scalarOffsetRow(
    'end x (sp)', off?.endX ?? 0,
    'the release ✻ — + reaches right; the Ped. stays put',
    (x) => bus.pedalGeometry.set({ pedalId, which: 'end', x })))
  // ⭐ A negation is its own inverse, so ONE helper converts both ways. ⚠️ `0` is special-cased only
  // to keep `-0` out of the model and off the screen — it is the same number, and nobody wants to
  // read it.
  const flip = (n: number) => (n === 0 ? 0 : -n)
  wrap.appendChild(scalarOffsetRow(
    // ⚠️ Named for the AXIS, not the direction — the bracket's row's rule and his wording.
    'vertical (sp)', flip(off?.y ?? 0),
    'BOTH signs — + moves them UP on screen and − moves them down. One number, because a pedal '
    + 'and its own release share a baseline',
    (up) => bus.pedalGeometry.set({ pedalId, y: flip(up) })))
  return wrap
}
