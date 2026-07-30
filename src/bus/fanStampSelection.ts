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

/**
 * ⭐ **WHAT THE SELECTION ALREADY ANSWERS** — pushed the other way, for the dialog to show and to
 * refuse editing.
 *
 * His rule for a MULTI-selection: *"number of notes and durations are forbidden (but somehow reflect
 * the selection…) so the user just can select open or close"*. A passage of notes IS the gesture —
 * how many attacks it has and how long it lasts are facts about what was selected, not choices — so
 * the window greys those fields and shows them, and only the direction stays live.
 *
 * `quarters` is the passage's TOTAL length, which the window approximates to the nearest value it can
 * draw: a run of seven sixteenths lasts 7/4 of a quarter and no single notehead spells it, which is
 * exactly why the field is a report rather than an input.
 */
export interface FanStampContext {
  /** How many NOTES are selected — 0 or 1 mean the dialog asks its own questions as usual. */
  notes: number
  /** Their total length in quarters, or 0 when there is nothing to measure. */
  quarters: number
}

export class FanStampSelection {
  private listeners = new Set<(armed: ArmedFanStamp) => void>()
  private contextListeners = new Set<(context: FanStampContext) => void>()
  private context: FanStampContext = { notes: 0, quarters: 0 }

  /** The user asked for this feather. ALWAYS fires — re-choosing the armed one means "arm it again". */
  press(armed: ArmedFanStamp): void {
    for (const fn of this.listeners) fn(armed)
  }

  onPress(fn: (armed: ArmedFanStamp) => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  /** The editor's side: what is selected now. De-duped, since this fires on every state change and
   *  a window that repaints on each one fights the user's own typing. */
  setContext(context: FanStampContext): void {
    if (context.notes === this.context.notes && context.quarters === this.context.quarters) return
    this.context = context
    for (const fn of this.contextListeners) fn(context)
  }

  /** What the selection says right now — read once when the window opens, since a dialog is built
   *  after the selection was made. */
  getContext(): FanStampContext {
    return this.context
  }

  onContext(fn: (context: FanStampContext) => void): () => void {
    this.contextListeners.add(fn)
    return () => this.contextListeners.delete(fn)
  }
}

export const createFanStampSelection = () => new FanStampSelection()
