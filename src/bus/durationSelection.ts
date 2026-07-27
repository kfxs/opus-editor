import type { NoteDuration } from '@/types/music'
import { PaletteSelection } from './paletteSelection'

/**
 * The note duration shared between the editor and the Keypad (the 1–6 keys). See {@link PaletteSelection}
 * for the two-channel shape. `EditorState.selectedDuration` stays the armed value the score reads, and
 * `PaletteController.setDuration` still owns what CHOOSING one DOES; App.ts mirrors the duration-to-
 * highlight in, and routes a Keypad press out through setDuration.
 */
export const createDurationSelection = () => new PaletteSelection<NoteDuration>()
