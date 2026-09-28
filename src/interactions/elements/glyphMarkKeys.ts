/**
 * What the arrows do to a selected user SYMBOL (docs/plans/symbol-plan.md P4) — the `keys` column of its
 * row. Plain = fine, `Ctrl` = coarse, as for every mark; the write is `engine.glyphMark.nudge`, which
 * refuses a move off the page.
 *
 * ⚠️ Each press renders the score in full, the beam's arrangement: a symbol has no preview family
 * (`markPreviewPass`) of its own yet, so a held arrow is a render per repeat. ⏭️ The first thing to add if
 * a long score makes that visible.
 *
 * ⛔ No `reanchor` (`Ctrl+Shift+←/→`): a symbol belongs to its EVENT, and moving it to another one is a
 * cut and paste, not a nudge.
 */
import type { KeysOf } from './keys'

export const GLYPH_MARK_KEYS: KeysOf<'glyphMark'> = {
  nudge({ engine, render }, { id }, dx, dy) {
    const moved = engine.glyphMark.nudge(id, dx, dy)
    if (moved) render()
    return moved
  },

  /** DECLINES when the symbol was never moved, so the key falls through to what is behind it. */
  reset({ engine, render }, { id }) {
    const was = engine.glyphMark.reset(id)
    if (was) render()
    return was
  },
}
