/**
 * The ONE emitter behind the bus's command-only seams (docs/plans/code-shape-plan-2026-09-19.md, Phase 5).
 *
 * Nineteen stores each spelled the same class: a listener set, a publish that walks it, a subscribe
 * that returns its own unsubscribe. What differed was the REQUEST — so a seam's module now declares
 * its request type, says why the seam exists, and builds one of these.
 *
 * ⭐ **A publish ALWAYS fires.** There is no "unchanged" short-circuit, on purpose: re-typing the same
 * number, or re-choosing the armed value, is a real event, and the controller that holds the engine
 * decides it is a no-op. ⛔ A seam that mirrors STATE (and so must swallow a repeat) is not one of
 * these — see {@link ./paletteSelection}'s HIGHLIGHT channel and {@link ./selectionInspection}.
 */
class Listeners<T> {
  private listeners = new Set<(value: T) => void>()

  fire(value: T): void {
    for (const fn of this.listeners) fn(value)
  }

  add(fn: (value: T) => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }
}

/** A window writes "set THIS to X"; the controller that holds the engine applies it. */
export class RequestChannel<T> {
  private listeners = new Listeners<T>()

  /** Publish a request. ALWAYS fires. */
  set(req: T): void {
    this.listeners.fire(req)
  }

  /** Handle a request. Returns the unsubscribe. */
  onSet(fn: (req: T) => void): () => void {
    return this.listeners.add(fn)
  }
}

/** The same channel in the PALETTE's words: the user chose this value — "arm it (again)". */
export class PressChannel<T> {
  private listeners = new Listeners<T>()

  /** The user chose this value. ALWAYS fires — re-choosing the armed one means "arm it again". */
  press(value: T): void {
    this.listeners.fire(value)
  }

  /** Handle a press. Returns the unsubscribe. */
  onPress(fn: (value: T) => void): () => void {
    return this.listeners.add(fn)
  }
}
