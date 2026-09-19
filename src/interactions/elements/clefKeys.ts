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
 * `Ctrl+Shift+←/→` is the other category — it MOVES the clef through the music, one slot earlier or
 * later, which is what DRAGGING it does.
 */
import type { Fraction } from '../../types/music'
import { buildBeatMap } from '../../utils/beatMap'
import { dbg } from '../../utils/debug'
import { fracToNumber } from '../../utils/fraction'
import { beatToFrac } from '../../utils/musicUtils'
import type { KeysOf } from './keys'

export const CLEF_KEYS: KeysOf<'clef'> = {
  nudge({ engine, render }, clef, dx, dy) {
    if (dy !== 0 || dx === 0) return false
    const moved = engine.nudgeClefOffset(clef.measure, beatToFrac(clef.beat), clef.staff, dx)
    if (moved) render()
    return moved
  },

  /**
   * ⭐ **The next slot is the BEAT MAP's** — the same stop the `→` key walks and the clef APPLY uses
   * — so a clef at a bar's first slot steps back into the previous bar rather than stopping at the
   * barline, and nothing here has to know a bar's length. ⚠️ Scoped to the clef's own STAFF: a clef
   * is a per-staff statement.
   *
   * ⚠️ It ends on `commitClefMove`, the DRAG's own tail (`../drags/clef`) — which drops the clef if
   * it landed somewhere redundant and records ONE undo entry. Sharing it is the point: a keyboard
   * move and a mouse drag cannot drift apart.
   */
  reanchor({ engine, state, render }, clef, direction) {
    const { beats } = buildBeatMap(engine.getScore(), undefined, clef.staff)
    const at = beats.findIndex((b: { measureNumber: number; beat: Fraction }) =>
      b.measureNumber === clef.measure && fracToNumber(b.beat) >= clef.beat - 1e-9)
    const target = at === -1 ? undefined : beats[at + direction]
    if (!target) return false
    if (!engine.moveClef(clef.measure, beatToFrac(clef.beat), target.measureNumber, target.beat)) return false
    engine.commitClefMove(target.measureNumber, target.beat)
    // ⭐ The selection FOLLOWS the clef, or the next press would move whatever is left at the old
    // address — and there is usually nothing there at all. ⚠️ REASSIGN, never mutate.
    state.selectedElement = {
      kind: 'clef', measure: target.measureNumber, beat: fracToNumber(target.beat), staff: clef.staff,
    }
    render()
    dbg(`[Clef] moved ${direction > 0 ? '→' : '←'} to measure ${target.measureNumber} `
      + `beat ${fracToNumber(target.beat).toFixed(3)} staff ${clef.staff}`)
    return true
  },

  reset({ engine, render }, clef) {
    const was = engine.resetClefOffset(clef.measure, beatToFrac(clef.beat), clef.staff)
    if (was) render()
    return was
  },
}
