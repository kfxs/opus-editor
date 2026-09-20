/**
 * Subject: `./clefMeterGap` — the clef→meter table, and the invariant that makes it worth having.
 *
 * ⭐ The interesting assertion is not any row's value (those are citations, and a spec that repeats
 * them proves nothing). It is that **the reservation and the drawing read ONE number** — the pair
 * `own-engraving-engine.md` §P5 is named after, closed here for the last gap of the header run that
 * still had two (`docs/research/header-spacing-research.md` §4.4).
 */
import { describe, it, expect, afterEach } from 'vitest'
import {
  ACTIVE_CLEF_METER_RULE, CLEF_METER_RULES, armedClefMeterInk, clefMeterGapGeneration,
  clefMeterSettings, resetClefMeterRule, setClefMeterRule,
} from './clefMeterGap'
import { clefToMeterGap } from './headerInk'
import { METER_PART_LEFT_AIR } from './keySignatureLayout'

afterEach(() => resetClefMeterRule())

describe('the armed rule', () => {
  it('✅ ships `stone` — 1.0 sp, HIS call 2026-09-12', () => {
    expect(ACTIVE_CLEF_METER_RULE).toBe('stone')
    expect(armedClefMeterInk()).toBe(1.0)
  })

  it('⭐ every row is INK, in a sane engraving range, and cites a source', () => {
    for (const [name, rule] of Object.entries(CLEF_METER_RULES)) {
      // ⛔ Not a value check — a guard that a row added later is a gap and not, say, a px padding
      //    or an origin-to-origin number, which is the conversion the module header forbids.
      expect(rule.ink, `${name} is a clear white gap in staff spaces`).toBeGreaterThan(0.5)
      expect(rule.ink, `${name}`).toBeLessThan(2)
      expect(rule.source.length, `${name} cites where its number comes from`).toBeGreaterThan(10)
    }
  })

  it('⛔ an unknown name is REFUSED, not ignored — a console typo must not look like it worked', () => {
    expect(setClefMeterRule('nope' as never)).toBe(false)
    expect(clefMeterSettings().rule).toBe(ACTIVE_CLEF_METER_RULE)
  })

  it('🚨 arming BUMPS THE GENERATION — it is a WIDTH, and both render keys read this', () => {
    // Leave it out of `layoutStateKey` / `laneFingerprint` and arming a row hands back memoised
    // widths while the console reports success (`reference_render_width_key_vs_shape_key`).
    const before = clefMeterGapGeneration()
    expect(setClefMeterRule('lilypond')).toBe(true)
    expect(clefMeterGapGeneration()).toBeGreaterThan(before)
    const armed = clefMeterGapGeneration()
    resetClefMeterRule()
    expect(clefMeterGapGeneration(), 'resetting is a change too').toBeGreaterThan(armed)
  })
})

describe('⭐⭐ ONE number, two consumers — the invariant', () => {
  it('🚨 the BOX gap the width model charges is the armed INK gap, less the meter’s left air', () => {
    // The subtraction `keyToMeterGap()` has always made and this pair never did: until 2026-09-12 it
    // was charged a flat BETWEEN_PARTS with the air left IN, so the model reserved ≈1.6 sp of ink
    // gap while the drawing used 1.42. Two numbers, one distance, neither chosen.
    for (const name of Object.keys(CLEF_METER_RULES)) {
      setClefMeterRule(name as never)
      expect(clefToMeterGap()).toBeCloseTo(armedClefMeterInk() - METER_PART_LEFT_AIR, 10)
    }
  })

  it('⭐ …so arming a row moves the reservation by exactly what it moves the ink', () => {
    setClefMeterRule('stone')
    const [inkA, boxA] = [armedClefMeterInk(), clefToMeterGap()]
    setClefMeterRule('lilypond')
    expect(armedClefMeterInk() - inkA).toBeCloseTo(clefToMeterGap() - boxA, 10)
  })
})
