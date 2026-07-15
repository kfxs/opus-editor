import type { ArticulationType } from '../types/music'
import { PaletteToggleSet } from './paletteToggleSet'

/**
 * The articulations shared between the editor and the Keypad (the accent / staccato / tenuto keys).
 * See {@link PaletteToggleSet} for the set-valued two-channel shape — articulations are independent
 * toggles, so the highlight is a SET, unlike the single-valued duration/accidental selections.
 *
 * `EditorState.accent/staccato/tenuto` stay the armed entry-mode flags, and
 * `PaletteController.toggleAccent/Staccato/Tenuto` still own what pressing one DOES — including the
 * toggle across a selection, and the arm-for-next-note fallback. Because that "active" state is read
 * live from the engine (not a reactive field), PaletteController pushes the highlight itself after a
 * toggle, and App.vue mirrors it on selection/entry changes; a Keypad press routes OUT through the
 * same toggleX.
 */
export const articulationSelection = new PaletteToggleSet<ArticulationType>()
