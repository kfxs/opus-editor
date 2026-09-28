/**
 * The arrows on a selected BEAM — his ask, 2026-09-28: *"I want to be able to push the beam up or down with arrow up
 * down and ctrl arrow up down"*. Plain = fine, `Ctrl` = coarse, as everywhere (the dispatcher's steps).
 *
 * ⛔ **The VERTICAL only.** A beam's ends are its outer stems, so a horizontal press has nothing to author and
 * DECLINES — it falls through to what ←/→ do with no beam selected. Screen-down is +y and that is the stored
 * convention too (`BeamOffsetOverride`), so nothing is converted. `Ctrl+Backspace` puts it back. ⭐ With a SQUARE picked
 * (`endpoint`), ↑/↓ move that end only — the angle; `Tab` / `Shift+Tab` walk the two ends, as on a slur.
 */
import type { KeysOf } from './keys'

export const BEAM_GROUP_KEYS: KeysOf<'beamGroup'> = {
  nudge({ engine, render }, { noteId, endpoint }, _dx, dy) {
    if (dy === 0) return false
    // ⭐ A PICKED square moves its END only — the angle (his ask, 2026-09-28); otherwise the whole beam.
    // ⚠️ A refused step (the band limit, the stem floor) still CONSUMES the key: with a beam selected ↑/↓ mean the
    //   beam, and letting the press fall through would re-pitch a note the user is not looking at.
    const moved = endpoint ? engine.beam.nudgeBeamEnd(noteId, endpoint, dy) : engine.beam.nudgeBeam(noteId, dy)
    if (moved) render()
    return true
  },

  /**
   * `Tab` / `Shift+Tab`: pick the next END — start, then end (his ask, 2026-09-28: *"similar to slur"*). With no end
   * picked, Tab picks the start and Shift+Tab the end; then they wrap. The slur's rule, over two squares.
   * ⚠️ The REGISTRY is the list, as the slur's: it declines where the squares are not drawn.
   */
  cycle({ engine, state, render }, beam, step) {
    const drawn = engine.getElementRegistry().getByType('beam-group-handle').filter(el => el.noteId === beam.noteId)
    if (drawn.length === 0) return false
    const order = ['start', 'end'] as const
    const at = beam.endpoint ? order.indexOf(beam.endpoint) : -1
    const next = at < 0 ? (step === 1 ? 0 : order.length - 1) : (at + step + order.length) % order.length
    state.selectedElement = { kind: 'beamGroup', noteId: beam.noteId, endpoint: order[next] }
    render()
    return true
  },

  /** DECLINEs when the beam was never moved, so the key falls through to what is behind it. */
  reset({ engine, render }, { noteId }) {
    const was = engine.beam.resetBeamOffset(noteId)
    if (was) render()
    return was
  },
}
