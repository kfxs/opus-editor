/**
 * **The barline family's contract** — the three signs of docs/barline-types-plan.md P1: the final
 * barline (a STYLE) and the two repeats (which are NOT styles).
 *
 * ⛔ Nothing here asserts a drawn position. Unit tests run in jsdom, which has no layout and no
 * fonts, so a barline's geometry measures zeros and agrees with itself; the sign's ink is P2's, and
 * `e2e/*.e2e.ts` is where it is measured. This file is about the MODEL: who owns which line, what an
 * absent field means, what the load boundary refuses, and what survives an edit to the bar spine.
 */
import { describe, it, expect } from 'vitest'
import { ScoreModel } from './ScoreModel'
import {
  barlineAt, repeatStartAt, repeatEndAt,
  setBarlineStyle, setRepeatStart, setRepeatEnd, clearBarline,
  isBarlineStyle, isValidRepeatTimes,
} from './barlineOps'
import type { Score } from '@/types/music'
import { fracCreate as frac } from '@/utils/fraction'

/** A model with `bars` measures (the constructor already made bar 1). */
function scoreOf(bars = 4): { model: ScoreModel; score: Score } {
  const model = new ScoreModel()
  while (model.getScore().measures.length < bars) model.addMeasure()
  return { model, score: model.getScore() }
}

describe('barlineOps — absent is the rule', () => {
  it('a fresh bar carries no barline statement of any kind', () => {
    const { score } = scoreOf()
    expect(barlineAt(score, 1)).toBeUndefined()
    expect(repeatStartAt(score, 1)).toBeUndefined()
    expect(repeatEndAt(score, 1)).toBeUndefined()
  })

  it('⛔ the LAST bar gets no automatic final barline — a final bar is placed, never derived', () => {
    const { score } = scoreOf(3)
    expect(barlineAt(score, 3)).toBeUndefined()
  })

  it('clearing writes ABSENCE, not a stored default — one spelling of "plain", so the JSON stays clean', () => {
    const { score } = scoreOf()
    setBarlineStyle(score, 2, 'final')
    expect(setBarlineStyle(score, 2, undefined)).toBe(true)
    expect('barline' in score.measures[1]).toBe(false)
  })
})

describe('barlineOps — the style', () => {
  it('sets and reads the final barline on the bar the line ENDS', () => {
    const { score } = scoreOf()
    expect(setBarlineStyle(score, 2, 'final')).toBe(true)
    expect(barlineAt(score, 2)?.style).toBe('final')
    expect(barlineAt(score, 1)).toBeUndefined()
    expect(barlineAt(score, 3)).toBeUndefined()
  })

  it('stores the staff scope when given, and leaves it ABSENT (= the whole system) when not', () => {
    const { model, score } = scoreOf()
    const staffId = model.getScore().staves![0].id
    setBarlineStyle(score, 1, 'final')
    expect('staffId' in barlineAt(score, 1)!).toBe(false)
    setBarlineStyle(score, 2, 'final', staffId)
    expect(barlineAt(score, 2)?.staffId).toBe(staffId)
  })

  it('re-setting the same style is a no-op, and a different scope is not', () => {
    const { score } = scoreOf()
    expect(setBarlineStyle(score, 1, 'final')).toBe(true)
    expect(setBarlineStyle(score, 1, 'final')).toBe(false)
    expect(setBarlineStyle(score, 1, 'final', 'staff-2')).toBe(true)
  })

  it('refuses an unknown measure and an unknown style, touching nothing', () => {
    const { score } = scoreOf()
    expect(setBarlineStyle(score, 99, 'final')).toBe(false)
    expect(setBarlineStyle(score, 1, 'ninelines' as never)).toBe(false)
    expect(barlineAt(score, 1)).toBeUndefined()
  })

  it('clearing a bar that has nothing reports no change', () => {
    const { score } = scoreOf()
    expect(setBarlineStyle(score, 1, undefined)).toBe(false)
  })
})

describe('barlineOps — ⭐⭐ a repeat is NOT a style, and each line has ONE owner', () => {
  it('an end repeat and a final barline are different fields on the same bar', () => {
    const { score } = scoreOf()
    setBarlineStyle(score, 2, 'final')
    setRepeatEnd(score, 2, true)
    expect(barlineAt(score, 2)?.style).toBe('final')
    expect(repeatEndAt(score, 2)).toEqual({})
    // Neither wrote the other's field: no slot here has to hold two statements (MEI's `rptboth`).
  })

  it('the OPEN repeat belongs to the bar it opens — the bar the music jumps TO', () => {
    const { score } = scoreOf()
    setRepeatStart(score, 3, true)
    expect(repeatStartAt(score, 3)).toEqual({})
    expect(repeatStartAt(score, 2)).toBeUndefined()
    expect(repeatEndAt(score, 2)).toBeUndefined()
  })

  it('⭐ back-to-back repeats need no new vocabulary: two facts on two bars', () => {
    const { score } = scoreOf()
    setRepeatEnd(score, 2, true)
    setRepeatStart(score, 3, true)
    expect(repeatEndAt(score, 2)).toBeDefined()
    expect(repeatStartAt(score, 3)).toBeDefined()
    // ⭐ The combined sign is a DRAWING over these two facts (P2), never a third stored value.
  })

  it('turns repeats off again, back to absent', () => {
    const { score } = scoreOf()
    setRepeatStart(score, 2, true)
    setRepeatEnd(score, 2, true)
    expect(setRepeatStart(score, 2, false)).toBe(true)
    expect(setRepeatEnd(score, 2, false)).toBe(true)
    expect('repeatStart' in score.measures[1]).toBe(false)
    expect('repeatEnd' in score.measures[1]).toBe(false)
    expect(setRepeatEnd(score, 2, false)).toBe(false)
  })
})

describe('barlineOps — the repeat count', () => {
  it('absent means twice; a count is stored as given', () => {
    const { score } = scoreOf()
    setRepeatEnd(score, 1, true)
    expect(repeatEndAt(score, 1)?.times).toBeUndefined()
    setRepeatEnd(score, 2, true, { times: 3 })
    expect(repeatEndAt(score, 2)?.times).toBe(3)
  })

  it('⛔ REFUSES a count below 2 or a fractional one rather than clamping it', () => {
    const { score } = scoreOf()
    for (const times of [0, 1, -2, 2.5, NaN]) {
      expect(setRepeatEnd(score, 1, true, { times })).toBe(false)
    }
    expect(repeatEndAt(score, 1)).toBeUndefined()
    expect(isValidRepeatTimes(2)).toBe(true)
    expect(isValidRepeatTimes(1)).toBe(false)
  })

  it('isBarlineStyle knows exactly the styles the drawing has a case for', () => {
    expect(isBarlineStyle('final')).toBe(true)
    expect(isBarlineStyle('double')).toBe(false) // not shipped — plan §0
    expect(isBarlineStyle(undefined)).toBe(false)
  })
})

describe('barlineOps — clearBarline: back to a plain line', () => {
  it('drops the style AND both repeats, which is what Delete on a barline means', () => {
    const { score } = scoreOf()
    setBarlineStyle(score, 2, 'final')
    setRepeatStart(score, 2, true)
    setRepeatEnd(score, 2, true, { times: 4 })
    expect(clearBarline(score, 2)).toBe(true)
    expect(barlineAt(score, 2)).toBeUndefined()
    expect(repeatStartAt(score, 2)).toBeUndefined()
    expect(repeatEndAt(score, 2)).toBeUndefined()
  })

  it('reports no change on a bar that already draws a plain line', () => {
    const { score } = scoreOf()
    expect(clearBarline(score, 1)).toBe(false)
    expect(clearBarline(score, 99)).toBe(false)
  })
})

describe('barlineOps — the JSON round trip and the load boundary', () => {
  it('survives export/import verbatim — no migration, the fields ride the plain parse', () => {
    const { model, score } = scoreOf()
    setBarlineStyle(score, 2, 'final')
    setRepeatStart(score, 2, true)
    setRepeatEnd(score, 3, true, { times: 3 })

    const back = ScoreModel.fromJSON(model.toJSON()).getScore()
    expect(barlineAt(back, 2)?.style).toBe('final')
    expect(repeatStartAt(back, 2)).toEqual({})
    expect(repeatEndAt(back, 3)?.times).toBe(3)
  })

  it('a score with none of these fields is a legal score (an absent field is not a missing one)', () => {
    const { model } = scoreOf()
    expect(() => ScoreModel.fromJSON(model.toJSON())).not.toThrow()
  })

  it('⛔ THROWS on an unknown style — report, never repair', () => {
    const { model, score } = scoreOf()
    setBarlineStyle(score, 2, 'final')
    const json = model.toJSON().replace('"final"', '"heavyLight"')
    expect(() => ScoreModel.fromJSON(json)).toThrow(/barline style/i)
  })

  it('⛔ THROWS on a repeat count a sign cannot mean, rather than clamping it to 2', () => {
    const { model, score } = scoreOf()
    setRepeatEnd(score, 2, true, { times: 3 })
    const json = model.toJSON().replace('"times": 3', '"times": 0')
    expect(() => ScoreModel.fromJSON(json)).toThrow(/repeat count/i)
  })
})

describe('barlineOps — the fields are MEASURE-owned, so an edit to the spine cannot slide them', () => {
  it('an insert before a signed bar carries the sign along with its music, not onto a neighbour', () => {
    const { model, score } = scoreOf(3)
    setRepeatEnd(score, 3, true)
    setBarlineStyle(score, 2, 'final')

    model.insertMeasureAfter(1) // old bar 2 → 3, old bar 3 → 4

    expect(barlineAt(score, 2)).toBeUndefined() // the new, empty bar
    expect(barlineAt(score, 3)?.style).toBe('final')
    expect(repeatEndAt(score, 4)).toBeDefined()
    expect(repeatEndAt(score, 3)).toBeUndefined()
  })

  it('a rebar leaves each sign on the bar that stored it — a boundary fact has no beat to re-anchor', () => {
    const { model, score } = scoreOf(4)
    model.addNote({ step: 'C', octave: 4, duration: 'q', measure: 2, beat: frac(0, 1) })
    setBarlineStyle(score, 2, 'final')
    setRepeatStart(score, 3, true)

    // A meter change re-tiles the whole region, regenerating every slot id under it.
    model.setTimeSignature(1, { numerator: 3, denominator: 4 })

    expect(barlineAt(score, 2)?.style).toBe('final')
    expect(repeatStartAt(score, 3)).toEqual({})
    // ⚠️ A rebar can GROW the region (overflow becomes more bars); the signs stay on their own bars
    // rather than following the region's new end. See the plan's §8 P1 note — they are measure-owned.
  })
})
