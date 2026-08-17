/**
 * ⭐ **ARROW KEYS RESHAPE THE ARC** — his ask, 2026-08-17: *"i want to be able to change slur control
 * arc point with the arrow key when selected"*. The keyboard twin of dragging a round amber dot, and
 * the last of the three slur handles to get one — the blue TRUE ends have nudged since
 * docs/slur-endpoint-offset-plan.md, the orange OPEN JOINS since the multi-system plan, and the arc's
 * own control points were still mouse-only. Tab (`./slurHandleCycle`) can now reach every handle
 * without the pointer, so this is what makes that reachability worth anything.
 *
 * ## ⭐⭐ THE DRAWN SHAPE IS THE BASELINE, and that is the whole design
 *
 * A slur's `curveShape` override REPLACES the auto arch rather than adding to it (`resolveCps` in
 * `engine/rendering/SlurRenderer`), so a nudge cannot simply accumulate onto the stored value the way
 * an endpoint offset does: with no override yet, "stored + ¼ space" means *¼ space off the auto arch's
 * ZERO*, and the first arrow press would fling the control point down onto the chord line.
 *
 * So the baseline is what the last render actually DREW — the control points the registry carries,
 * inverted back through `renderCurve`'s math ({@link cpsFromDrawnControlPoints}) — which is precisely
 * what a drag does on mousedown. One press therefore reads the arc on screen, moves ONE control point
 * by the delta, and writes both back. Consequences worth naming:
 *
 *  - the FIRST press freezes the auto arch (including any nest lift / obstacle clearance folded into
 *    it) into an explicit shape, exactly as the first pixel of a drag does — same gesture, same
 *    conversion, no second rule;
 *  - a slur with no drawn handles (LINEAR view, where `applySlurHandles` returns early) has nothing
 *    in the registry, so this DECLINES and the arrow key keeps its normal job;
 *  - a cross-system slur nudges the segment whose dot is armed, because the armed dot names its
 *    segment and the segment's own endpoints come off the same registry entry.
 *
 * ⚠️ Deltas arrive in SCREEN space (up = negative dy) but `cps.y` is in ARC space — `drawCurveArc`
 * draws it at `p.y + cps.y · direction` — so the vertical delta is multiplied by `direction` on the
 * way in. Without that, ↑ would raise a slur above the staff and *lower* one below it.
 */
import type { MusicEngine } from '../engine/MusicEngine'
import type { ElementInfo } from '../engine/ElementRegistry'
import type { SlurSegmentAddress } from '../types/music'
import type { EditorState, SlurControlPointHandle } from './EditorState'
import { selectedOf } from './EditorState'
import { dbg } from '../utils/debug'

/** What the nudge and its reset need off the engine — a Pick so a test can stand up the calls alone. */
type ShapeEngine = Pick<MusicEngine,
  'getElementRegistry' | 'previewSlurShape' | 'commitSlurShape'
  | 'resetSlurShape' | 'resetSlurEndpointOffset' | 'resetSlurSegmentEndpointOffset'>

/**
 * Invert `Curve.renderCurve`'s control-point math (the same math `drawCurveArc` uses forward) to
 * recover the **pixel** control-point deltas from the two on-screen control points and the arc's
 * endpoint geometry (the caller converts to staff-spaces before storing). With xShift/yShift = 0 and
 * `cps.length === 2`, `spacing = (p1.x - p0.x) / 4`, `C0 = (p0.x+spacing+cp0.x, p0.y+cp0.y·dir)` and
 * `C1 = (p1.x-spacing+cp1.x, p1.y+cp1.y·dir)`.
 *
 * Shared by the drag (`MouseController.handleSlurHandleMouseDown`) and the keyboard nudge below —
 * one copy, because a second one that drifted would put the mouse and the arrows on different arcs.
 */
export function cpsFromDrawnControlPoints(
  cps: readonly [{ x: number; y: number }, { x: number; y: number }],
  ep: { p0: { x: number; y: number }; p1: { x: number; y: number }; direction: number },
): [{ x: number; y: number }, { x: number; y: number }] {
  const { p0, p1, direction } = ep
  const spacing = (p1.x - p0.x) / 4
  return [
    { x: cps[0].x - p0.x - spacing, y: (cps[0].y - p0.y) * direction },
    { x: cps[1].x - p1.x + spacing, y: (cps[1].y - p1.y) * direction },
  ]
}

/** The drawn handle for one arc dot: matched on the SEGMENT too, since a cross-system slur draws a
 *  pair per system and `cpIndex` alone would find the first system's. The segment comes from the
 *  ARMED dot — a caller addressing `cpIndex` alone (the Properties input) inherits the armed
 *  segment, so it can never write onto a system the user is not looking at. */
function slurHandleEntry(
  handles: readonly ElementInfo[],
  slurId: string,
  cpIndex: 0 | 1,
  armed: SlurControlPointHandle | undefined,
): ElementInfo | undefined {
  return handles.find(el => el.slurId === slurId && el.cpIndex === cpIndex
    && el.segmentRole === armed?.segmentRole && el.segmentOrdinal === armed?.segmentOrdinal)
}

/**
 * What the last render DREW under one arc dot, ready to write back: the pair in **staff-spaces**,
 * the side the slur is bowed, and the address the override needs.
 *
 * ⭐ This is the baseline both editing surfaces share (the header's rule): the arrows add a delta to
 * it, the Properties input replaces one member of it, and both then write the WHOLE pair — because
 * the override is a pair and the auto value of the other dot exists nowhere else.
 */
interface ArcBaseline {
  cps: [{ x: number; y: number }, { x: number; y: number }]
  direction: number
  segment?: SlurSegmentAddress
  spanCount?: number
}

function arcBaseline(
  engine: ShapeEngine,
  slurId: string,
  cpIndex: 0 | 1,
  armed: SlurControlPointHandle | undefined,
): ArcBaseline | null {
  const handle = slurHandleEntry(engine.getElementRegistry().getByType('slur-handle'), slurId, cpIndex, armed)
  // ⛔ No fallback staff-space size. The stored shape is in staff-spaces, so guessing the scale here
  // would write a shape that renders at the wrong height — quietly, and only on the staff that guessed.
  if (!handle?.controlPoints || !handle.slurEndpoints || !handle.staffSpacePx) return null
  const ss = handle.staffSpacePx
  const drawn = cpsFromDrawnControlPoints(handle.controlPoints, handle.slurEndpoints)
  return {
    cps: [{ x: drawn[0].x / ss, y: drawn[0].y / ss }, { x: drawn[1].x / ss, y: drawn[1].y / ss }],
    direction: handle.slurEndpoints.direction,
    // A cross-system slur routes the edit to its segment's own override, keyed by the live span count
    // (the reset signature); a same-line arc passes neither and reshapes the whole `curveShape`.
    segment: handle.segmentRole === undefined ? undefined
      : handle.segmentRole === 'middle' ? { role: 'middle', ordinal: handle.segmentOrdinal ?? 0 }
      : { role: handle.segmentRole },
    spanCount: handle.slurSpanCount,
  }
}

/** The drag's own pair: `preview…` takes the change (and flags the model dirty), `commit…` records
 *  exactly one undo entry for it. A press — or a typed value — is already a whole gesture, so the two
 *  run back to back. */
function writeArc(engine: ShapeEngine, slurId: string, cps: ArcBaseline['cps'], base: ArcBaseline): boolean {
  if (!engine.previewSlurShape(slurId, cps, base.segment, base.spanCount)) return false
  engine.commitSlurShape()
  return true
}

/**
 * Move the armed control point (a round amber dot) by a staff-space delta and record ONE undo entry.
 * `dx`/`dy` are SCREEN deltas — "up lifts the dot" passes a negative `dy` — matching every other
 * nudge wired in `shortcutWiring`.
 *
 * ⚠️ DECLINES — returns false, touching nothing — when no control point is armed, when the armed dot
 * is not on screen (linear view, or a stale selection surviving a re-render that no longer draws it),
 * or when the handle lacks the geometry the conversion needs. Declining is what leaves the arrow keys
 * to their normal job, so the caller must chain rather than repaint on a false.
 *
 * @returns true if the arc was reshaped (the caller then re-renders).
 */
export function nudgeArmedSlurControlPoint(
  state: EditorState,
  engine: ShapeEngine,
  dx: number,
  dy: number,
): boolean {
  const selected = selectedOf(state, 'slur')
  const armed = selected?.controlPoint
  if (!selected || !armed) return false

  const base = arcBaseline(engine, selected.id, armed.cpIndex, armed)
  if (!base) return false
  // Screen → arc space for the vertical (see the header); the horizontal needs no flip, `cps.x` adds
  // straight onto the control point's x whichever side the slur is on.
  const moved = { x: base.cps[armed.cpIndex].x + dx, y: base.cps[armed.cpIndex].y + dy * base.direction }
  const cps: ArcBaseline['cps'] = armed.cpIndex === 0 ? [moved, base.cps[1]] : [base.cps[0], moved]

  if (!writeArc(engine, selected.id, cps, base)) return false
  dbg(`Slur control point nudged | id:${selected.id} cp:${armed.cpIndex} seg:${base.segment?.role ?? 'single'} d:(${dx},${dy})ss`)
  return true
}

/**
 * ⭐ **THE TYPED TWIN OF THE NUDGE** — put one arc control point at an ABSOLUTE value (the Properties
 * panel's inputs, via `bus.slurGeometry`; his ask, 2026-08-17). Same baseline, same write, same one
 * undo entry — only the arithmetic differs: the arrows add, this replaces.
 *
 * ⚠️ `value` is the number the MODEL holds, not a screen position: `x` runs right, and `y` bows the
 * arc OUTWARD (away from the notes) whichever side the slur sits on. That is deliberate — the panel
 * prints the override's own JSON two lines below the input, and a control that disagreed in sign with
 * the dump right under it would be unreadable. The keyboard is the surface that speaks screen.
 *
 * Pass `null` to hand the arc back to the automatic engraving (the whole pair — see
 * {@link resetArmedSlurHandle} for why a single dot cannot go back alone).
 *
 * ⚠️ DECLINES when the addressed dot is not drawn — which on a cross-system slur includes "no dot is
 * armed, so there is no segment to write to".
 */
export function setSlurControlPoint(
  state: EditorState,
  engine: ShapeEngine,
  cpIndex: 0 | 1,
  value: { x?: number; y?: number } | null,
): boolean {
  const selected = selectedOf(state, 'slur')
  if (!selected) return false
  const base = arcBaseline(engine, selected.id, cpIndex, selected.controlPoint)
  if (!base) return false

  if (!value) {
    const ok = engine.resetSlurShape(selected.id, base.segment, base.spanCount)
    if (ok) dbg(`Slur arc reset to auto (Properties) | id:${selected.id} seg:${base.segment?.role ?? 'single'}`)
    return ok
  }
  // An absent axis keeps the DRAWN one, so editing x alone never flattens the arch y was holding.
  const moved = { x: value.x ?? base.cps[cpIndex].x, y: value.y ?? base.cps[cpIndex].y }
  const cps: ArcBaseline['cps'] = cpIndex === 0 ? [moved, base.cps[1]] : [base.cps[0], moved]
  if (!writeArc(engine, selected.id, cps, base)) return false
  dbg(`Slur control point set (Properties) | id:${selected.id} cp:${cpIndex} → (${moved.x},${moved.y})ss`)
  return true
}

/**
 * ⭐ **BACK TO DEFAULT** — Ctrl+Backspace hands the ARMED handle back to the automatic engraving
 * (his ask, 2026-08-17, on finding that only Ctrl+Z would undo a nudge). The reset half of the
 * nudges, on the same key every other nudge in `shortcutWiring` resets with — "one value, a matching
 * backspace per arrow-chord", as `ShortcutConfig` puts it.
 *
 * ⭐⭐ **It resets WHAT IS ARMED, all three kinds**, because that is what the arrows moved. One
 * gesture, three overrides — an amber arc dot drops the shape, a blue square drops that end's nudge,
 * an orange join drops that join's. The three are mutually exclusive in the selection, so the
 * dispatch is a chain and never a choice.
 *
 * ⚠️ **The ARC returns as a WHOLE, both dots** — the one place "the armed handle" is not exactly
 * what goes back. A shape override is ONE pair of control points, and the automatic value of a single
 * dot exists only inside the renderer's arch law (which folds in the span, the slant and any
 * nest/obstacle lift), so the model cannot say "this dot is automatic and that one is not". Normally
 * invisible: the dot you did not touch was written at the value the arch had given it. It shows only
 * if BOTH dots were moved — and then "back to default" honestly means the default arc. The two
 * SQUARE kinds have no such caveat: their offsets are per-side in the model, so exactly the armed
 * square resets. On a cross-system slur the arc reset takes the ARMED SEGMENT only.
 *
 * ⚠️ DECLINES when no handle is armed, or when there is nothing authored to take back, so the key
 * falls through to whatever else it resets.
 */
export function resetArmedSlurHandle(state: EditorState, engine: ShapeEngine): boolean {
  const selected = selectedOf(state, 'slur')
  if (!selected) return false

  if (selected.endpoint) {
    const ok = engine.resetSlurEndpointOffset(selected.id, selected.endpoint)
    if (ok) dbg(`Slur endpoint offset reset | id:${selected.id} end:${selected.endpoint}`)
    return ok
  }

  if (selected.segmentEndpoint) {
    // The span count captured when the join was armed — the override's reset signature, the same
    // value its nudge passes.
    const ok = engine.resetSlurSegmentEndpointOffset(
      selected.id, selected.segmentEndpoint, selected.segmentSpanCount ?? 0,
    )
    if (ok) dbg(`Slur open-join offset reset | id:${selected.id} join:${selected.segmentEndpoint.role}`)
    return ok
  }

  const armed = selected.controlPoint
  if (!armed) return false
  if (armed.segmentRole === undefined) {
    // Same-line arc: the slur's whole shape override IS this arc's.
    const ok = engine.resetSlurShape(selected.id)
    if (ok) dbg(`Slur shape reset to auto | id:${selected.id}`)
    return ok
  }
  // A segment's edit is keyed by the live span count, which only the drawn handle knows.
  const base = arcBaseline(engine, selected.id, armed.cpIndex, armed)
  if (!base?.segment || base.spanCount === undefined) return false
  const ok = engine.resetSlurShape(selected.id, base.segment, base.spanCount)
  if (ok) dbg(`Slur segment shape reset to auto | id:${selected.id} seg:${armed.segmentRole}`)
  return ok
}
