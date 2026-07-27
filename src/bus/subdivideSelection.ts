import { PaletteSelection } from './paletteSelection'

/**
 * The SUBDIVIDE key (secondary beam break) shared between the editor and the Keypad (`/` on the
 * Beams/Tremolos page). On or off, a nullable single value like the tie — `'subdivide'` when the
 * selected note carries a `secondaryBreak`, `null` otherwise — engine-read (the flag is not a reactive
 * field), so `PaletteController.refreshSubdivideSelection` pushes the highlight after every toggle and
 * on selection changes. A Keypad press routes OUT through `toggleSecondaryBreak`, the SAME method the
 * dev toolbar's `subdivide` button calls.
 */
export const createSubdivideSelection = () => new PaletteSelection<'subdivide'>()
