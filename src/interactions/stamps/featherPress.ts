/**
 * ⭐ **The `accel.` / `rit.` press with NOTHING selected — it arms the fan STAMP** (his rule, 2026-09-24: *"when
 * nothing is selected, pressing the fan buttons in the pallete does nothing, it should arm stamp the fan similar
 * to default in the fan dialog but taking into acount if the click was in rit or accel"* — and *"in the case a
 * note is armed for stamp, then the fan button arm stamp but with the duration of the note selected"*).
 *
 * - Nothing selected, a note duration ARMED for entry → the stamp at THAT duration (and its dots);
 * - nothing selected otherwise → the Feathered Beam window's opening values (`DEFAULT_FAN_COUNT` attacks over
 *   `DEFAULT_FEATHER_UNIT`);
 * - either way in the PRESSED direction; the fan stamp already armed in that direction → a re-press DISARMS
 *   it (every stamp's rule); armed the other way → it turns round, keeping its attacks and value.
 * - ⛔ A note SELECTED (in entry mode too) is not this module's: `PaletteController.pressFan` marks it, as always.
 *
 * It ARMS by the dialog's own route — `bus.fanStamp.press`, which the palette answers with `armFanStamp` — so a
 * press and the window's OK arm one stamp one way; only the DISARM is handed in.
 */
import { bus } from '@/bus'
import type { ArmedFanStamp } from '@/bus'
import { DEFAULT_FAN_COUNT, DEFAULT_FEATHER_UNIT } from '@/utils/fannedBeam'
import { armedTool, type EditorState } from '../state/EditorState'

/** @returns the stamp to arm, or `null` to DISARM (the same direction pressed again). */
export function fanStampForPress(state: EditorState, direction: 'accel' | 'rit'): ArmedFanStamp | null {
  const armed = armedTool(state, 'fan')
  if (armed) return armed.direction === direction ? null : { attacks: armed.attacks, unit: armed.unit, dots: armed.dots, direction }
  if (state.selectedTool === 'entry') {
    return { attacks: DEFAULT_FAN_COUNT, unit: state.selectedDuration, dots: state.selectedDots, direction }
  }
  return { attacks: DEFAULT_FAN_COUNT, unit: DEFAULT_FEATHER_UNIT, dots: 0, direction }
}

/**
 * ⭐ The palette's whole branch: with NOTHING selected, arm (or disarm) the stamp and answer `true`; with a
 * selection, answer `false` and leave the press to `pressFan`'s own rules.
 */
export function pressWithNothingSelected(state: EditorState, direction: 'accel' | 'rit', disarm: () => void): boolean {
  if (state.selectedNoteId || state.selectedItems.size > 0) return false
  const armed = fanStampForPress(state, direction)
  if (armed) bus.fanStamp.press(armed)
  else disarm()
  return true
}

/** ⭐ The armed stamp's direction, or null — what lights `accel.` / `rit.` while it waits for its click. */
export function armedFeatherDirection(state: EditorState): 'accel' | 'rit' | null {
  return armedTool(state, 'fan')?.direction ?? null
}
