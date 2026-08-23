import { SHORTCUTS } from './ShortcutConfig'

/**
 * The key that runs an action, WRITTEN THE WAY A UI SHOWS IT — `createSlur` → `S`,
 * `createDiminuendo` → `Shift+H`.
 *
 * ⭐ Derived from {@link SHORTCUTS}, never re-typed. Menu rows spell their accelerators out as
 * literals with a *"keep them in step"* comment beside each one, which works because a menu row and
 * its key are written in the same breath. A PICTURE list is different: the hint is the only thing
 * telling you the row has a key at all, so a stale one is a lie with nothing next to it to catch the
 * eye. Reading the real table means the hint cannot drift — rebind the key and the dialog says so.
 *
 * Returns null when the action has no key. ⚠️ That is a real answer and not a failure: four of the
 * Lines rows (trill, both octave lines, pedal) deliberately have no shortcut, and their rows simply
 * show nothing.
 */
export function shortcutLabel(action: string): string | null {
  for (const [key, def] of Object.entries(SHORTCUTS)) {
    if (def.action === action) return displayKey(key)
  }
  return null
}

/**
 * A config key as a reader expects to see it. The config is keyed for LOOKUP — single letters are
 * lowercase, because that is what `KeyboardEvent.key` gives and what `ShortcutManager` compares
 * against — so only the final segment is touched, and only when it is one letter. `Shift+h` becomes
 * `Shift+H`; `Enter`, `Tab` and `ArrowRight` are already the names they should show under.
 */
function displayKey(key: string): string {
  const parts = key.split('+')
  const last = parts[parts.length - 1]
  if (last.length === 1) parts[parts.length - 1] = last.toUpperCase()
  return parts.join('+')
}
