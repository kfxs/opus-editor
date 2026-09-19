/**
 * The arrows on a selected DYNAMIC — plain = fine, `Ctrl` = coarse: nudge the letters' position
 * offset, instead of the pitch / navigation edit (which no-ops on a dynamic anyway).
 *
 * ⭐⭐ **The HORIZONTAL goes through the INTERPOLATING WALK** (`../dynamicWalk`): the same ink nudge,
 * except that reaching the next slot of the mark's LANE takes the anchor along with it — the slur
 * endpoint's gesture, on the letters. ⚠️ So this key can end in a MODEL write, which is the crossing
 * and nothing else; `shortcutWiring`'s `ctrlArrowLeft` says why that is allowed on this chord: ink
 * press after press, a re-anchor only on arrival at a slot the user has steered the ink onto, and
 * the mark's own guide line drawn to its anchor throughout.
 *
 * ⛔ The VERTICAL stays a pure offset: a dynamic's lane runs sideways, so there is no anchor above
 * to arrive at. Screen-down is +y, and that is the stored convention too — nothing is converted.
 */
import { walkDynamic } from '../dynamicWalk'
import type { KeysOf } from './keys'

export const DYNAMIC_KEYS: KeysOf<'dynamic'> = {
  nudge({ engine, afterMarkPress }, { id }, dx, dy) {
    const moved = dy === 0 && dx !== 0 ? walkDynamic(engine, id, dx) : engine.nudgeDynamicOffset(id, dx, dy)
    if (moved) afterMarkPress('dynamic', id, dx, dy, () => engine.commitDynamicDrag())
    return moved
  },

  /** The mark walks its own LANE by one slot and takes the beat it lands on, re-filing across a
   *  barline. ⛔ No armed-square gate, unlike the spans: a dynamic is a point, so there is no end to
   *  be pointing at. ⚠️ The MODEL, and audible — the level applies from the beat this writes; the
   *  model drops the mark's own nudge on the way. */
  reanchor({ engine, render }, { id }, direction) {
    const moved = engine.moveDynamicBySlot(id, direction)
    if (moved) render()
    return moved
  },

  /** DECLINEs when the mark was never nudged, so the key falls through to the note spacing / bar
   *  width behind it. */
  reset({ engine, render }, { id }) {
    const was = engine.resetDynamicOffset(id)
    if (was) render()
    return was
  },
}
