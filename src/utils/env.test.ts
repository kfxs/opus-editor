import { describe, expect, it } from 'vitest'
import { isTestRun } from './env'

/**
 * The check behind a repo fact (docs/refactor-plan-2026-07-27.md Phase 0c).
 *
 * `ScoreModel`'s `STRICT_INVARIANTS` is a private const fed by `isTestRun()`, and it decides whether
 * a malformed bar THROWS or merely logs. If runner detection ever broke, the integrity check would
 * quietly downgrade to a `console.error` in every test in the suite — and the suite would stay green,
 * because a test that produces a bad bar would no longer fail on it. Nothing else in the codebase
 * would notice. So the detection gets an assertion of its own.
 */
describe('isTestRun', () => {
  it('detects the unit-test runner — the fact STRICT_INVARIANTS rides on', () => {
    expect(isTestRun()).toBe(true)
  })
})
