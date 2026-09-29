/**
 * Subject: `./doubleBarlineGap` — the thin double's gap as a preset table, Gould default. ⭐ The row
 * VALUES are citations; what is pinned is the default, the plate-over-prose ordering, the refusal, and
 * that arming moves the width generation.
 */
import { describe, it, expect, afterEach } from 'vitest'
import {
  ACTIVE_DOUBLE_BARLINE_GAP_RULE, DOUBLE_BARLINE_GAP_RULES, armedDoubleBarlineGap, doubleBarlineGapGeneration,
  doubleBarlineGapSettings, resetDoubleBarlineGapRule, setDoubleBarlineGapRule,
} from './doubleBarlineGap'
import { widthRowGenerations } from './widthRowGenerations'

afterEach(() => resetDoubleBarlineGapRule())

describe('the thin double barline gap', () => {
  it('✅ ships `gould` — what she ENGRAVES, 0.30 sp', () => {
    expect(ACTIVE_DOUBLE_BARLINE_GAP_RULE).toBe('gould')
    expect(armedDoubleBarlineGap()).toBe(0.30)
  })

  it('🚨 the plate beats the sentence — the `prose` row (¾ apart) is wider than what she draws', () => {
    expect(DOUBLE_BARLINE_GAP_RULES.prose.gap).toBeGreaterThan(DOUBLE_BARLINE_GAP_RULES.gould.gap)
  })

  it('⭐ every row is a white gap in a sane range, and cites a source', () => {
    for (const [name, rule] of Object.entries(DOUBLE_BARLINE_GAP_RULES)) {
      expect(rule.gap, name).toBeGreaterThan(0.1)
      expect(rule.gap, name).toBeLessThan(1)
      expect(rule.source.length, `${name} cites where its number comes from`).toBeGreaterThan(10)
    }
  })

  it('arms a row, and reset goes back to Gould', () => {
    expect(setDoubleBarlineGapRule('musescore')).toBe(true)
    expect(armedDoubleBarlineGap()).toBe(0.37)
    resetDoubleBarlineGapRule()
    expect(doubleBarlineGapSettings().rule).toBe('gould')
  })

  it('⛔ an unknown name is REFUSED, not ignored — a console typo must not look like it worked', () => {
    expect(setDoubleBarlineGapRule('nope' as never)).toBe(false)
    expect(doubleBarlineGapSettings().rule).toBe(ACTIVE_DOUBLE_BARLINE_GAP_RULE)
  })

  it('🚨 arming BUMPS THE GENERATION, and the width keys read it', () => {
    const before = doubleBarlineGapGeneration()
    const keys = widthRowGenerations().join()
    setDoubleBarlineGapRule('verovio')
    expect(doubleBarlineGapGeneration()).toBe(before + 1)
    expect(widthRowGenerations().join()).not.toBe(keys)
  })
})
