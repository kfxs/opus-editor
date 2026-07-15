import { PaletteSelection } from './paletteSelection'

/**
 * Selection mode as a Keypad key, on the SAME two-channel seam as duration/accidental/dot/tie
 * ({@link PaletteSelection}). This replaces the old bespoke `toolMode` store: now that EditorState
 * carries its own change-notification (the emitting Proxy — see docs/observable-editorstate-plan.md),
 * the mode no longer needs a hand-built bidirectional mirror through App.vue. It is just another key.
 *
 * HIGHLIGHT: `keypadSync` pushes `'selection'` when `state.selectedTool === 'selection'`, null
 * otherwise — driven by the state's own `subscribe`, so the Select arrow lights no matter WHO changed
 * the mode (toolbar, Esc, mouse, or the arrow itself). PRESS: the arrow click fires a press, routed in
 * `keypadSync` to `PaletteController.enterSelectionMode()` — the framework-agnostic equivalent of the
 * toolbar's Select button, which owns its own disarm + render (no origin-guessing, no double-render).
 *
 * The sole value is `'selection'` — the arrow is a one-way "go to selection mode" command; entry mode
 * is entered by other gestures (arming a tool, clicking a position).
 */
export const modeSelection = new PaletteSelection<'selection'>()
