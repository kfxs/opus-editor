/**
 * Subject: `./barlineMeterGap` — the barline→meter table, and the invariant that makes it worth
 * having: **the reservation and the drawing read ONE number.**
 *
 * ⭐ The row VALUES are citations and a spec repeating them proves nothing. What is pinned here is
 * the pair `own-engraving-engine.md` §P5 is named after, and the branch that decides WHICH gap a
 * meter pays — the one thing about this table that is logic rather than a number.
 */
import { describe, it, expect, afterEach } from 'vitest'
import {
  ACTIVE_BARLINE_METER_RULE, BARLINE_METER_RULES, armedBarlineMeterInk, barlineMeterGapGeneration,
  barlineMeterSettings, resetBarlineMeterRule, setBarlineMeterRule,
} from './barlineMeterGap'
import { barlineToMeterGap, clefToMeterGap, headerExtent } from './headerInk'
import { METER_PART_LEFT_AIR } from './keySignatureLayout'
import type { Clef, TimeSignature } from '@/types/music'

const CLEF: { clef: Clef; small: boolean } = { clef: 'treble', small: true }
const METER: TimeSignature = { numerator: 4, denominator: 4 }

afterEach(() => resetBarlineMeterRule())

describe('the armed rule', () => {
  it('✅ ships `gerouLusk` — 0.75 sp, HIS call 2026-09-13 after asking for less than the books', () => {
    expect(ACTIVE_BARLINE_METER_RULE).toBe('gerouLusk')
    expect(armedBarlineMeterInk()).toBe(0.75)
  })

  it('⭐ the BOOKS’ row is still there, and it is higher — his eye went below the treatises', () => {
    // ⚠️ Worth pinning as a FACT about this table: the armed number is not the sourced consensus,
    //    it is the row the engines share. `books` is the citation for going back.
    expect(BARLINE_METER_RULES.books.ink).toBe(1.0)
    expect(armedBarlineMeterInk()).toBeLessThan(BARLINE_METER_RULES.books.ink)
  })

  it('⭐ every row is INK, in a sane engraving range, and cites a source', () => {
    for (const [name, rule] of Object.entries(BARLINE_METER_RULES)) {
      expect(rule.ink, `${name} is a clear white gap in staff spaces`).toBeGreaterThanOrEqual(0.5)
      expect(rule.ink, `${name}`).toBeLessThan(2)
      expect(rule.source.length, `${name} cites where its number comes from`).toBeGreaterThan(10)
    }
  })

  it('⛔ an unknown name is REFUSED, not ignored — a console typo must not look like it worked', () => {
    expect(setBarlineMeterRule('nope' as never)).toBe(false)
    expect(barlineMeterSettings().rule).toBe(ACTIVE_BARLINE_METER_RULE)
  })

  it('🚨 arming BUMPS THE GENERATION — it is a WIDTH, and both render keys read this', () => {
    const before = barlineMeterGapGeneration()
    expect(setBarlineMeterRule('books')).toBe(true)
    expect(barlineMeterGapGeneration()).toBeGreaterThan(before)
    const armed = barlineMeterGapGeneration()
    resetBarlineMeterRule()
    expect(barlineMeterGapGeneration(), 'resetting is a change too').toBeGreaterThan(armed)
  })
})

describe('⭐⭐ ONE number, two consumers — the invariant', () => {
  it('🚨 the BOX gap the width model charges is the armed INK gap, less the meter’s left air', () => {
    for (const name of Object.keys(BARLINE_METER_RULES)) {
      setBarlineMeterRule(name as never)
      expect(barlineToMeterGap()).toBeCloseTo(armedBarlineMeterInk() - METER_PART_LEFT_AIR, 10)
    }
  })
})

describe('⭐⭐ WHICH gap a meter pays is keyed on WHAT PRECEDES IT', () => {
  it('🚨 a LONE meter pays the BARLINE gap — the one part that pays a gap while being FIRST', () => {
    // ⛔ Before 2026-09-13 `headerExtent` gave the first part no gap at all, whatever it was, so a
    //    mid-line meter change reserved nothing between the barline and its digits while VexFlow
    //    drew it at 0.5. Two numbers for one distance, and neither chosen.
    const lone = headerExtent({ meter: METER })
    setBarlineMeterRule('books')
    const wider = headerExtent({ meter: METER })
    expect(wider - lone, 'the reservation follows the armed rule')
      .toBeCloseTo(BARLINE_METER_RULES.books.ink - BARLINE_METER_RULES.gerouLusk.ink, 10)
  })

  it('⛔ a meter after a CLEF does NOT pay it — that pair has its own number', () => {
    const afterClef = headerExtent({ clef: CLEF, meter: METER })
    setBarlineMeterRule('books')
    expect(headerExtent({ clef: CLEF, meter: METER }),
      'arming the barline rule moves nothing when a clef stands in front').toBeCloseTo(afterClef, 10)
  })

  it('⭐ …and the two gaps are genuinely different numbers, so the branch is observable', () => {
    expect(barlineToMeterGap()).not.toBeCloseTo(clefToMeterGap(), 3)
  })
})
