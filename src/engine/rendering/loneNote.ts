/**
 * ⭐ **A NOTE FORMATTED ALONE** — the cursor ghosts' one-note bar (S11b–d, `docs/vexflow-removal-map.md`
 * S11), through the score's own pipeline: `BarVoice`, our modifier columns, our tick columns. Where a
 * bare VexFlow `Voice` + `Formatter` used to give a ghost's note the tick context it will not draw
 * without.
 *
 * ⚠️ Only the ink's SHAPE survives a ghost's parking — the group is moved by its ink box — so the
 * meter and width are the old throwaway voice's, kept, not chosen.
 */
import type { EngravedNote } from './EngravedNote'
import type { EngravedStave } from './EngravedStave'
import { BarVoice } from './barVoice'
import { attachModifierColumns } from './modifierColumns'
import { formatColumns } from './columnFormat'
import { standOn } from './staveFrame'

/**
 * Format `note`, already on `stave` and carrying its modifiers, as the only note of a soft `meter` bar
 * `width` px wide — its tick x, and its modifiers stacked by the page's rules.
 */
export function formatLoneNote(
  note: EngravedNote, stave: EngravedStave, meter: { numerator: number; denominator: number }, width: number,
): void {
  const voices = [new BarVoice(meter, 'soft').add(note)]
  attachModifierColumns(voices)
  formatColumns(voices, width)
  standOn(note, stave)
}
