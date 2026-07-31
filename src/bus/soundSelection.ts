import { PaletteSelection } from './paletteSelection'

/**
 * The score's playback SOUND — a General MIDI program number — shared between the dev toolbar's
 * picker and the bar's Play ▸ Score Sound submenu. See {@link PaletteSelection} for the two-channel
 * shape: HIGHLIGHT is which sound is in force (both surfaces read it to tick / to set the dropdown),
 * PRESS is a user choosing one.
 *
 * ⭐ THE REASON IT EXISTS AT ALL: two surfaces now offer the same choice, and the dev picker used to
 * BE the state — the `<select>`'s own value was the only record of what was playing. A second
 * surface would then have been a second truth, and whichever you used last would silently disagree
 * with the other. One seam, two subscribers, no copies.
 *
 * ⚠️ TEMPORARY, like the list it carries (`DEV_SOUNDS`). One program for the WHOLE score is not an
 * instrument model — it is "what does Play sound like today". When per-staff instruments are
 * designed (docs/instruments-plan.md: a lane→instrument map, positional), this store and the menu
 * row that reads it both go. That is why the menu says *Score* Sound: the word admits the scope.
 */
export const createSoundSelection = () => new PaletteSelection<number>()
