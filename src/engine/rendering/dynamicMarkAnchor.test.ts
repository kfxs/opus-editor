import { describe, it, expect } from 'vitest'
import type { Dynamic } from '@/types/music'
import { fracCreate as frac } from '@/utils/fraction'
import { levelToGlyphString } from '@/utils/dynamics'
import { dynamicMarkAnchorShift, isPureLevel } from './dynamicMarkAnchor'

/**
 * HOW A DYNAMIC SITS ON ITS NOTE, HORIZONTALLY — centred if it is a level, anchored if it is prose
 * (docs/dynamics-line-and-hairpins-plan.md §3a, the x half).
 *
 * ⭐ The WIDTH is a parameter, so all of this is headless: what the rule decides is *whether* to
 * centre and *by what fraction of the mark*, never how wide a glyph is. That measurement is the
 * renderer's, off the drawn `<text>`, and whether the drawn mark straddles its notehead is
 * `e2e/dynamicsLine.e2e.ts`'s.
 */

const mark = (text: string): Dynamic => ({ id: 'd', beat: frac(0, 1), text })
const level = (letters: string): Dynamic => mark(levelToGlyphString(letters))

describe('isPureLevel — glyphs all the way, or prose somewhere', () => {
  it('a bare level is one, however many letters', () => {
    expect(isPureLevel(level('f'))).toBe(true)
    expect(isPureLevel(level('sfz'))).toBe(true)
  })

  it('⛔ a WORD is not — not even beside a glyph', () => {
    expect(isPureLevel(mark('dolce'))).toBe(false)
    expect(isPureLevel(mark(`${levelToGlyphString('p')} dolce`))).toBe(false)
  })

  it('and neither is an empty mark — there is nothing to centre', () => {
    expect(isPureLevel(mark(''))).toBe(false)
    expect(isPureLevel(mark('   '))).toBe(false)
  })
})

describe('dynamicMarkAnchorShift', () => {
  it('⭐ a level moves back by its ink CENTRE — VexFlow already put its origin on the head centre', () => {
    expect(dynamicMarkAnchorShift(level('f'), { left: 0, width: 20 }, false)).toBe(-10)
  })

  it('⚠️⚠️ and the ink OVERHANGS that origin — a Bravura dynamic starts left of its own x', () => {
    // The bug this exists to prevent: shifting by half the width alone leaves the mark half a side
    // bearing off its notehead, measured at 4.6px — most of a notehead — on the drawn `ff`.
    expect(dynamicMarkAnchorShift(level('ff'), { left: -5, width: 31 }, false)).toBe(-10.5)
  })

  it('⛔ prose does not move: a word centred on a notehead reaches back over the previous beat', () => {
    expect(dynamicMarkAnchorShift(mark('dolce'), { left: 0, width: 40 }, false)).toBe(0)
    expect(dynamicMarkAnchorShift(mark(`${levelToGlyphString('p')} dolce`), { left: 0, width: 40 }, false)).toBe(0)
  })

  it('⚠️ and a CO-LOCATED mark does not either — the row owns the x of everything in it', () => {
    // `layoutCoLocatedDynamics` lays `p` + `dolce` out left-to-right and centres the pair; a mark
    // pulling itself left inside that row would only smear it.
    expect(dynamicMarkAnchorShift(level('p'), { left: 0, width: 20 }, true)).toBe(0)
  })

  it('an unmeasurable box is no shift, not a NaN transform', () => {
    expect(dynamicMarkAnchorShift(level('p'), { left: NaN, width: 20 }, false)).toBe(0)
  })
})
