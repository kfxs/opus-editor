/**
 * ⭐ **A SELECTED HAIRPIN'S TWO ENDPOINT HANDLES** — where they sit, how a press picks one, and the
 * order Tab walks them. His ask in two steps, 2026-08-17: *"when i select a hairpin i want to see two
 * endpoints, one in the beginning one in the end… for the moment we don't do anything with the
 * endpoints, let's just draw them"*, then *"make the squares selectable with the mouse, and also the
 * navigation with the tab"*.
 *
 * ⛔ **PICKING ONLY — an armed end still does nothing.** There is no drag, no nudge and no override
 * behind it yet: a hairpin's extent is MUSICAL (`Ctrl+←/→` rewrites `length` on the model,
 * docs/dynamics-line-and-hairpins-plan.md §4), so unlike a slur's blue squares there is nothing
 * cosmetic to move. What exists is the SELECTION — `selectedElement.hairpin.endpoint` — and the
 * routes to it, which is what any later edit will read.
 *
 * ⭐ **One module for all three questions**, because they are one answer read three ways: the walk
 * order IS the drawn order, and the hit is the same two boxes. The slur's equivalents are split
 * across `HighlightController` (draw), `MouseController` (press) and `slurHandleCycle` (Tab) for
 * historical reasons; this is what that would look like filed by the thing rather than by the
 * mechanism (CLAUDE.md's "a new feature adds a MODULE").
 *
 * ## The arithmetic
 *
 * `HairpinRenderer` registers ONE ENTRY PER FRAGMENT under the hairpin's id, each carrying the drawn
 * outline as four `points` — top arm start, top arm end, bottom arm end, bottom arm start. So:
 *
 *  - the **beginning** handle is the FIRST fragment's left edge, at the midpoint between its two
 *    arms — i.e. on the wedge's axis, where the tip is on a crescendo and the mouth is on a
 *    diminuendo. A corner would sit on one arm and read as belonging to it;
 *  - the **end** handle is the LAST fragment's right edge, the same way.
 *
 * ⚠️ **The two ends come from DIFFERENT entries on a split wedge**, and that is the whole reason this
 * is a function rather than two array indexes: a hairpin cut across a system break has its beginning
 * in one system's coordinates and its end in another's. Reading both from one entry draws the second
 * square in the wrong system — the same trap the attachment guide has (`guides` ride the FIRST
 * fragment only) and the one `slurHandleCycle` names for slur handles.
 */
import type { ElementInfo, ElementRegistry } from '../../engine/ElementRegistry'
import type { EditorState } from '../EditorState'
import { selectedOf } from '../EditorState'
import { dbg } from '../../utils/debug'

/** One drawn handle: a point, and which end of the span it is. */
export interface HairpinHandle {
  which: 'start' | 'end'
  x: number
  y: number
}

/**
 * ⭐ **HOW FAR OUTSIDE THE WEDGE EACH SQUARE SITS** — his correction, 2026-08-17: *"the squares are
 * too close to the hairpin… so it is easy to see the form of the hairpin and this don't overlap"*.
 * The beginning steps LEFT and the end steps RIGHT, i.e. both step outward along the span, so the
 * wedge's own shape — the thing being selected — is never under a square.
 *
 * The number is the handle's half-side (6 px, `SLUR_HANDLE_R + 1`) plus a few px of air, so the
 * square's inner edge clears the tip rather than merely missing its centre. ⚠️ PIXELS, like every
 * other handle in the editor: these are drawn on the highlight layer at a constant on-screen size,
 * so a square stays the same size to the hand at every zoom (⛔ not the rule for a DOM text overlay,
 * which sizes itself relative to its own box — different layer, different problem).
 */
export const HAIRPIN_HANDLE_GAP_PX = 10

/** The midpoint of a fragment's two arms at one side — the wedge's axis there — stepped `gap` px
 *  outward along the span so the square sits beside the ink instead of on it. */
function axisAt(
  points: { x: number; y: number }[],
  top: number,
  bottom: number,
  gap: number,
): { x: number; y: number } {
  return { x: points[top].x + gap, y: (points[top].y + points[bottom].y) / 2 }
}

/**
 * The two endpoint handles of `hairpinId`, from what the last render DREW (the registry is the list —
 * the same rule the slur's handles follow). Returns an empty array when the wedge is not on screen,
 * and drops a fragment whose outline is missing rather than guessing at a position.
 */
export function hairpinEndpointHandles(
  entries: readonly ElementInfo[],
  hairpinId: string,
): HairpinHandle[] {
  const pieces = entries.filter(el => el.id === hairpinId && (el.points?.length ?? 0) >= 4)
  if (!pieces.length) return []
  // Registration order IS drawing order, which is left to right through the systems — so the first
  // piece holds the beginning and the last holds the end (one piece holds both).
  const first = pieces[0].points!
  const last = pieces[pieces.length - 1].points!
  return [
    { which: 'start', ...axisAt(first, 0, 3, -HAIRPIN_HANDLE_GAP_PX) },
    { which: 'end', ...axisAt(last, 1, 2, HAIRPIN_HANDLE_GAP_PX) },
  ]
}

/**
 * ⭐ **A PRESS ON A SQUARE ARMS THAT END** — the mouse route, run as a PRE-STEP in
 * `MouseController` before the selection is cleared and before the hit chain, exactly where the
 * slur's handle press runs.
 *
 * ⚠️ **Before the chain, not a row in it**, and the reason is a real overlap rather than symmetry
 * with the slur: a hairpin shares the dynamics line with the `p` or `f` at its mouth, so a square
 * can land inside a dynamic's box — and `DYNAMIC_ELEMENT` sits ahead of `HAIRPIN_ELEMENT` in
 * {@link ELEMENT_HIT_ORDER}. A handle you can SEE has to win the press over the glyph it happens to
 * sit on, and a chain row could not promise that without reordering the marks themselves.
 *
 * The squares are only in the registry while their hairpin is selected (the highlight pass puts them
 * there), so no guard for "is this hairpin selected" is needed — nothing else can be hit.
 *
 * @returns true if a square consumed the press (the caller then re-renders and stops).
 */
export function armHairpinEndpointAt(
  state: EditorState,
  registry: ElementRegistry,
  x: number,
  y: number,
): boolean {
  const hit = registry.getByType('hairpin-endpoint').find(el => {
    const b = el.bbox
    return x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height
  })
  if (!hit?.hairpinId || !hit.endpoint) return false
  // ⚠️ Reassigned whole — the observable Proxy traps the SET, so mutating `.endpoint` in place would
  // change the value and tell nobody.
  state.selectedElement = { kind: 'hairpin', id: hit.hairpinId, endpoint: hit.endpoint }
  dbg(`✓ Hairpin endpoint armed | id:${hit.hairpinId} end:${hit.endpoint}`)
  return true
}

/**
 * ⭐ **TAB WALKS THE TWO SQUARES** — `+1` Tab, `−1` Shift+Tab — the keyboard route to the same
 * selection, and the hairpin's half of what `slurHandleCycle` does for a slur.
 *
 * The REGISTRY IS THE LIST, that module's rule and for its reasons: the walk visits what the last
 * render actually DREW, so a hairpin whose squares are not on screen has none to visit and Tab stays
 * the browser's. With none armed, Tab takes the FIRST and Shift+Tab the LAST, so either key is a way
 * in; the walk WRAPS.
 *
 * ⚠️ DECLINES (false) when no hairpin is selected or its squares are not drawn — the caller chains
 * rather than repaints on a false.
 */
export function cycleHairpinEndpoint(
  state: EditorState,
  registry: ElementRegistry,
  step: 1 | -1,
): boolean {
  const selected = selectedOf(state, 'hairpin')
  if (!selected) return false
  const order = hairpinEndpointHandles(registry.getByType('hairpin'), selected.id)
  if (!order.length) return false

  const at = order.findIndex(h => h.which === selected.endpoint)
  const next = at === -1
    ? (step === 1 ? 0 : order.length - 1)
    : (at + step + order.length) % order.length
  state.selectedElement = { kind: 'hairpin', id: selected.id, endpoint: order[next].which }
  return true
}
