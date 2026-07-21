import type { Accidental } from '../types/music'
import { PaletteSelection } from './paletteSelection'

/**
 * The accidental shared between the editor and the Keypad (the ♮ ♯ ♭ keys). See {@link PaletteSelection}
 * for the two-channel shape. `EditorState.selectedAccidental` stays the armed value, and
 * `PaletteController.setAccidental` still owns the work — including the TOGGLE (re-pressing the armed
 * accidental takes it off), which is exactly why the press channel must always fire. App.ts mirrors
 * the accidental-to-highlight in, and routes a Keypad press out through setAccidental.
 */
export const accidentalSelection = new PaletteSelection<Accidental>()
