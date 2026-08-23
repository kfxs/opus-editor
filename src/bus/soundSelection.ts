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
 * ⚠️ STILL ONE SOUND FOR THE WHOLE SCORE — but no longer a passing thought. Since 2026-08-23 the
 * value it carries lives in the score itself (`Score.playback`, `engine/models/soundOps`), so it
 * persists, undoes and travels with the file; what stays provisional is the SCOPE (every staff,
 * every voice) and the curated GM list (`DEV_SOUNDS`). When per-staff / per-voice sounds land
 * (docs/instruments-plan.md P1b/P2) this store gains a lane or gives way to one that has it. That is
 * why the menu says *Score* Sound: the word admits the scope.
 *
 * ⚠️ Its HIGHLIGHT is mirrored from the score, not from the last press — see `interactions/soundSync`:
 * an undo can change the sound with nobody pressing anything.
 */
export const createSoundSelection = () => new PaletteSelection<number>()
