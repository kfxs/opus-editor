/**
 * The arrows on a selected INLINE CLEF: nudge it SIDEWAYS — plain `←/→` finely, `Ctrl+←/→`
 * coarsely, `Ctrl+Backspace` resets. That is the MARK family's arrangement (a dynamic, a hairpin
 * end, an ottava), and deliberately: a clef nudge is a mark's nudge, ⛔ not a note's — the note
 * offset hides on the harder chords because a note's plain arrows are NAVIGATION, which a clef
 * selection has no use for.
 *
 * ⛔ Horizontal only. A vertical arrow DECLINES, and the key goes on to what it does otherwise.
 *
 * ⚠️ It DECLINES for a HEADER clef — the one standing at the head of a system — and the ENGINE is
 * what says so, from the INK (`MusicEngine.clefIsOffsettable`): whether a clef stands in a system's
 * header is a fact about the casting-off, not about the score, so no rule here could know it.
 *
 * `Ctrl+Shift+←/→` is a different statement — it MOVES the clef through the music, as dragging it
 * does — and stays `shortcutWiring`'s.
 */
import { beatToFrac } from '../../utils/musicUtils'
import type { KeysOf } from './keys'

export const CLEF_KEYS: KeysOf<'clef'> = {
  nudge({ engine, render }, clef, dx, dy) {
    if (dy !== 0 || dx === 0) return false
    const moved = engine.nudgeClefOffset(clef.measure, beatToFrac(clef.beat), clef.staff, dx)
    if (moved) render()
    return moved
  },

  reset({ engine, render }, clef) {
    const was = engine.resetClefOffset(clef.measure, beatToFrac(clef.beat), clef.staff)
    if (was) render()
    return was
  },
}
