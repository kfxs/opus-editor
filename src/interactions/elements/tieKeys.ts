/**
 * The arrows on a selected TIE — his ask, 2026-09-21: *"a tie if selected can not be offseted
 * vertically with the arrow, we must fix this"*. Plain = fine, `Ctrl` = coarse, as everywhere.
 *
 * ⛔ **The VERTICAL only.** A tie's ends are its two noteheads (Gould p. 308: *"The tie must connect
 * the noteheads"*), so a horizontal press has nothing to author and DECLINES — it falls through to
 * what ←/→ do with no tie selected. Screen-down is +y and that is the stored convention too
 * (`TieOffsetOverride`), so nothing is converted.
 *
 * ⛔ No key RUN, like the slur: every press is its own write and its own render.
 */
import type { KeysOf } from './keys'

export const TIE_KEYS: KeysOf<'tie'> = {
  nudge({ engine, render }, { fromNoteId }, _dx, dy) {
    if (dy === 0) return false
    // ⚠️ A refused step (the band limit) still CONSUMES the key: with a tie selected ↑/↓ mean the
    //   tie, and letting the press fall through would re-pitch a note the user is not looking at.
    if (engine.tie.nudgeTie(fromNoteId, dy)) render()
    return true
  },

  /** DECLINEs when the tie was never moved, so the key falls through to what is behind it. */
  reset({ engine, render }, { fromNoteId }) {
    const was = engine.tie.resetTieOffset(fromNoteId)
    if (was) render()
    return was
  },
}
