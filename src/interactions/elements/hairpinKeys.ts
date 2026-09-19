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
import { cycleHairpinEndpoint } from './hairpinHandles'
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

  /**
   * The armed SQUARE is the gate, and says which end: the RIGHT one resizes — `→` lengthens, `←`
   * shortens — and the LEFT one moves the start and holds the end (the model writes `beat` and
   * `length` together). Nothing armed DECLINES: the wedge is not silently resized from one end.
   *
   * ⚠️ **This writes the MODEL where the arrows above write an override**, and that is the rule,
   * not an inconsistency: a hairpin's EXTENT is musical — it says which notes get louder — and its
   * height is not. An offset here would give two ways to say "three beats long" that can disagree,
   * with playback believing the one the eye does not.
   *
   * ⭐ **By a SLOT, not by a fixed fraction**: the step is the duration of the note the wedge ends
   * on (growing) or would end on (shrinking), so the end always lands on a notehead — the only
   * place a wedge can honestly stop. A fixed quarter would leave it mid-triplet. It DECLINES rather
   * than make the wedge non-positive; shortening never deletes the thing being shortened.
   */
  reanchor({ engine, render }, { id, endpoint }, direction) {
    if (!endpoint) return false
    const moved = endpoint === 'end'
      ? engine.resizeHairpinBySlot(id, direction)
      : engine.moveHairpinStartBySlot(id, direction)
    if (moved) render()
    return moved
  },

  /** `Tab` walks the wedge's two endpoint squares (`./hairpinHandles`). */
  cycle({ engine, state, render }, _hairpin, step) {
    const armed = cycleHairpinEndpoint(state, engine.getElementRegistry(), step)
    if (armed) render()
    return armed
  },

  /** An armed end → that end; nothing armed → both. DECLINEs when there was no nudge to take back,
   *  so the key falls through to the note-spacing / bar-width resets. */
  reset({ engine, render }, { id, endpoint }) {
    const was = endpoint ? engine.resetHairpinEndpointOffset(id, endpoint) : engine.resetHairpinOffset(id)
    if (was) render()
    return was
  },
}
