import { describe, it, expect } from 'vitest'
import { INK, minColumnGap, accidentalExtent, dotExtent, pairPadding, restDotExtent, restExtent } from './spacingPadding'
import { resetRestDotGapRule, setRestDotGapRule } from './restDotGap'
import { DOT_GAP_RULES, resetDotGapRule, setDotGapRule, type DotGapRuleName } from './dotGap'
import { noteDotXs } from './noteDotXs'

/**
 * The ink half's table (docs/plans/spacing-model-plan.md P3).
 *
 * ⭐ Every extent here was MEASURED off our own drawing in Chrome and is asserted against the number
 * that came back, so this file is where the table's provenance lives. `e2e/spacing.e2e.ts`
 * re-measures the same quantities in a browser and fails if the drawing has moved — the two halves
 * of *"⛔ what is not an option is measuring one and drawing the other silently"*.
 */
describe('the measured extents', () => {
  it('a notehead is 1.13 spaces — the offset of a SECOND\'s displaced head', () => {
    expect(INK.notehead).toBe(1.13)
  })

  it('one accidental reaches as far as it measured: sharp 1.4, flat 1.3, natural 1.1', () => {
    const at = (sign: string) => accidentalExtent([{ position: 0, sign }])
    expect(at('#')).toBeCloseTo(1.4, 6)
    expect(at('b')).toBeCloseTo(1.3, 6)
    expect(at('n')).toBeCloseTo(1.1, 6)
    expect(at('##')).toBeCloseTo(1.4, 6)
    expect(at('bb')).toBeCloseTo(2.1, 6)
  })

  it('and each further COLUMN adds its own width: two sharps 2.7, three 4.0', () => {
    const thirds = (n: number) =>
      accidentalExtent(Array.from({ length: n }, (_, i) => ({ position: i * 2, sign: '#' })))
    expect(thirds(2)).toBeCloseTo(2.7, 6)
    expect(thirds(3)).toBeCloseTo(4.0, 6)
  })

  it('⭐ two accidentals SHARE a column at a seventh, and stack at a sixth', () => {
    // Measured one interval at a time: a third, fourth, fifth and sixth all stack; a seventh and
    // anything wider come out at one x. It is also the engraver's own rule.
    const pair = (interval: number) =>
      accidentalExtent([{ position: 0, sign: '#' }, { position: interval - 1, sign: '#' }])
    for (const sixthOrCloser of [3, 4, 5, 6]) {
      expect(pair(sixthOrCloser), `an interval of ${sixthOrCloser} stacks`).toBeCloseTo(2.7, 6)
    }
    for (const seventhOrWider of [7, 8, 9, 12]) {
      expect(pair(seventhOrWider), `an interval of ${seventhOrWider} shares`).toBeCloseTo(1.4, 6)
    }
  })

  it('three accidentals need only two columns when the outer pair can share', () => {
    // C4 / E4 / C5 — the C's are an octave apart and share; the E stacks against both.
    const spread = accidentalExtent([
      { position: 0, sign: '#' }, { position: 2, sign: '#' }, { position: 7, sign: '#' },
    ])
    expect(spread).toBeCloseTo(2.7, 6)
  })

  it('nothing drawn reaches nowhere', () => {
    expect(accidentalExtent([])).toBe(0)
    expect(dotExtent(0)).toBe(0)
    expect(dotExtent(-1)).toBe(0)
  })

  it('dots land where they measured under `house`: one at 2.1 past the head, two at 3.0', () => {
    setDotGapRule('house')
    expect(dotExtent(1)).toBeCloseTo(2.1, 6)
    expect(dotExtent(2)).toBeCloseTo(3.0, 6)
    resetDotGapRule()
  })

  it('⭐⭐ the ROOM follows the armed dot row exactly as the DRAWING does (multiple-dots-plan P4a)', () => {
    // 🚨 It did not until 2026-09-25: arming `gould` drew a double dot 0.24 sp inside its reserved room.
    for (const rule of Object.keys(DOT_GAP_RULES) as DotGapRuleName[]) {
      setDotGapRule(rule)
      const xs = noteDotXs({ duration: 'q', dots: 3 }, false)
      expect(dotExtent(2) - dotExtent(1), `${rule}: the room's step is the drawing's`).toBeCloseTo(xs[1] - xs[0], 6)
      expect(dotExtent(3) - dotExtent(2), `${rule}: and the third's`).toBeCloseTo(xs[2] - xs[1], 6)
    }
    resetDotGapRule()
    expect(dotExtent(2), 'the armed `gould`: 0.24 sp tighter than `house`').toBeCloseTo(2.76, 6)
  })
})

describe('⭐ a REST’s dots take room (multiple-dots-plan P4b)', () => {
  it('past the glyph: the rest row’s head gap, each dot its width, the dot gap between', () => {
    expect(restDotExtent('h', 0)).toBe(restExtent('h'))
    expect(restDotExtent('h', 2)).toBeCloseTo(restExtent('h') + 0.4 + 2 * INK.dotWidth + 0.25, 6)
  })

  it('follows the armed REST row — `vexflow` is the old 0.2 / 0.1', () => {
    setRestDotGapRule('vexflow')
    expect(restDotExtent('h', 2)).toBeCloseTo(restExtent('h') + 0.2 + 2 * INK.dotWidth + 0.1, 6)
    resetRestDotGapRule()
  })
})

describe('the pair table', () => {
  it('is keyed by the PAIR, and a rest is not a note', () => {
    expect(pairPadding('note', 'note')).toBe(0.3)
    expect(pairPadding('note', 'accidental')).toBe(0.35)
    expect(pairPadding('note', 'rest')).toBe(0.5)
    expect(pairPadding('rest', 'note')).toBe(0.5)
    expect(pairPadding('dot', 'note')).toBe(0.5)
  })

  it('⭐ a REST stands further off a barline than a note does', () => {
    expect(pairPadding('note', 'barline')).toBe(1.0)
    expect(pairPadding('rest', 'barline')).toBe(1.65)
    expect(pairPadding('dot', 'barline')).toBe(1.0)
  })

  it('⭐⭐ the tightest two noteheads may come is 1.43 — Gould\'s table from the other end', () => {
    // Plan §1.1 predicts this number without measuring anything: "a notehead is ~1.18 spaces plus a
    // note↔note padding of ~0.25 gives ~1.43 — which is Sibelius's 32nd (1.41) and LilyPond's (1.5)
    // to two decimals. Model the ink and the bottom of the table arrives on its own."
    expect(minColumnGap()).toBeCloseTo(1.43, 6)
    expect(minColumnGap()).toBe(INK.notehead + pairPadding('note', 'note'))
  })
})
