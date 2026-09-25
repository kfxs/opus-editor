import { describe, it, expect, afterEach } from 'vitest'
import {
  ACTIVE_REST_DOT_GAP_RULE, REST_DOT_GAP_RULES, armedRestDotGap, resetRestDotGapRule, restDotGapGeneration,
  restDotGapSettings, setRestDotGapRule,
} from './restDotGap'
import { armedDotGap, resetDotGapRule, setDotGapRule } from './dotGap'

afterEach(() => { resetRestDotGapRule(); resetDotGapRule() })

describe('the rest’s dot rows (docs/plans/multiple-dots-plan.md R4)', () => {
  it('✅ ships `gould` — her plates, 0.40 off the rest and 0.25 between dots', () => {
    expect(ACTIVE_REST_DOT_GAP_RULE).toBe('gould')
    expect(armedRestDotGap()).toEqual({ head: 0.4, dot: 0.25, source: expect.any(String) })
  })

  it('every row names its source', () => {
    for (const row of Object.values(REST_DOT_GAP_RULES)) expect(row.source.length).toBeGreaterThan(0)
  })

  it('`vexflow` is what a rest drew until 2026-09-25 — measured 0.2 / 0.1 (`e2e/dots.e2e.ts`)', () => {
    setRestDotGapRule('vexflow')
    expect(armedRestDotGap()).toMatchObject({ head: 0.2, dot: 0.1 })
  })

  it('⭐ `followNotes` is the NOTE’s armed row, whichever it is', () => {
    setRestDotGapRule('followNotes')
    expect(armedRestDotGap()).toEqual(armedDotGap())
    setDotGapRule('verovio')
    expect(armedRestDotGap()).toMatchObject({ head: 0.3, dot: 0.35 })
  })

  it('arming bumps the generation (a WIDTH); an unknown row is REFUSED and changes nothing', () => {
    const before = restDotGapGeneration()
    expect(setRestDotGapRule('lilypond')).toBe(true)
    expect(restDotGapGeneration()).toBeGreaterThan(before)
    expect(setRestDotGapRule('nope' as never)).toBe(false)
    expect(restDotGapSettings().rule).toBe('lilypond')
  })
})
