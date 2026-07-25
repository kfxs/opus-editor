import { PaletteSelection } from './paletteSelection'

/**
 * The BEAM-REST key (beam over a rest) shared between the editor and the Keypad (`-` on the
 * Beams/Tremolos page). On or off like the subdivide, engine-read: `'beamOver'` when the selected REST
 * carries the flag, `null` otherwise (and always null for a note — the mark applies to nothing else).
 * `PaletteController.refreshBeamOverSelection` pushes the highlight after every toggle and on selection
 * changes; a Keypad press routes OUT through `toggleBeamOver`, the SAME method the dev toolbar's
 * `beam rest` button calls.
 */
export const beamOverSelection = new PaletteSelection<'beamOver'>()
