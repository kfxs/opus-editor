import { PaletteSelection } from './paletteSelection'

/**
 * The tie shared between the editor and the Keypad (the Enter key). A note is tied to the next slot or
 * it is not, so this is a nullable single value — `'tie'` when the selected note carries a tie, `null`
 * otherwise — over the two channels of {@link PaletteSelection}. The PRESS channel always fires so the
 * key toggles OFF on a re-press, the way `toggleTie` removes an existing tie.
 *
 * It is the DOT's shape but the ARTICULATION's sync: `note.tiedTo` is read live from the engine, not a
 * reactive `state.*` field, so the highlight cannot be mirrored by an App.ts computed. Instead
 * `PaletteController.refreshTieSelection` pushes it — after every `toggleTie` (all sources funnel
 * there) and on the selection-change poke — exactly like {@link articulationSelection}. Tie is a
 * selection-mode action only: there is no armed "entry-mode tie".
 */
export const tieSelection = new PaletteSelection<'tie'>()
