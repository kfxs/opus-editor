import type { NoteDuration } from '@/types/music'

/**
 * The feather the Feathered Beam window ({@link ../windows/featherWindow}) asked for, published for
 * `keypadSync` to route into `PaletteController.armFanStamp` — the same seam
 * {@link ./tupletSelection} and {@link ./clefSelection} use, and for the same reason: a window
 * cannot see the controllers, and neither should it.
 *
 * ⚠️ **A second fan channel, deliberately, and not a value of {@link ./fanSelection}.** That one is
 * the Keypad's `accel.`/`rit.` radio: it acts on notes that ALREADY EXIST (press it with a passage
 * selected and the passage collapses into one gesture) and it reports a highlight back. This one
 * arms a STAMP for notes that do not exist yet, and has nothing to light. Two directions of travel,
 * two channels — folding them together would give the radio a press that means "arm" and the stamp
 * a highlight that means nothing.
 *
 * The payload is what the dialog was TOLD — "6 attacks in the time of a half, opening" — not the
 * {@link FanMark} it comes to. The mark is built where the note is placed (`interactions/fanStamp`),
 * so the window cannot arm a shape the stamp would have built differently.
 */
export interface ArmedFanStamp {
  /** How many attacks the gesture is played and drawn as — `FanMark.count`. */
  attacks: number
  /** The written value the gesture is squeezed into, and whether it is dotted: the DURATION of the
   *  note the stamp places. The fan's `length` therefore stays absent — "exactly this note's
   *  duration" is what the dialog just said. */
  unit: NoteDuration
  dots: number
  /** Which way the ramp runs — the dialog's *Open feather* / *Close feather*, in the model's own
   *  spelling so nothing has to translate it. */
  direction: 'accel' | 'rit'
}

export class FanStampSelection {
  private listeners = new Set<(armed: ArmedFanStamp) => void>()

  /** The user asked for this feather. ALWAYS fires — re-choosing the armed one means "arm it again". */
  press(armed: ArmedFanStamp): void {
    for (const fn of this.listeners) fn(armed)
  }

  onPress(fn: (armed: ArmedFanStamp) => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }
}

export const createFanStampSelection = () => new FanStampSelection()
