import type { Accidental } from '@/types/music'
import { PaletteSelection } from './paletteSelection'

/**
 * The accidental shared between the editor and the Keypad (the ♮ ♯ ♭ keys). See {@link PaletteSelection}
 * for the two-channel shape. `EditorState.selectedAccidental` stays the armed value, and
 * `PaletteController.setAccidental` still owns the work — including the TOGGLE (re-pressing the armed
 * accidental takes it off), which is exactly why the press channel must always fire. App.ts mirrors
 * the accidental-to-highlight in, and routes a Keypad press out through setAccidental.
 *
 * ⭐ A press of `null` is the palette's REMOVE (the Accidentals page's `0`, alteration-signs K2): it
 * goes to the same `setAccidental`, which already reads null as "take the accidentals off the
 * selection". The highlight never holds it — nothing lights a removal.
 */
export const createAccidentalSelection = () => new PaletteSelection<Accidental | null>()
