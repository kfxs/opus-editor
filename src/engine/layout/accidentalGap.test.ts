/**
 * ⭐ The accidental-gap TABLE — sourced rows, refusal on a typo, and the two facts about the rows
 * that matter when reading them.
 *
 * ⛔ Not the drawing: the ink's half is `rendering/format/accidentalPlacement.test.ts`.
 */
import { describe, it, expect, afterEach } from 'vitest'
import {
  ACCIDENTAL_GAP_RULES, ACTIVE_ACCIDENTAL_GAP_RULE, accidentalGapGeneration, accidentalGapSettings,
  armedAccidentalGap, resetAccidentalGapRule, setAccidentalGapRule, type AccidentalGapRuleName,
} from './accidentalGap'
import { accidentalExtent } from './spacingPadding'

afterEach(() => resetAccidentalGapRule())

const NAMES = Object.keys(ACCIDENTAL_GAP_RULES) as AccidentalGapRuleName[]

describe('the rows', () => {
  it('⭐ every row cites its source', () => {
    for (const name of NAMES) expect(ACCIDENTAL_GAP_RULES[name].source.length, name).toBeGreaterThan(10)
  })

  it('⭐⭐ ROSS is the outlier, and he is the only NUMBER in the library', () => {
    // Gould, Stone and Gerou & Lusk state none; his 1½ spaces left-edge-to-left-edge leaves 0.54 of
    // ink, nearly twice what any engine draws.
    const others = NAMES.filter(n => n !== 'ross').map(n => ACCIDENTAL_GAP_RULES[n].gap)
    expect(ACCIDENTAL_GAP_RULES.ross.gap).toBeGreaterThan(Math.max(...others) * 1.5)
  })

  it('⭐ every gap is a fraction of a space — ⛔ nobody typed a pixel', () => {
    for (const name of NAMES) {
      expect(ACCIDENTAL_GAP_RULES[name].gap, name).toBeGreaterThan(0.1)
      expect(ACCIDENTAL_GAP_RULES[name].gap, name).toBeLessThan(1)
    }
  })
})

describe('the room it buys', () => {
  it('⭐⭐ the RESERVATION follows the armed row — one number for the room and the ink', () => {
    const atHouse = accidentalExtent([{ position: 0, sign: '#' }])
    setAccidentalGapRule('ross')
    const atRoss = accidentalExtent([{ position: 0, sign: '#' }])
    // ⭐ Ross's 0.54 is 0.24 sp looser than VexFlow's 0.30, and the bar buys exactly that.
    expect(atRoss - atHouse).toBeCloseTo(ACCIDENTAL_GAP_RULES.ross.gap - ACCIDENTAL_GAP_RULES.house.gap, 10)
  })

  it('⭐ the armed `house` row buys what the measured table always did — ⛔ the table moved nothing', () => {
    // 🚨 The assertion that would have caught the misreading this table was built on: "closing" a
    // mismatch that was not one moved this number by 0.2 sp, and eight specs said so.
    expect(accidentalExtent([{ position: 0, sign: '#' }])).toBeCloseTo(1.4, 10)
    expect(accidentalExtent([{ position: 0, sign: 'b' }])).toBeCloseTo(1.3, 10)
  })

  it('⭐ a SECOND column is not a second gap — the armed row is added once', () => {
    const one = accidentalExtent([{ position: 0, sign: '#' }])
    const two = accidentalExtent([{ position: 0, sign: '#' }, { position: 4, sign: '#' }])
    setAccidentalGapRule('ross')
    const oneRoss = accidentalExtent([{ position: 0, sign: '#' }])
    const twoRoss = accidentalExtent([{ position: 0, sign: '#' }, { position: 4, sign: '#' }])
    expect(twoRoss - two).toBeCloseTo(oneRoss - one, 10)
  })
})

describe('arming', () => {
  it('✅ ships `house` — VexFlow’s standoff, which is also Gould’s drawn mean', () => {
    expect(ACTIVE_ACCIDENTAL_GAP_RULE).toBe('house')
    expect(armedAccidentalGap().gap).toBe(0.3)
  })

  it('⭐ arming bumps the generation the WIDTH keys watch', () => {
    const before = accidentalGapGeneration()
    expect(setAccidentalGapRule('lilypond')).toBe(true)
    expect(armedAccidentalGap().gap).toBe(0.35)
    expect(accidentalGapGeneration()).toBeGreaterThan(before)
  })

  it('⛔ REFUSES an unknown row and leaves the armed one alone', () => {
    setAccidentalGapRule('musescore')
    expect(setAccidentalGapRule('verovio' as never), 'Verovio shares MuseScore’s row').toBe(false)
    expect(accidentalGapSettings().rule).toBe('musescore')
  })
})
