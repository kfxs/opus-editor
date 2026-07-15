import type { NoteDuration } from '../types/music'

/**
 * The duration to HIGHLIGHT ('q', '8', …) — or `null` for "highlight nothing" — as a TINY
 * framework-agnostic observable, the exact shape and role of {@link toolMode}.
 *
 * It is deliberately the HIGHLIGHT, not just the armed value: a duration is shown only when it means
 * something — in entry mode (the armed duration), or in selection mode with a note selected (that
 * note's duration). In selection mode with NOTHING selected there is no note to reflect and you are
 * not writing, so the value is `null` and neither the Keypad nor the Vue palette lights a key. App.vue
 * computes that rule once and mirrors the result in here.
 *
 * `EditorState.selectedDuration` remains the armed value the score reads, and `PaletteController.
 * setDuration` still owns what CHOOSING one DOES. A non-null change that comes back OUT of this store
 * (the Keypad, today) is routed through `setDuration`, so the Keypad drives the exact same path the
 * Vue button does. The Keypad reads {@link get} and repaints on {@link subscribe}, never importing Vue.
 *
 * `set` SHORT-CIRCUITS on no change, which is what stops the App.vue round-trip (store → state →
 * store) from looping.
 */
class DurationSelectionStore {
  private duration: NoteDuration | null = null
  private listeners = new Set<(duration: NoteDuration | null) => void>()

  get(): NoteDuration | null {
    return this.duration
  }

  set(duration: NoteDuration | null): void {
    if (duration === this.duration) return
    this.duration = duration
    for (const fn of this.listeners) fn(duration)
  }

  subscribe(fn: (duration: NoteDuration | null) => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }
}

/** The app's one highlighted-duration store — a module singleton, so any plain-TS module reaches it. */
export const durationSelection = new DurationSelectionStore()
