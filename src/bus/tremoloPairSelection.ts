import { PaletteSelection } from './paletteSelection'

/**
 * The TWO-NOTE tremolo key shared between the editor and the Keypad — Sibelius's `Enter` on the
 * Beams/Tremolos page, whose picture (two half notes joined by a bar) was drawn there long before
 * anything was behind it.
 *
 * On or off, a nullable sentinel like the tie and the subdivide. ⚠️ A SECOND AXIS beside
 * {@link tremoloSelection}, never one of its values: the count says how fast, the pair says the
 * strokes go between two notes, and both are true at once — so this lights BESIDE the count key
 * rather than instead of it (docs/two-note-tremolo-plan.md §4).
 *
 * A press routes OUT through `pressTremoloPair`, the same method the dev toolbar's button calls.
 */
export const createTremoloPairSelection = () => new PaletteSelection<'tremoloPair'>()
