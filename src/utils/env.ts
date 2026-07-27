/**
 * The score layer's only look at its host environment.
 *
 * `import.meta.env` is Vite's and Vite's alone. Reading it from inside the core fence
 * (`engine/models/**`, `utils/**`, `types/**`) is the one thing that would make a published core
 * package require one specific bundler — and it was the only such coupling left in there
 * (docs/refactor-plan-2026-07-27.md Phase 0d). `process.env` is the neutral spelling instead: Node
 * sets it, every bundler statically replaces it, and a plain Node consumer of the package has it
 * for free without a build step at all.
 *
 * Reached through `globalThis` rather than a bare `process` for two reasons: the project carries no
 * `@types/node`, so the bare identifier does not type-check; and a browser with no shim has no
 * `process` whatsoever. Absent is read as "not a test run", which is the safe direction — see the
 * consumer in {@link ScoreModel} for why a false negative only ever costs a thrown error, never
 * correctness.
 */

/**
 * True when running under the unit-test runner (Vitest sets both of these).
 *
 * ⚠️ This is an assertion about the REPOSITORY, not about the music, so per the convention in
 * docs/refactor-plan-2026-07-27.md Phase 0c it has a test behind it rather than a promise in a
 * comment: `env.test.ts` fails if the runner stops being detected. That test is the whole reason
 * this lives in its own module — the flag it feeds (`ScoreModel`'s `STRICT_INVARIANTS`) is private,
 * so a silent `false` there would disarm the measure-integrity check in all ~2500 tests while
 * every one of them still passed.
 */
export function isTestRun(): boolean {
  try {
    const env = (globalThis as { process?: { env?: Record<string, string | undefined> } })
      .process?.env
    if (!env) return false
    return env.VITEST !== undefined || env.NODE_ENV === 'test'
  } catch {
    // A host that throws on `globalThis.process` is not a test runner either.
    return false
  }
}
