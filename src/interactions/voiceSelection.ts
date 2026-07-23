import { PaletteSelection } from './paletteSelection'

/**
 * The active entry voice (1–4, the Sibelius display convention) shared between the editor and the
 * Keypad's voice row. See {@link PaletteSelection} for the two-channel shape.
 *
 * `EditorState.activeVoice` stays the value the editor reads, and `PaletteController.setActiveVoice`
 * still owns what CHOOSING a voice DOES (arm it for entry, or move the selection into it). App's
 * keypadSync mirrors `activeVoice` in as the highlight — there is always exactly one active voice, so
 * unlike duration/accidental this never goes null — and routes a Keypad press out through
 * setActiveVoice, the SAME method Alt+1..4 and the toolbar call.
 *
 * The keypad's fifth button ("All") is NOT an editor voice and does not press through this seam.
 */
export const voiceSelection = new PaletteSelection<1 | 2 | 3 | 4>()
