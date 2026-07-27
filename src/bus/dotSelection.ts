import { PaletteSelection } from './paletteSelection'

/**
 * The dot shared between the editor and the Keypad (the `.` key). A note is dotted or it is not, so
 * this is a nullable single value like the accidental — `'dot'` when the armed/selected note carries a
 * dot, `null` otherwise — over the same two channels ({@link PaletteSelection}). The PRESS channel is
 * what lets the `.` key toggle OFF: `toggleDot` sees it pressed again and clears the dot, exactly as
 * re-pressing an armed accidental does; a plain state-mirror would swallow the repeat as "no change".
 *
 * `EditorState.selectedDots` stays the armed count (0/1) the score reads and `PaletteController.toggleDot`
 * owns the work. Unlike the articulations, `selectedDots` IS a reactive field kept in sync in both
 * modes, so App.ts mirrors dots→highlight in with a plain computed and routes a Keypad press out
 * through toggleDot — no controller-side push needed.
 */
export const createDotSelection = () => new PaletteSelection<'dot'>()
