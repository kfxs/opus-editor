import { PaletteSelection } from './paletteSelection'

/**
 * **Does playback take the repeats?** — shared between the dev toolbar's 🔁 checkbox and the bar's
 * Play ▸ Play Repeats row. See {@link PaletteSelection} for the two-channel shape: HIGHLIGHT is
 * whether repeats are in force (both surfaces read it — one to tick, one to check its box), PRESS is
 * a user asking for a value.
 *
 * ⭐ **THE REASON IT EXISTS is `bus/soundSelection`'s, verbatim:** the dev checkbox shipped an hour
 * before the menu row and read the ENGINE directly, which was fine while it was the only surface. A
 * second one makes that a second truth — the checkbox syncs on the editor's state notification, and
 * toggling repeats writes no state, so the menu could turn them off and leave the box still ticked.
 * One seam, two subscribers, no copies.
 *
 * ⚠️ **NOT score data, unlike the sound next door** — and the difference matters to what this store
 * has to do. A sound is a statement about the music, so it lives in `Score.playback` and an UNDO can
 * move it, which is why `soundSync` subscribes to the model. *"Take the repeats"* is a statement
 * about this HEARING: it is not in the JSON, it does not undo, and nothing but a press can change it.
 * So the highlight is mirrored after a press and there is no model subscription to forget.
 */
export const createPlayRepeatsSelection = () => new PaletteSelection<boolean>()
