import type { NoteDuration, TupletFormat } from '@/types/music'

/**
 * The tuplet the Tuplet window ({@link ../windows/tupletWindow}) asked for, published for
 * `keypadSync` to route into `PaletteController.armTupletInTimeOf` — the same seam
 * {@link ./clefSelection} and {@link ./timeSignatureSelection} use, and for the same reason: a
 * window cannot see the controllers, and neither should it.
 *
 * The payload is what the user TYPED — "3 ♪ in the time of 1 ♩" — and not the `TupletShape` it comes
 * to. The window already resolves it to decide whether OK is even possible, so it could send the
 * shape; sending the entry instead keeps ONE place that turns a sentence into a shape
 * (`resolveTupletInTimeOf`, reached through the controller), so the window cannot arm a shape the
 * palette would have built differently.
 */
export interface ArmedTuplet {
  /** N — how many notes are played. */
  numNotes: number
  /** The value those N notes are written as, and whether it is dotted. */
  unit: NoteDuration
  unitDots: number
  /** M and its value — the time the group replaces. */
  normalCount: number
  normalUnit: NoteDuration
  normalDots: number
  /** The dialog's *Format* box — how the group will be DRAWN. It travels with the entry because it
   *  is decided in the same breath, before the notes it describes exist. */
  format?: TupletFormat
}

export class TupletSelection {
  private listeners = new Set<(armed: ArmedTuplet) => void>()

  /** The user chose this tuplet. ALWAYS fires — re-choosing the armed one means "arm it again". */
  press(armed: ArmedTuplet): void {
    for (const fn of this.listeners) fn(armed)
  }

  onPress(fn: (armed: ArmedTuplet) => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }
}

export const createTupletSelection = () => new TupletSelection()
