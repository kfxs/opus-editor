import { PaletteSelection } from './paletteSelection'

/**
 * Whether the thing selected in the score IS A REST, shared between the editor and the Keypad (the
 * `0` key). A nullable single value — `'rest'` or `null` — over {@link PaletteSelection}.
 *
 * It completes the picture the duration keys start. Selecting a quarter rest already lights the
 * quarter key (SelectionController syncs `selectedDuration` from any slot, rest or not), so the panel
 * says "quarter" and stops — the same thing it says for a quarter NOTE. The rest key is the other
 * half of the statement: quarter + rest = a quarter rest, which is how Sibelius's numpad reads too.
 *
 * The tie's shape and the tie's sync: `note.isRest` is read live from the engine, not from a reactive
 * `state.*` field, so no mirror can compute it — {@link PaletteController.refreshRestSelection} pushes
 * it, driven by keypadSync's `sync()` on every state change.
 *
 * HIGHLIGHT ONLY, for now: nothing subscribes to the press channel, because "make this a rest" /
 * "make this a note again" is not an operation the editor has (deleting a note leaves a rest behind
 * via restFill; a rest has no pitch to turn back into). The key reports; it does not yet act.
 */
export const restSelection = new PaletteSelection<'rest'>()
