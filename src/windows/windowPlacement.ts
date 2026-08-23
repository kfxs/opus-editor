/**
 * Where a standing panel was, and whether it was up — remembered across reloads.
 *
 * A MODULE and not a field on {@link Window} or the manager: those two own the LIVE geometry, which
 * is a different question from what the user last left behind. A window is opened by whoever defines
 * it (`windows/keypad`, `windows/properties`), and that module is the only one that knows which of
 * its numbers are the user's choice and which are its own opening rule — so the panel asks here for
 * a placement and hands one back, rather than the frame quietly saving itself.
 *
 * KEYED BY A NAME, not by `Window.id`: ids are minted per open (`win-1`, `win-2`) and would never
 * match across a reload. The name is the panel's, and it is stable.
 *
 * A missing or unreadable value is simply ABSENT — the caller falls back to its own defaults. This
 * is a preference, not score data: there is nothing to report and nobody to report it to, and the
 * repair is "open where you always did". (Contrast docs/json-io-plan.md, where a damaged SCORE is
 * reported and never repaired — losing a bar is not losing a window position.)
 */

const PREFIX = 'opus-editor.window.'

export interface WindowPlacement {
  /** Was the panel up when the editor was last left? */
  open: boolean
  /** Top-left, in viewport pixels. Absent until the panel has actually been placed once. */
  x?: number
  y?: number
}

/**
 * `localStorage` can be MISSING (unit tests run in node) and can also THROW on the very first touch
 * (Safari's private mode, a browser with site data switched off). Both mean the same thing here: the
 * editor runs, it just does not remember.
 */
function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

export function readPlacement(key: string): WindowPlacement | null {
  const raw = storage()?.getItem(PREFIX + key)
  if (!raw) return null
  try {
    const value = JSON.parse(raw) as Partial<WindowPlacement>
    if (typeof value?.open !== 'boolean') return null
    return {
      open: value.open,
      // A number that is not finite is not a position. Dropping the pair (rather than half of it)
      // keeps the caller's fallback whole: half a remembered corner is worse than none.
      ...(Number.isFinite(value.x) && Number.isFinite(value.y) ? { x: value.x, y: value.y } : {}),
    }
  } catch {
    return null
  }
}

/**
 * The last value written under each key, so a placement that has not changed does not reach the disk
 * again. The callers save on cheap, frequent signals — every window event, every pointer release —
 * and this is what makes that free.
 */
const written = new Map<string, string>()

export function writePlacement(key: string, placement: WindowPlacement): void {
  // Rebuilt in a fixed field order, so the de-dup compares placements and not object literals.
  const raw = JSON.stringify({ open: placement.open, x: placement.x, y: placement.y })
  if (written.get(key) === raw) return
  written.set(key, raw)
  try {
    storage()?.setItem(PREFIX + key, raw)
  } catch {
    // Quota, or a storage that only pretends to be one. A preference is never worth an exception.
  }
}

/** Test seam: the de-dup is module state, and a test that writes twice must be able to start clean. */
export function forgetWrittenPlacements(): void {
  written.clear()
}
