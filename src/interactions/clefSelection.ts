import { PaletteSelection } from './paletteSelection'
import type { Clef } from '../types/music'

/**
 * The armed clef, shared between the editor and the plain-TS Clef window ({@link ../windows/clefWindow}).
 * The same two-channel seam the Keypad's keys use ({@link PaletteSelection}), for the same reason: a
 * window cannot see the controllers, and neither should it — it presses a VALUE, and
 * {@link ../interactions/keypadSync} routes that into `PaletteController.setClef`, the very method the
 * palette calls. One arming path, whoever asked.
 *
 * HIGHLIGHT mirrors the armed clef, so re-opening the window shows what is already armed rather than
 * a stale first row. PRESS always fires — pressing the armed clef again is a real event, and `setClef`
 * reads it as "disarm", the same toggle an accidental key has.
 */
export const clefSelection = new PaletteSelection<Clef>()
