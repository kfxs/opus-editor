/**
 * The arrows on a selected TUPLET — the `keys` column of its row (his ask, 2026-09-25: *"add vertical
 * offset to the tuplet bracket with arrow up down, also ctrl up down and ctrl backspace for clear"*).
 * VERTICAL only: the bracket spans its notes and has no x of its own — a horizontal press DECLINES, so
 * `←/→` fall through to what they do with nothing of this kind selected. `dy` arrives SCREEN-signed (+ down)
 * and is stored the same way (`TupletOffsetOverride`), so no sign turns here — unlike the tempo's.
 */
import type { KeysOf } from './keys'

export const TUPLET_KEYS: KeysOf<'tuplet'> = {
  nudge({ engine, render }, { id }, dx, dy) {
    if (dx !== 0 || dy === 0) return false
    const moved = engine.tuplet.nudgeOffset(id, dy)
    if (moved) render()
    return moved
  },

  /** DECLINES when the bracket was never nudged, so the key falls through. */
  reset({ engine, render }, { id }) {
    const was = engine.tuplet.resetOffset(id)
    if (was) render()
    return was
  },
}
