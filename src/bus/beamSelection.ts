import type { BeamMode } from '@/types/music'
import { PaletteToggleSet } from './paletteToggleSet'

/**
 * The beam MODE keys shared between the editor and the Keypad (`single` / `begin` / `continue` /
 * `end` on the Beams/Tremolos page). A SET, not a single value — the same reason the dev toolbar's
 * beam row lights up to TWO buttons: a key is lit when it is either the note's authored beam OR the
 * role it actually ends up in (`beamHighlight` ∪ `beamRoleHighlight`), and those can differ (an
 * orphaned `end` authored, engraved `single`). `'auto'` never lights — it is no key on the pad.
 *
 * `PaletteController.setBeam` still owns what a press DOES (arm the mode, apply it across a selection),
 * and pushes the lit set back via `refreshBeamSelection` because the role is engine-read, not a
 * reactive field. A Keypad press routes OUT through that same `setBeam`.
 */
export const createBeamSelection = () => new PaletteToggleSet<BeamMode>()
