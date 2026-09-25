import { describe, it, expect, afterEach } from 'vitest'
import {
  ACTIVE_CHORD_DOT_RULE, CHORD_DOT_RULES, armedChordDots, centredChordSpaces, chordDotGeneration, chordDotSettings,
  resetChordDotRule, setChordDotRule,
} from './chordDots'

afterEach(() => resetChordDotRule())

describe('a colliding chord’s dots (docs/plans/multiple-dots-plan.md R5)', () => {
  it('✅ ships `gould`; every row names its source', () => {
    expect(ACTIVE_CHORD_DOT_RULE).toBe('gould')
    expect(armedChordDots().collisions).toBe('centre')
    for (const row of Object.values(CHORD_DOT_RULES)) expect(row.source.length).toBeGreaterThan(0)
  })

  it('⭐ Gould p. 56, her four-note cluster F4–B4: a space each, centred — one BELOW, ⛔ not all four upward', () => {
    // Treble lines: E4 = 1, so F4 1.5, G4 2, A4 2.5, B4 3.
    expect(centredChordSpaces([3, 2.5, 2, 1.5])).toEqual([3.5, 2.5, 1.5, 0.5])
  })

  it('⭐ Gould p. 56’s rule on a tall cluster: a dot TWO spaces out ⇒ only the spaces the chord covers', () => {
    // Eight heads stepwise E4..E5 (lines 1..4.5): eight dots would run to −0.5 and 6.5, so the chord keeps the
    // four spaces it covers. ⚠️ Her OWN figure is a taller chord (bottom line to above the top line) with FIVE
    // dots — the five spaces THAT one covers; this is the rule applied, ⛔ not her drawing.
    expect(centredChordSpaces([4.5, 4, 3.5, 3, 2.5, 2, 1.5, 1])).toEqual([4.5, 3.5, 2.5, 1.5])
  })

  it('C5 D5 E5 F5 (lines 3.5–5): four spaces, one each side of the two it covers', () => {
    expect(centredChordSpaces([5, 4.5, 4, 3.5])).toEqual([5.5, 4.5, 3.5, 2.5])
  })

  it('arming bumps the generation; an unknown row is refused', () => {
    const before = chordDotGeneration()
    expect(setChordDotRule('verovio')).toBe(true)
    expect(chordDotGeneration()).toBeGreaterThan(before)
    expect(setChordDotRule('nope' as never)).toBe(false)
    expect(chordDotSettings().rule).toBe('verovio')
  })
})
