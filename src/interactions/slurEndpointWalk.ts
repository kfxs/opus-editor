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
  'getElementRegistry' | 'nudgeSlurEndpoint' | 'setSlurEndpointKeepingEdits' | 'runBatch'
  | 'previewSlurEndpointOffset' | 'previewSlurEndpointKeepingEdits'>

/**
 * The two model writes the move is made of, in the flavour the gesture needs: a KEY press records
 * its own undo step, a drag FRAME records none and leaves the drop to commit once.
 *
 * ⭐ The pair is what separates the two callers — the arithmetic below does not know which device it
 * is serving, and could not be made to disagree with itself if it tried.
 */
interface EndpointWriter {
  reanchor: (id: string, which: 'start' | 'end', noteId: string) => boolean
  nudge: (id: string, which: 'start' | 'end', dx: number, dy: number) => boolean
}

/** What one move did, for a caller that has to react to a crossing rather than just repaint. */
export interface EndpointMove {
  /** How many notes the anchor crossed. 0 is an ordinary move that carried only ink. */
  crossings: number
  /**
   * The distance from where the ink LATCHED to the next note in the direction of travel — in
   * **pixels** out of {@link dragArmedSlurEndpoint}, staff-spaces inside the module. 0 when nothing
   * latched, or when nothing lies ahead.
   *
   * ⭐ AHEAD, not behind, and that is the whole point: the hold's debt is repaid over the journey to
   * the next note, so it must be a fraction of THAT distance. Sizing it on the gap just crossed
   * ratchets the cursor away from the ink wherever the spacing is uneven.
   *
   * ⭐ A fraction of a measured gap rather than a pixel count, so the gesture is the same at every
   * zoom and in every density of music.
   */
  gapAhead: number
  /** The ink stopped exactly on a note's own position instead of passing through it — a crossing
   *  always latches, and so does coming back to the anchor the end already has. */
  latched: boolean
  /** Travel (staff-spaces here, PIXELS out of {@link dragArmedSlurEndpoint}) that the latch took off
   *  the ink. ⚠️ The caller owes it back, or the cursor drifts away from the endpoint for good. */
  discarded: number
}

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

/** This end's stored horizontal offset, in staff-spaces. 0 = the ink is where the engraver put it. */
function offsetXOf(engine: EndpointWalkEngine, id: string, which: 'start' | 'end'): number {
  return endpointOffsetOverrideOf(engine.getScore(), id)?.[which]?.x ?? 0
}

/**
 * The note one step away in the direction of travel, and how far away it is in staff-spaces — or null
 * when there is nothing to walk onto (no candidate, no drawn geometry, or a system break).
 *
 * ⭐ Split from the arrival TEST because the two questions have different callers: a crossing needs to
 * know whether the ink got there, while a LATCH needs the distance whether or not anything crossed
 * (that gap is what sizes the hold).
 */
function neighbourGap(
  state: EditorState,
  engine: EndpointWalkEngine,
  direction: 1 | -1,
): { noteId: string; gap: number } | null {
  const selected = selectedOf(state, 'slur')
  if (!selected?.endpoint) return null
  const slur = engine.getSlurById(selected.id)
  if (!slur) return null

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
  return { noteId: dest.id, gap }
}

/** The step this press takes, when it takes the anchor with it. Null = the ink has not arrived (or
 *  there is nowhere to arrive), so the move is an ordinary nudge. */
function arrivedAt(
  state: EditorState,
  engine: EndpointWalkEngine,
  dx: number,
): { noteId: string; gap: number } | null {
  const selected = selectedOf(state, 'slur')
  if (!selected?.endpoint) return null
  const next = neighbourGap(state, engine, dx > 0 ? 1 : -1)
  if (!next) return null
  const target = offsetXOf(engine, selected.id, selected.endpoint) + dx
  const arrived = dx > 0 ? target >= next.gap : target <= next.gap
  return arrived ? next : null
}

/**
 * ⭐⭐ **THE MOVE ITSELF** — carry the armed endpoint's ink by (`dx`, `dy`) staff-spaces, handing the
 * anchor along to each note the ink arrives at on the way. Shared verbatim by the arrow keys and the
 * mouse drag; only the {@link EndpointWriter} differs.
 *
 * ⭐ **A LOOP, because a drag frame is not a step.** A key press moves a quarter- or whole space and
 * can cross at most one note; one frame of a fast drag can fly over several, and re-anchoring only
 * once would leave the anchor trailing the cursor by however many notes were skipped. Each pass
 * re-points the anchor and takes that gap back out of the offset — an identity, so the ink never
 * moves at a crossing however many happen in one frame.
 *
 * ⚠️ The bound is a runaway guard, not a rule: `arrivedAt` already refuses at the lane's end, at the
 * slur's other end, and across a system break, so the loop is expected to run 0 or 1 times.
 */
function carryEndpoint(
  state: EditorState,
  engine: EndpointWalkEngine,
  write: EndpointWriter,
  dx: number,
  dy: number,
  /** ⭐ Drop the accumulated VERTICAL nudge at each crossing — his call for the DRAG, 2026-08-18.
   *  See {@link dragArmedSlurEndpoint} for why the two devices differ on this one point. */
  settleVertically = false,
  /** ⭐ Stop the ink dead on a note's own position when the move would carry it through — the DRAG's
   *  latch. See {@link dragArmedSlurEndpoint}. */
  latching = false,
): EndpointMove {
  const selected = selectedOf(state, 'slur')
  const which = selected?.endpoint
  if (!selected || !which) return { crossings: 0, gapAhead: 0, latched: false, discarded: 0 }

  let crossings = 0
  for (; crossings < 32; crossings++) {
    const arrival = arrivedAt(state, engine, dx)
    if (!arrival) break
    // ⭐ `…KeepingEdits`, not the general re-anchor: the crossing is meant to be invisible, and the
    // ordinary one wipes this end's nudge and the arc's shape (`slurOps.setSlurEndpoint`).
    if (!write.reanchor(selected.id, which, arrival.noteId)) break
    // The anchor has absorbed one gap, so the offset gives it up. Horizontally the ink is unchanged
    // by the pair, which is the whole design; `dx` is untouched and still has its journey to make.
    const heldY = settleVertically
      ? -(endpointOffsetOverrideOf(engine.getScore(), selected.id)?.[which]?.y ?? 0)
      : 0
    write.nudge(selected.id, which, -arrival.gap, heldY)
    dbg(`Slur endpoint walked onto its next note | id:${selected.id} end:${which} → ${arrival.noteId} (gap ${arrival.gap.toFixed(2)}ss)`)
  }
  // ⭐⭐ **THE LATCH** — his ask, 2026-08-18: *"we should not hold just when getin a new target but
  // also when reaching our current target"*. The two events are ONE event once named properly: the
  // ink latches at OFFSET ZERO of whichever note is nearest in the direction of travel, whether that
  // is the note it has just crossed onto or the note it is coming back to. Both are "the place the
  // engraver would have put this end", and both are the position most likely to be wanted — so both
  // must be reachable exactly rather than by luck, which is Baudisch's whole complaint about
  // radius-based snapping.
  //
  // ⚠️ The move is CUT SHORT: whatever travel is left over is discarded from the ink and reported, so
  // the caller can charge it to the catch-up and hand it back. Without that the latch would silently
  // eat distance and the cursor would drift away from the ink — the same defect the catch-up exists
  // to fix.
  let latched = false
  let discarded = 0
  const offset = offsetXOf(engine, selected.id, which)
  const target = offset + dx
  // ⛔ `offset !== 0` is what lets the ink LEAVE a note it is sitting on: at zero every direction
  // "passes through", so latching there would pin the endpoint for good.
  let gapAhead = 0
  if (latching && dx !== 0 && offset !== 0 && Math.sign(target) !== Math.sign(offset)) {
    write.nudge(selected.id, which, -offset, dy)
    latched = true
    discarded = Math.abs(target)
    // ⭐⭐ **THE GAP AHEAD, measured AFTER the latch — not the one just crossed.** 🚨 That distinction
    // was a real bug (his logs, 2026-08-18): a hold sized on the gap BEHIND has to be given back over
    // the gap AHEAD, and with uneven spacing those differ wildly. Crossing a whole note's 21.98 sp to
    // land 11.09 sp from the next one left a debt that the following gap could not repay, so it
    // ratcheted — the measured deviation ran −80 px, −175 px, −258 px, one note after another.
    //
    // ⭐ Sized on the gap ahead the arithmetic closes exactly: with hold `r·gapAhead` and the derived
    // gain `1/(1−r)`, the debt reaches zero at the very moment the ink reaches the next note, for any
    // spacing. ⚠️ Zero when nothing lies ahead (a lane's end, or the slur's other end): there is no
    // journey left to repay over, so there must be no hold either.
    gapAhead = Math.abs(neighbourGap(state, engine, dx > 0 ? 1 : -1)?.gap ?? 0)
    dbg(`Slur endpoint latched on its anchor | id:${selected.id} end:${which} (dropped ${discarded.toFixed(2)}ss, ${gapAhead.toFixed(2)}ss ahead)`)
  } else if (dx !== 0 || dy !== 0) {
    write.nudge(selected.id, which, dx, dy)
  }
  return { crossings, gapAhead, latched, discarded }
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
  if (!selectedOf(state, 'slur')?.endpoint) return false
  engine.runBatch('Move slur endpoint', () => {
    carryEndpoint(state, engine, {
      reanchor: (id, which, noteId) => engine.setSlurEndpointKeepingEdits(id, which, noteId),
      nudge: (id, which, ddx, ddy) => engine.nudgeSlurEndpoint(id, which, ddx, ddy),
    }, dx, 0)
  })
  return true
}

/**
 * ⭐⭐ **ONE FRAME OF AN ENDPOINT DRAG** — the same move, with the cursor's delta in PIXELS instead
 * of a key's step, and no undo entry (the drop commits once, {@link MusicEngine.commitSlurEndpoint}).
 *
 * ⭐ **The mouse and the arrows are now the SAME gesture**, which is what the drag was missing: it
 * used to snap the end to the nearest notehead within 60 px and re-anchor outright, so the ink
 * teleported and every hand-tuned edit on that end was wiped on the way past. Now the ink follows
 * the hand and the anchor comes along when the ink reaches a note — and a drag and ten arrow presses
 * that cover the same distance leave the model in the same state, rather than in two states that
 * merely look alike.
 *
 * ⭐ **Both axes**, unlike the keys' horizontal-only crossing: the vertical is a plain offset (there
 * is no anchor above or below to arrive at), so `dy` simply rides along. It is what makes the drag
 * worth having over the keyboard — you can place the end where you want it in one motion.
 *
 * ⭐⭐ **…and the vertical SETTLES at each crossing** — his call, 2026-08-18: *"in the case of the
 * drag maybe we have to reset the y"*. The one point where the two devices deliberately differ, and
 * the asymmetry is the gestures', not a compromise:
 *
 *  - an ARROW press is a considered edit of one quantity, so a horizontal press has no business
 *    touching a lift the user set on purpose — that is the invisible flip, and it is why the
 *    keyboard keeps its y;
 *  - a DRAG is one continuous sweep, and a lift tuned to clear the OLD note's stem, beam and
 *    accidentals is stale the moment the ink is over a different note. Carrying it along means an
 *    end dragged across a bar arrives holding an answer to a question about a note it has left.
 *
 * So the ink settles to each note's own height as it passes, and the hand can lift it again from
 * there. ⚠️ This is the one place the drag is visibly NOT continuous — a crossing steps the y — which
 * is the point: it is the ink admitting it has changed notes.
 *
 * ⛔ Declines — **null**, not a zero move — with no armed endpoint, or with no drawn handle to read
 * the staff-space size off (the same no-guessing rule the crossing arithmetic follows). Otherwise it
 * reports the {@link EndpointMove}, whose `gapAhead` is in PIXELS here: the caller holds a cursor.
 */
export function dragArmedSlurEndpoint(
  state: EditorState,
  engine: EndpointWalkEngine,
  dxPx: number,
  dyPx: number,
): EndpointMove | null {
  const selected = selectedOf(state, 'slur')
  const which = selected?.endpoint
  if (!selected || !which) return null
  const ss = staffSpacePxAt(engine.getElementRegistry(), selected.id, which)
  if (!ss) return null

  const move = carryEndpoint(state, engine, {
    reanchor: (id, w, noteId) => engine.previewSlurEndpointKeepingEdits(id, w, noteId),
    nudge: (id, w, ddx, ddy) => engine.previewSlurEndpointOffset(id, w, ddx, ddy),
  }, dxPx / ss, dyPx / ss, true, true)
  // Back into the caller's units: it is holding a cursor, not a staff.
  return { ...move, gapAhead: move.gapAhead * ss, discarded: move.discarded * ss }
}
