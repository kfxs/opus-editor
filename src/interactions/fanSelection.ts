import { PaletteSelection } from './paletteSelection'

/**
 * The two FEATHERED-BEAM keys shared between the editor and the Keypad — `accel.` and `rit.`, on the
 * Beams/Tremolos page's `0` and `.` (Sibelius's own places, and the last two cells on that page that
 * were still unwired).
 *
 * Single-valued like the tremolo count, and for the same reason: a note carries ONE fan, so the two
 * keys are a radio — pressing the lit one takes the fan off, pressing the other turns it round
 * (`pressFan` owns both, and has since the palette buttons; this only routes to it).
 *
 * Engine-read, so the light cannot be mirrored from a reactive field: the mark is a fact about the
 * score, and a Delete or an undo changes it without going near the palette. `PaletteController
 * .refreshFanSelection` pushes it, and `fanHighlight` (keypadSync) is the rule.
 */
export const fanSelection = new PaletteSelection<'accel' | 'rit'>()
