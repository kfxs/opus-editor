/**
 * The arrows on a selected BEAM — his ask, 2026-09-28: *"I want to be able to push the beam up or down with arrow up
 * down and ctrl arrow up down"*. Plain = fine, `Ctrl` = coarse, as everywhere (the dispatcher's steps).
 *
 * ⛔ **The VERTICAL only.** A beam's ends are its outer stems, so a horizontal press has nothing to author and
 * DECLINES — it falls through to what ←/→ do with no beam selected. Screen-down is +y and that is the stored
 * convention too (`BeamOffsetOverride`), so nothing is converted. `Ctrl+Backspace` puts it back.
 */
import type { KeysOf } from './keys'

export const BEAM_GROUP_KEYS: KeysOf<'beamGroup'> = {
  nudge({ engine, render }, { noteId }, _dx, dy) {
    if (dy === 0) return false
    // ⚠️ A refused step (the band limit) still CONSUMES the key: with a beam selected ↑/↓ mean the beam, and
    //   letting the press fall through would re-pitch a note the user is not looking at.
    if (engine.beam.nudgeBeam(noteId, dy)) render()
    return true
  },

  /** DECLINEs when the beam was never moved, so the key falls through to what is behind it. */
  reset({ engine, render }, { noteId }) {
    const was = engine.beam.resetBeamOffset(noteId)
    if (was) render()
    return was
  },
}
