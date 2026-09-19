/**
 * The arrows on a selected HAIRPIN. **Something armed → that end moves; nothing armed → the wedge
 * does.** One chord, read by what was picked — the slur's arrangement, and the reason both gestures
 * can share the plain arrows at all.
 *
 * ⭐ **Two chords, two CATEGORIES, one pair of handles.** `Ctrl+Shift+←/→` says which notes get
 * louder (the model); these say where the ink goes (an override).
 *
 * ⭐⭐ **The HORIZONTAL goes through the INTERPOLATING WALK** (`../hairpinWalk`), on either square
 * and on the whole wedge: the same ink nudge, except that reaching the next boundary of the lane
 * takes that end — or the whole wedge, length unchanged — along with it. So the arrows and the
 * DRAG land in one state rather than two that look alike. ⚠️ Which means this key can end in a
 * MODEL write: the crossing and nothing else; every press either side of it is ink. Both squares
 * walk, because both have a re-anchor AND an offset — a square where the two gestures do not meet
 * is the odd one out, not the safe one.
 *
 * ⛔ The VERTICAL stays a plain lift: a wedge's system jump is a mouse gesture, needing a hand to
 * say which staff. A `y` on ONE end tilts the wedge; on both, it lifts it off the dynamics line.
 *
 * ⚠️ The whole-wedge nudge writes the two END offsets by the same delta rather than a field of its
 * own — see `hairpinOps.setHairpinOffset` for why a separate "whole wedge" number would be two
 * places the same pixels come from.
 */
import { walkHairpinBody, walkHairpinEndpoint } from '../hairpinWalk'
import type { KeysOf } from './keys'

export const HAIRPIN_KEYS: KeysOf<'hairpin'> = {
  nudge({ engine, afterMarkPress }, { id, endpoint }, dx, dy) {
    const horizontal = dy === 0 && dx !== 0
    if (endpoint) {
      const moved = horizontal
        ? walkHairpinEndpoint(engine, id, endpoint, dx)
        : engine.nudgeHairpinEndpoint(id, endpoint, dx, dy)
      if (moved) afterMarkPress('hairpin', id, dx, dy, () => engine.commitHairpinDrag(endpoint))
      return moved
    }
    const moved = horizontal ? walkHairpinBody(engine, id, dx) : engine.nudgeHairpin(id, dx, dy)
    if (moved) afterMarkPress('hairpin', id, dx, dy, () => engine.commitHairpinOffsetDrag())
    return moved
  },

  /** An armed end → that end; nothing armed → both. DECLINEs when there was no nudge to take back,
   *  so the key falls through to the note-spacing / bar-width resets. */
  reset({ engine, render }, { id, endpoint }) {
    const was = endpoint ? engine.resetHairpinEndpointOffset(id, endpoint) : engine.resetHairpinOffset(id)
    if (was) render()
    return was
  },
}
