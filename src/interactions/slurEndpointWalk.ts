/**
 * ⭐⭐ **THE INTERPOLATING ENDPOINT WALK** — ←/→ and Ctrl+←/→ move an armed slur endpoint's INK, and
 * once that ink reaches the next note the ANCHOR goes with it. His ask, 2026-08-18: *"first i start
 * offseting till i get to the critical point so it makes a reanchor… lets start just horizontal in
 * the x axis"*.
 *
 * Before this, the two halves of moving an endpoint were two unrelated gestures: `Ctrl+←/→` wrote a
 * cosmetic offset that could slide the ink arbitrarily far from the note it claimed to hang off, and
 * `Ctrl+Shift+←/→` (`./slurReanchor`) jumped the anchor a whole note with the ink snapping to
 * wherever the engraver puts it. Neither could express "this end belongs a little to the left of
 * that note over there" as one continuous motion.
 *
 * ## The identity
 *
 * A drawn endpoint is `base(anchor) + offset`. A press moves the drawn point by one step, and the
 * model is free to split that between the two terms however it likes. So:
 *
 * ```
 *   offset + step  <  gap   →  keep the anchor, offset += step        (ordinary ink nudge)
 *   offset + step  ≥  gap   →  anchor := next note, offset += step − gap
 * ```
 *
 * where `gap` is the horizontal distance between the two anchor NOTES. Both branches move the drawn
 * point by exactly one step, so **the crossing is invisible** — which is the point, and was his call
 * when asked (2026-08-18): keep the vertical nudge and the hand-tuned arc through the flip, since
 * *"probably reset it can be strange"*. The offset also re-zeroes itself at every note it passes, so
 * holding an arrow reads as one continuous glide with the anchor stepping along underneath, and
 * nothing accumulates into an absurd stored number.
 *
 * ⭐ **ARRIVAL, not midpoint.** The anchor changes when the ink gets *to* the next note, not when it
 * passes the halfway mark, so an endpoint can be parked anywhere in the gap without changing what
 * the slur spans (and so what it PLAYS — `utils/slurs.legatoChordIds` extends the notes a slur
 * covers). MuseScore's line family re-anchors at the halfway point instead (`spacingFactor = 0.5`);
 * it is one comparison below if that turns out to feel better in the hand.
 *
 * ⚠️ **`gap` is a NOTE-to-NOTE distance, not an endpoint-to-endpoint one.** The drawn base of an
 * endpoint sits on the head or at the stem tip depending on both ends' stems (`SlurRenderer` §12
 * phase 7), so the exact re-base would need the new anchor's base — which only exists after a
 * layout. Measuring it would cost an extra render per crossing press; instead this uses the note
 * delta, which is what MuseScore's lines do (`line.cpp:750-754`,
 * `m_offset2 += noteOld->canvasPos() - noteNew->canvasPos()`). The two agree except where the two
 * notes attach differently — a stem-direction flip between them — and there the ink lands at the
 * same position *relative to its new notehead*, which is the reading a user would want anyway.
 *
 * 🚨 **It will not walk across a system break.** Two x's from different systems are not on one
 * ruler, so a `gap` whose sign disagrees with the direction of travel is refused and the press
 * stays a plain nudge. `Ctrl+Shift+←/→` is the gesture that crosses a break.
 */
import type { MusicEngine } from '../engine/MusicEngine'
import type { ElementRegistry } from '../engine/ElementRegistry'
import type { EditorState } from './EditorState'
import { selectedOf } from './EditorState'
import { nextSlurAnchorStop, type AnchorWalkEngine } from './slurReanchor'
import { endpointOffsetOverrideOf } from '../engine/models/engravingOverrides'
import { dbg } from '../utils/debug'

/** What the walk needs off the engine — a Pick, so a spec can stand it up without a renderer. */
export type EndpointWalkEngine = AnchorWalkEngine & Pick<MusicEngine,
  'getElementRegistry' | 'nudgeSlurEndpoint' | 'setSlurEndpointKeepingEdits' | 'runBatch'>

/**
 * The staff-space size to convert the measured gap with, read off a drawn handle of THIS slur.
 *
 * ⛔ No fallback constant. The offset is stored in staff-spaces, so a guessed scale would write a
 * re-base of the wrong size — quietly, and only on a staff that is not the default size (a small
 * staff beside a normal one is a ratio, not a constant). With no handle drawn there is no crossing,
 * and the press stays the plain nudge it has always been.
 *
 * The handle is matched to the END being walked where possible: a cross-system slur draws a pair of
 * arc dots per system, and its two true ends can sit on staves of different sizes.
 */
function staffSpacePxAt(registry: ElementRegistry, slurId: string, which: 'start' | 'end'): number | null {
  const handles = registry.getByType('slur-handle').filter(el => el.slurId === slurId)
  const role = which === 'start' ? 'begin' : 'end'
  const handle = handles.find(el => el.segmentRole === role)
    ?? handles.find(el => el.segmentRole === undefined)
    ?? handles[0]
  return handle?.staffSpacePx ?? null
}

/** Where a note's head sits horizontally, or null if the last render drew none (off-screen). */
function noteCentreX(registry: ElementRegistry, noteId: string): number | null {
  const el = registry.getByType('note').find(e => e.id === noteId)
  return el ? el.bbox.x + el.bbox.width / 2 : null
}

/** The step this press takes, when it takes the anchor with it: the note to land on, and the gap in
 *  staff-spaces that has to come back out of the offset so the ink does not move. Null = an ordinary
 *  nudge (no candidate, no geometry, a system break, or the ink has simply not arrived yet). */
function arrivedAt(
  state: EditorState,
  engine: EndpointWalkEngine,
  dx: number,
): { noteId: string; gap: number } | null {
  const selected = selectedOf(state, 'slur')
  if (!selected?.endpoint) return null
  const slur = engine.getSlurById(selected.id)
  if (!slur) return null

  const direction = dx > 0 ? 1 : -1
  // The SAME candidate rule the Ctrl+Shift+←/→ jump uses, which is why it lives over there: two
  // rules would mean the same key landing on a different note depending on how far you had nudged.
  const dest = nextSlurAnchorStop(state, engine, direction)
  if (!dest) return null

  const registry = engine.getElementRegistry()
  const ss = staffSpacePxAt(registry, selected.id, selected.endpoint)
  if (!ss) return null
  const anchorId = selected.endpoint === 'start' ? slur.startNoteId : slur.endNoteId
  const fromX = noteCentreX(registry, anchorId)
  const toX = noteCentreX(registry, dest.id)
  if (fromX === null || toX === null) return null

  const gap = (toX - fromX) / ss
  // 🚨 The next note in TIME is not always the next note in X: across a system break it is far to
  // the LEFT while the travel is rightward. Subtracting those two x's is meaningless, so refuse.
  if (Math.sign(gap) !== direction) return null

  const offset = endpointOffsetOverrideOf(engine.getScore(), selected.id)?.[selected.endpoint]?.x ?? 0
  const arrived = direction > 0 ? offset + dx >= gap : offset + dx <= gap
  return arrived ? { noteId: dest.id, gap } : null
}

/**
 * One horizontal arrow press on an armed slur endpoint: nudge the ink, and re-anchor if the ink has
 * arrived at the next note. `dx` is a staff-space delta (¼ space plain, 1 space with Ctrl).
 *
 * ⚠️ **Returns true whenever an endpoint was armed**, even if the write was refused (the page
 * limit) — the armed square eats the arrow either way, exactly as the plain nudge it replaces did.
 * False means "no endpoint armed", so the caller's chain carries on to the next tenant of the key.
 *
 * A crossing press is ONE undo entry covering both writes, via `runBatch`: the re-point and the
 * re-base are two halves of a single press, and an undo that took back only half of it would leave
 * the ink somewhere the user never put it.
 */
export function walkArmedSlurEndpoint(state: EditorState, engine: EndpointWalkEngine, dx: number): boolean {
  const selected = selectedOf(state, 'slur')
  const which = selected?.endpoint
  if (!selected || !which) return false

  const arrival = arrivedAt(state, engine, dx)
  if (!arrival) {
    engine.nudgeSlurEndpoint(selected.id, which, dx, 0)
    return true
  }

  engine.runBatch('Re-anchor slur', () => {
    // ⭐ `…KeepingEdits`, not the general re-anchor: the crossing is meant to be invisible, and the
    // ordinary one wipes this end's nudge and the arc's shape (`slurOps.setSlurEndpoint`).
    if (!engine.setSlurEndpointKeepingEdits(selected.id, which, arrival.noteId)) {
      engine.nudgeSlurEndpoint(selected.id, which, dx, 0) // defensive: nothing moved, so just nudge
      return
    }
    // What is left of the step once the anchor has absorbed the gap. Usually a hair either side of
    // zero, which is why the stored offset never grows as the endpoint walks along the staff.
    engine.nudgeSlurEndpoint(selected.id, which, dx - arrival.gap, 0)
  })
  dbg(`Slur endpoint walked onto its next note | id:${selected.id} end:${which} → ${arrival.noteId} (gap ${arrival.gap.toFixed(2)}ss)`)
  return true
}
