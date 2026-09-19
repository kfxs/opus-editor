/**
 * The arrows on a selected SLUR. One kind, FOUR readings, told apart by what is armed — and they
 * are mutually exclusive by construction (one `selectedElement`, one field set):
 *
 * - a blue square, a TRUE END (`endpoint`) → that end's ink, and its anchor along with it;
 * - an orange square, an OPEN JOIN of a cross-system slur (`segmentEndpoint`) → that join's ink;
 * - an amber dot, a SHAPE handle (`controlPoint`) → the arc's curve;
 * - nothing armed → the WHOLE CURVE, its shape conserved — the family's rule (a hairpin, a bracket,
 *   a pedal and a trill read the same way).
 *
 * ⭐⭐ **A true end's HORIZONTAL goes through the INTERPOLATING WALK** (`../slurEndpointWalk`): the
 * same ink nudge, except that reaching the next note takes the ANCHOR along with it. ⚠️ So this key
 * can end in a MODEL write, and an audible one — a slur's span is what legato lengthens.
 * `shortcutWiring`'s `ctrlArrowLeft` says why it is allowed on this chord: ink press after press, a
 * re-anchor only on arrival at a note the user has steered the ink onto, and that note TINTED
 * throughout. The vertical stays a pure offset — an endpoint's `y` has no anchor to arrive at.
 *
 * ⭐ Screen-signed straight through, no conversion: the whole-curve offset is added to the same two
 * endpoints as the per-end nudges, and those speak screen (`SlurOffsetOverride`).
 *
 * ⚠️ An armed END or JOIN always CONSUMES the key and renders, even when the engine refused the
 * step: with a square armed the arrows mean that square, and letting a refused press fall through
 * would re-pitch or navigate instead. A shape handle and the whole curve DECLINE on a refusal.
 *
 * ⛔ No key RUN here, unlike the marks: every press is its own write and its own render.
 */
import { walkArmedSlurEndpoint } from '../slurEndpointWalk'
import { cycleSlurHandle } from '../slurHandleCycle'
import { reanchorArmedSlurEndpoint } from '../slurReanchor'
import { nudgeArmedSlurControlPoint, resetArmedSlurHandle } from '../slurHandleNudge'
import type { KeysOf } from './keys'

export const SLUR_KEYS: KeysOf<'slur'> = {
  nudge({ engine, state, render }, slur, dx, dy) {
    if (slur.endpoint) {
      if (dy === 0 && dx !== 0) walkArmedSlurEndpoint(state, engine, dx)
      else engine.nudgeSlurEndpoint(slur.id, slur.endpoint, dx, dy)
      render()
      return true
    }
    if (slur.segmentEndpoint) {
      // The captured span count is the override's reset signature
      // (docs/multisystem-slur-segment-endpoint-offset-plan.md).
      engine.nudgeSlurSegmentEndpoint(slur.id, slur.segmentEndpoint, dx, dy, slur.segmentSpanCount ?? 0)
      render()
      return true
    }
    // The shape handle's module owns the whole conversion: unlike the offsets, its baseline is the
    // DRAWN arc rather than the stored value (`../slurHandleNudge`).
    const moved = slur.controlPoint
      ? nudgeArmedSlurControlPoint(state, engine, dx, dy)
      : engine.nudgeSlur(slur.id, dx, dy)
    if (moved) render()
    return moved
  },

  /** An armed TRUE END walks its anchor one NOTE along, instead of nudging it by pixels. The module
   *  owns every reason it can decline — no armed end, off the lane, at the other end
   *  (`../slurReanchor`). */
  reanchor({ engine, state, render }, _slur, direction) {
    const moved = reanchorArmedSlurEndpoint(state, engine, direction)
    if (moved) render()
    return moved
  },

  /** `Tab` walks the slur's drawn handles — dots, ends and joins (`../slurHandleCycle`). */
  cycle({ engine, state, render }, _slur, step) {
    const armed = cycleSlurHandle(state, engine.getElementRegistry(), step)
    if (armed) render()
    return armed
  },

  /** ANY armed handle — arc dot, true end or open join — back to the automatic engraving; nothing
   *  armed → the whole curve back where the engraver put it. ⚠️ Three statements, three resets: the
   *  whole-curve reset leaves the per-end nudges and the arc's shape. DECLINEs when there is
   *  nothing authored to reset, so the key falls through to the note-spacing / bar-width resets. */
  reset({ engine, state, render }, slur) {
    const armed = slur.endpoint || slur.segmentEndpoint || slur.controlPoint
    const was = armed ? resetArmedSlurHandle(state, engine) : engine.resetSlurOffset(slur.id)
    if (was) render()
    return was
  },
}
