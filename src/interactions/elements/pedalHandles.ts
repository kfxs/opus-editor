/**
 * ⭐ **A SELECTED PEDAL'S TWO ENDPOINT HANDLES** — one beyond the `Ped.`, one beyond the `✻`, and
 * how a press or Tab picks one. His ask, 2026-08-18: *"now i will want to add the square endpoints
 * to the pedal"*, the fourth span family to get them after the slur, the hairpin and the ottava.
 *
 * ⭐ **`./ottavaHandles`' twin, deliberately down to the shape of the file** — the same two squares
 * in the same blue at the same size, the same walk, the same registry-is-the-list rule. Four span
 * families with four different-looking answers to "where is my end" would be four things for the
 * hand to learn; one look and one gesture is the whole reason this is a copy rather than a
 * variation.
 *
 * ⭐ **What they ARM, they then EDIT** — `Ctrl+Shift+←/→` moves that end through the music (the
 * right square the LIFT, the left one the press, holding the other), the plain arrows nudge its ink,
 * and dragging a square does BOTH at once. ⚠️ **All of that lives in `../pedalWalk`, ⛔ none of it
 * here** — this file finds the squares and arms one. The drag's own answer to *"which address is the
 * cursor over"* was here until 2026-08-21 (`pedalDragTargetAt`, with the measured sign-to-music y it
 * needed to tell one system from another); the walk replaced it, and reads no `y` at all.
 *
 * ## ⭐⭐ The one thing that is genuinely this family's own: THE GRAIN IS THE GLYPH
 *
 * Every other span here registers one box per drawn FRAGMENT, so its two ends are two coordinates of
 * one entry (or of two, across a system break). A pedal registers one box per drawn SIGN — there is
 * no ink at all between `Ped.` and `✻`, so a fragment-wide box would claim every press over the
 * music it merely passes over ({@link ElementInfo} `'pedal'`). So the two squares here come from
 * **two different MARKS**, named by {@link ElementInfo.pedalSign}.
 *
 * ⛔ **Never "the first entry and the last one".** That happens to be true today and is not a fact
 * about pedals: a `(Ped.)` resumption is registered too, and a final fragment can be dropped by the
 * cutter when a lift lands a hair inside a new system — which is exactly the case that would put the
 * end square on a sign that is not the release. The sign says what it is; nothing here counts.
 *
 * ⭐ **And no measured axis field, unlike the bracket's.** `ottavaAxis` exists because an ottava's
 * `points` are the numeral's ink box while its line rides that box's top or foot. A pedal's boxes
 * ARE its ink, one per glyph, so the square sits on the box's own middle and there is nothing to
 * re-derive.
 */
import type { ElementInfo, ElementRegistry } from '../../engine/ElementRegistry'
import type { EditorState } from '../EditorState'
import { selectedOf } from '../EditorState'
import { dbg } from '../../utils/debug'

/** One drawn handle: a point, and which end of the pedal it is. */
export interface PedalHandle {
  which: 'start' | 'end'
  x: number
  y: number
}

/**
 * ⭐ **THE AIR — how far outside the pedal's signs each square sits**, in px.
 *
 * The requirement that came with the handles themselves on the ottava (*"we need air … for avoiding
 * collision"*) and it is sharper here than anywhere: the two things a square could cover are the
 * `Ped.` and the `✻`, which is the ENTIRE mark. A pedal has no line, no hook and no wedge to fall
 * back on, so a square sitting on a sign hides one half of the statement outright.
 *
 * ⚠️ Its own constant rather than an import of the ottava's or the hairpin's, so the three can be
 * tuned apart. It STARTS at their 10 — the square's half-side, 6, plus a few px — because that is a
 * value his eye has already passed twice.
 *
 * ⚠️ PIXELS, like every other handle in the editor: the squares are drawn on the highlight layer at
 * a constant on-screen size, so one stays the same size to the hand at every zoom.
 */
export const PEDAL_HANDLE_GAP_PX = 10

/**
 * The endpoint handles of `pedalId`, from what the last render DREW (the registry is the list —
 * every handle family in the editor follows that rule).
 *
 * ⭐ The start square steps LEFT of the `Ped.`'s left edge and the end square RIGHT of the `✻`'s
 * right edge, so both step OUTWARD along the span and neither is over ink. ⚠️ The `✻` is
 * RIGHT-aligned on the lift x (`PedalRenderer` — that alignment is what keeps its ink inside the
 * barline), so the end square lands just past the lift itself: the same place the ottava's does, by
 * a different route.
 *
 * ⭐ **The start square rides the FIRST `Ped.`, never a `(Ped.)` resumption** — a resumed sign is a
 * reminder that the damper is still down, not a second beginning. That is the attachment guide's own
 * rule (`PedalRenderer`, first fragment only), and it comes out of the same reading.
 *
 * ⚠️ Returns ONE handle when the release was not drawn, and an empty array when nothing was — ⛔ it
 * never invents the missing end from the sign it does have. Two squares on one `Ped.` would say the
 * pedal both begins and ends there.
 */
export function pedalEndpointHandles(
  entries: readonly ElementInfo[],
  pedalId: string,
): PedalHandle[] {
  const signs = entries.filter(el => el.id === pedalId && el.pedalSign)
  // Registration order IS drawing order — the first `Ped.` is the press; every later one is a
  // resumption (see above). The release is named, not counted.
  const down = signs.find(el => el.pedalSign === 'down')
  const up = signs.find(el => el.pedalSign === 'up')

  const handles: PedalHandle[] = []
  if (down) {
    handles.push({
      which: 'start',
      x: down.bbox.x - PEDAL_HANDLE_GAP_PX,
      y: down.bbox.y + down.bbox.height / 2,
    })
  }
  if (up) {
    handles.push({
      which: 'end',
      x: up.bbox.x + up.bbox.width + PEDAL_HANDLE_GAP_PX,
      y: up.bbox.y + up.bbox.height / 2,
    })
  }
  return handles
}

/**
 * ⭐ **A PRESS ON A SQUARE ARMS THAT END** — run as a PRE-STEP in `MouseController`, before the
 * selection is cleared and before the hit chain, exactly where the hairpin's, the slur's and the
 * ottava's handle presses run.
 *
 * ⚠️ **Before the chain, not a row in it**, and the pedal has the strongest case of the four: it is
 * the OUTERMOST below-staff family, so its squares sit beyond everything the ladder placed inside it
 * — a square can land inside a dynamic's, a hairpin's, a trill's or an octave line's box, and every
 * one of those runs ahead of `PEDAL_ELEMENT` in {@link ELEMENT_HIT_ORDER}. A handle you can SEE has
 * to win the press over whatever it happens to overlap, and no ordering of the marks themselves
 * could promise that.
 *
 * The squares are only in the registry while their pedal is selected (the highlight pass puts them
 * there), so no "is this pedal selected" guard is needed — nothing else can be hit.
 *
 * @returns true if a square consumed the press (the caller then re-renders and stops).
 */
export function armPedalEndpointAt(
  state: EditorState,
  registry: ElementRegistry,
  x: number,
  y: number,
): boolean {
  const hit = registry.getByType('pedal-endpoint').find(el => {
    const b = el.bbox
    return x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height
  })
  if (!hit?.pedalId || !hit.endpoint) return false
  // ⚠️ Reassigned whole — the observable Proxy traps the SET, so mutating `.endpoint` in place would
  // change the value and tell nobody.
  state.selectedElement = { kind: 'pedal', id: hit.pedalId, endpoint: hit.endpoint }
  dbg(`✓ Pedal endpoint armed | id:${hit.pedalId} end:${hit.endpoint}`)
  return true
}

/**
 * ⭐ **TAB WALKS THE SQUARES** — `+1` Tab, `−1` Shift+Tab — the keyboard route to the same
 * selection, and the pedal's share of what `slurHandleCycle`, `cycleHairpinEndpoint` and
 * `cycleOttavaEndpoint` do.
 *
 * The REGISTRY IS THE LIST: the walk visits what the last render actually DREW, so a pedal whose
 * squares are not on screen has none to visit and Tab stays the browser's. With none armed, Tab
 * takes the FIRST and Shift+Tab the LAST, so either key is a way in; the walk WRAPS.
 *
 * ⚠️ It walks ONE stop rather than two when the release was not drawn — {@link
 * pedalEndpointHandles}' case, and the wrap arithmetic already answers it.
 *
 * ⚠️ DECLINES (false) when no pedal is selected or its squares are not drawn — the caller chains
 * rather than repaints on a false.
 */
export function cyclePedalEndpoint(
  state: EditorState,
  registry: ElementRegistry,
  step: 1 | -1,
): boolean {
  const selected = selectedOf(state, 'pedal')
  if (!selected) return false
  const order = pedalEndpointHandles(registry.getByType('pedal'), selected.id)
  if (!order.length) return false

  const at = order.findIndex(h => h.which === selected.endpoint)
  const next = at === -1
    ? (step === 1 ? 0 : order.length - 1)
    : (at + step + order.length) % order.length
  state.selectedElement = { kind: 'pedal', id: selected.id, endpoint: order[next].which }
  return true
}
