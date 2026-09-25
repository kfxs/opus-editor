import { describe, it, expect, afterEach } from 'vitest'
import {
  ACTIVE_DOT_TIE_RULE, DOT_TIE_RULES, armedDotTie, dotTieGeneration, dotTieSettings, resetDotTieRule, setDotTieRule,
} from './dotTie'

afterEach(() => resetDotTieRule())

describe('a dotted note tied (docs/plans/multiple-dots-plan.md R7)', () => {
  it('✅ ships `gould` — the dot within the tie, which is what we draw (P3, P4g measured)', () => {
    expect(ACTIVE_DOT_TIE_RULE).toBe('gould')
    expect(armedDotTie().afterDots).toBeNull()
    for (const row of Object.values(DOT_TIE_RULES)) expect(row.source.length).toBeGreaterThan(0)
  })

  it('`gerouLusk` starts the tie AFTER the dots — its white UNKNOWN (their figures draw no dot), read as 0', () => {
    setDotTieRule('gerouLusk')
    expect(armedDotTie().afterDots).toBe(0)
  })

  it('arming bumps the generation; an unknown row is refused', () => {
    const before = dotTieGeneration()
    expect(setDotTieRule('gerouLusk')).toBe(true)
    expect(dotTieGeneration()).toBeGreaterThan(before)
    expect(setDotTieRule('nope' as never)).toBe(false)
    expect(dotTieSettings().rule).toBe('gerouLusk')
  })
})
