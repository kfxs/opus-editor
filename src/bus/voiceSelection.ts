import { PaletteSelection } from './paletteSelection'

/**
 * The voice row — 1–4 and **All** — shared between the editor and the Keypad. Two things ride one
 * seam, because they are one PRESS: the active entry voice (1–4, the Sibelius display convention)
 * and, when a dynamic or a hairpin is selected, which voices that MARK governs (`'all'` included).
 * See {@link PaletteSelection} for the two-channel shape.
 *
 * `EditorState.activeVoice` stays the value the editor reads, and `PaletteController.setActiveVoice`
 * still owns what CHOOSING a voice DOES (arm it for entry, or move the selection into it). App's
 * keypadSync mirrors `activeVoice` in as the highlight — there is always exactly one active voice, so
 * unlike duration/accidental this never goes null — and routes a Keypad press out through
 * setActiveVoice, the SAME method Alt+1..4 and the toolbar call.
 *
 * ⭐⭐ **`'all'` is a word about a MARK, never about entry** — there is no typing into all the voices,
 * so `EditorState.activeVoice` stays 1–4 and `setActiveVoice` returns early on it
 * (docs/dynamic-voice-scope-plan.md P4). It rides this seam because the fifth button IS the fifth
 * button: one row, one press channel, one method behind it.
 */
export const createVoiceSelection = () => new PaletteSelection<1 | 2 | 3 | 4 | 'all'>()
