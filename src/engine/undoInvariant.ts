/**
 * The undo invariant, checked instead of promised: **a public `MusicEngine` call that changed the
 * score also asked for an undo entry.**
 *
 * `runBatch` answers "did `fn` change anything?" by counting undo REQUESTS, not by comparing
 * content — so a mutator that writes the model and asks for nothing is invisible to it: no history
 * entry, no stale render, and the next Ctrl+Z takes the edit before it. The engine has some 400
 * methods and the rule was convention across all of them.
 *
 * The check wraps every method of one engine instance. At the OUTERMOST call only (a method that
 * calls another is one edit, and a batch pushes once at its end) it compares the serialized score
 * before and after, and throws when the content moved while the request count stood still.
 *
 * Three kinds of call change the score without asking, by design, and are named here rather than
 * guessed at:
 * - {@link REPLACES_THE_SCORE} — undo, redo and load swap the whole score; they ARE the history.
 * - {@link REPAIRS_WHAT_AN_EDIT_LEFT} — the render refills measure gaps after a change. The repair
 *   belongs to the edit that made the gap, whose entry already exists.
 * - {@link defersItsUndo} — a live gesture's frames write the model and leave the entry to the
 *   gesture's commit. For these the weaker half still holds and is checked: the model was marked
 *   dirty, so the next render is not skipped.
 *
 * It serializes the score twice per call, so it is armed under the test runner only
 * ({@link isTestRun}), the way `ScoreModel`'s `STRICT_INVARIANTS` is.
 */

/** The private state the check reads. `MusicEngine` gains no accessor for a test's benefit. */
interface UndoInternals {
  undoRequests: number
  modelDirty: boolean
  scoreModel: { getScore(): unknown }
}

/** These swap the whole score for another one: they are the history, not an entry in it. */
const REPLACES_THE_SCORE: ReadonlySet<string> = new Set(['undo', 'redo', 'loadJSON'])

/** The render refills measure gaps once after a change; the edit that left the gap owns the entry. */
const REPAIRS_WHAT_AN_EDIT_LEFT: ReadonlySet<string> = new Set(['renderScore'])

/**
 * A live gesture's frame: it writes the model, and the gesture's commit asks for the one entry.
 * The NAME is the contract — every `preview*` method is such a frame (51 today, across every mark
 * family), so a list of them would be one more per-kind slice that grows with each feature.
 */
function defersItsUndo(name: string): boolean {
  return name.startsWith('preview')
}

/** Arm the check on one engine. Every own method of its prototype is wrapped on the INSTANCE. */
export function installUndoInvariant(engine: object): void {
  const internals = engine as unknown as UndoInternals
  const proto = Object.getPrototypeOf(engine) as Record<string, unknown>
  let depth = 0

  for (const name of Object.getOwnPropertyNames(proto)) {
    if (name === 'constructor') continue
    const descriptor = Object.getOwnPropertyDescriptor(proto, name)
    if (!descriptor || typeof descriptor.value !== 'function') continue
    if (REPLACES_THE_SCORE.has(name) || REPAIRS_WHAT_AN_EDIT_LEFT.has(name)) continue
    const method = descriptor.value as (...args: unknown[]) => unknown

    ;(engine as Record<string, unknown>)[name] = function (this: unknown, ...args: unknown[]) {
      if (depth > 0) return method.apply(engine, args)

      const before = JSON.stringify(internals.scoreModel.getScore())
      const requestsBefore = internals.undoRequests
      depth++
      let result: unknown
      try {
        result = method.apply(engine, args)
      } finally {
        depth--
      }
      if (internals.undoRequests > requestsBefore) return result
      if (JSON.stringify(internals.scoreModel.getScore()) === before) return result

      if (!defersItsUndo(name)) {
        throw new Error(
          `[undo invariant] MusicEngine.${name} changed the score and asked for no undo entry — ` +
          `call commit()/saveUndoState() (free inside a batch), or, for a gesture's frame, name it preview*`,
        )
      }
      if (!internals.modelDirty) {
        throw new Error(
          `[undo invariant] MusicEngine.${name} defers its undo entry but did not mark the model ` +
          `dirty — the next render would be skipped`,
        )
      }
      return result
    }
  }
}
