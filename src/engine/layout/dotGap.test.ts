/**
 * ⭐ The dot-gap TABLE — that every row is sourced, that arming one is refused when it does not
 * exist, and the two facts about the rows that the survey turned up.
 *
 * ⛔ These assert the TABLE, ⛔ not the drawing: what the armed row does to the ink is
 * `rendering/dotPlacement.test.ts` (the two shifts) and `e2e/notes.e2e.ts` (where it lands).
 */
import { describe, it, expect, afterEach } from 'vitest'
import {
  ACTIVE_DOT_GAP_RULE, DOT_GAP_RULES, armedDotGap, dotGapGeneration, dotGapSettings,
  resetDotGapRule, setDotGapRule, type DotGapRuleName,
} from './dotGap'

afterEach(() => resetDotGapRule())

const NAMES = Object.keys(DOT_GAP_RULES) as DotGapRuleName[]

describe('the rows', () => {
  it('⭐ every row CITES where its numbers come from — a row that invents one is the failure mode', () => {
    for (const name of NAMES) {
      expect(DOT_GAP_RULES[name].source.length, name).toBeGreaterThan(10)
    }
  })

  it('⭐ every gap is a plausible fraction of a staff space — ⛔ nobody typed a pixel by mistake', () => {
    for (const name of NAMES) {
      const { head, dot } = DOT_GAP_RULES[name]
      expect(head, `${name} head`).toBeGreaterThan(0.1)
      expect(head, `${name} head`).toBeLessThan(1.1)
      expect(dot, `${name} dot`).toBeGreaterThan(0.05)
      expect(dot, `${name} dot`).toBeLessThan(1.1)
    }
  })

  it('⭐⭐ the two columns are NOT one number — five of the eight rows disagree with themselves', () => {
    // 🚨 The survey's headline: "the notehead→dot gap equals the dot→dot gap" is LilyPond's practice
    // and Gerou & Lusk's principle — ⛔ not a shared law. Gould's own plate draws them unequal.
    const unequal = NAMES.filter(n => DOT_GAP_RULES[n].head !== DOT_GAP_RULES[n].dot)
    expect(unequal.length).toBeGreaterThanOrEqual(4)
    expect(unequal, 'Gould drew the dots closer to each other than to the head').toContain('gouldDrawn')
    expect(DOT_GAP_RULES.gouldDrawn.dot).toBeLessThan(DOT_GAP_RULES.gouldDrawn.head)
  })

  it('⭐ …and LilyPond is the row where they ARE equal, by one callback', () => {
    expect(DOT_GAP_RULES.lilypond.head).toBe(DOT_GAP_RULES.lilypond.dot)
  })

  it('🚨 VexFlow is the outlier both books are about — 2.5× tighter than the armed row', () => {
    // His report — *"the dot is too close to the notehead"* — was measuring this row.
    expect(DOT_GAP_RULES.vexflow.head * 2.5).toBeCloseTo(DOT_GAP_RULES.house.head, 10)
  })
})

describe('arming', () => {
  it('✅ ships `house` — the number his report put on the page, ⛔ unmoved by building the table', () => {
    expect(ACTIVE_DOT_GAP_RULE).toBe('house')
    expect(armedDotGap()).toMatchObject({ head: 0.5, dot: 0.5 })
  })

  it('⭐ arming swaps both numbers and bumps the generation', () => {
    const before = dotGapGeneration()
    expect(setDotGapRule('verovio')).toBe(true)
    expect(armedDotGap()).toMatchObject({ head: 0.3, dot: 0.35 })
    expect(dotGapSettings().rule).toBe('verovio')
    expect(dotGapGeneration(), 'the WIDTH keys watch this').toBeGreaterThan(before)
  })

  it('⛔ REFUSES an unknown row, and leaves the armed one alone', () => {
    setDotGapRule('ross')
    expect(setDotGapRule('gould-ish' as never)).toBe(false)
    expect(dotGapSettings().rule, 'still Ross').toBe('ross')
  })

  it('⭐ reset returns to what shipped, and bumps the generation too', () => {
    setDotGapRule('vexflow')
    const before = dotGapGeneration()
    resetDotGapRule()
    expect(dotGapSettings().rule).toBe(ACTIVE_DOT_GAP_RULE)
    // ⚠️ The bump matters as much on the way back: without it the score would keep the memoised
    // widths of the row being abandoned.
    expect(dotGapGeneration()).toBeGreaterThan(before)
  })
})
