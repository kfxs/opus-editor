import { DEFAULT_KEYPAD_PAGE, nextKeypadPageId, type KeypadPageId } from './keypadLayouts'

/**
 * Which Keypad page is showing — the seam between the panel and the numpad.
 *
 * It lives OUTSIDE {@link KeypadWidget} for one reason: the numpad IS the Keypad, and it keeps
 * working with the panel closed. A page held privately by the widget would be a page the keyboard
 * cannot see (so `Numpad4` meant "quarter note" forever, whatever the panel was showing) and a page
 * that is forgotten every time the window closes. Here there is always a current page, panel or no
 * panel — `shortcutWiring` reads it as readily as the widget does.
 *
 * ⛔ **The one Keypad seam that is NOT on the bus** (`src/bus/`), where duration/accidental/mode/voice
 * and the rest now live. Its value is a `KeypadPageId`, and that vocabulary is owned by
 * {@link ./keypadLayouts} — `nextKeypadPageId` is expressly *the ONE place page ORDER is used*. Put
 * this on the bus and the bus imports `windows/`, which is upward, and which is the single thing
 * that directory exists to prevent. So it sits beside the layouts it names instead
 * (docs/refactor-plan-2026-07-27.md 3b).
 *
 * The value is an ID, never an index — inserting a page must not silently re-point anything that holds
 * one (see {@link KEYPAD_PAGES}).
 *
 * Simpler than a `PaletteSelection`: a page has no highlight/press split. It is one current
 * value that changes, and everyone reads it. Notifies only on a REAL change, so a re-set cannot loop.
 */
let currentPage: KeypadPageId = DEFAULT_KEYPAD_PAGE
const listeners = new Set<(page: KeypadPageId) => void>()

function setPage(page: KeypadPageId): void {
  if (page === currentPage) return
  currentPage = page
  for (const fn of listeners) fn(page)
}

export const keypadPageSelection = {
  /** The page showing now. */
  get: (): KeypadPageId => currentPage,
  set: setPage,
  /** Turn to the next page — what the `+` key does, from the panel OR the numpad. */
  next: (): void => setPage(nextKeypadPageId(currentPage)),
  /** Repaint hook: the panel re-lays its grid from here. Returns an unsubscribe. */
  subscribe(fn: (page: KeypadPageId) => void): () => void {
    listeners.add(fn)
    return () => listeners.delete(fn)
  },
}
