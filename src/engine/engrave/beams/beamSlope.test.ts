/**
 * How steep a beam may be — the rules, in jsdom.
 *
 * ⛔ There is deliberately no spec here asserting that one RULE is correct: which algorithm this
 * editor should use is open (`docs/beam-engraving-plan.md`, his call 2026-09-01). What is pinned is
 * that each row says what its source says, and that the table stays a table.
 */
import { describe, it, expect } from 'vitest'
import {
  type BeamShape, BEAM_SLOPE_RULES, ACTIVE_BEAM_SLOPE_RULE, beamRiseCap,
} from './beamSlope'

const shape = (
  intervalSteps: number, widthSpaces: number, noteCount = 2,
  naturalRiseSpaces = intervalSteps * 0.5, beamCount = 1,
): BeamShape => ({ intervalSteps, widthSpaces, noteCount, naturalRiseSpaces, beamCount })

/** Wide enough that the width budget never binds — so the interval's is what is measured. */
const WIDE = 30

describe('the `musescore` rule — Ross p. 102 as MuseScore encodes it', () => {
  it('⭐ the interval buys quarter-spaces, one per diatonic step, up to an octave', () => {
    const rise = (steps: number) => beamRiseCap(shape(steps, WIDE), 'musescore')
    expect(rise(1), 'a 2nd: ¼').toBe(0.25)
    expect(rise(2), 'a 3rd: ½ — and Gould draws 0.46').toBe(0.5)
    expect(rise(3), 'a 4th: ¾').toBe(0.75)
    expect(rise(4), 'a 5th: 1').toBe(1)
    expect(rise(5), 'a 6th: 1¼').toBe(1.25)
    expect(rise(6), 'a 7th: 1½').toBe(1.5)
    expect(rise(7), 'an octave: 1¾').toBe(1.75)
  })

  it('⭐ …and nothing wider than an octave earns more — the table saturates', () => {
    expect(beamRiseCap(shape(12, WIDE), 'musescore')).toBe(1.75)
    expect(beamRiseCap(shape(40, WIDE), 'musescore')).toBe(1.75)
  })

  it('⛔ a unison earns nothing — a flat beam, and the books all say so', () => {
    expect(beamRiseCap(shape(0, WIDE), 'musescore')).toBe(0)
  })

  it('⭐⭐ the WIDTH budget: closer than three spaces ⇒ ¼, whatever the interval (Gould p. 20)', () => {
    for (const steps of [1, 2, 3, 4, 5, 6, 7]) {
      expect(beamRiseCap(shape(steps, 2.5), 'musescore'),
        `an interval of ${steps + 1} at this editor’s own quaver spacing`).toBe(0.25)
    }
  })

  it('⭐ the width ladder, at its rungs', () => {
    const rise = (w: number) => beamRiseCap(shape(7, w), 'musescore')
    expect(rise(2.99), 'under three spaces').toBe(0.25)
    expect(rise(3), '…and three exactly is the next rung — the rule reads “closer than three”').toBe(0.5)
    expect(rise(4.99)).toBe(0.5)
    expect(rise(5)).toBe(0.75)
    expect(rise(7.5)).toBe(1)
    expect(rise(10)).toBe(1.25)
    expect(rise(15)).toBe(1.5)
    expect(rise(20), 'past the last rung').toBe(1.75)
    expect(rise(100), '…and it stays there').toBe(1.75)
  })

  it('⭐ the SMALLER of the two budgets wins — that is the whole rule', () => {
    // A 7th (1½ by interval) squeezed into 3.5 spaces (½ by width).
    expect(beamRiseCap(shape(6, 3.5), 'musescore')).toBe(0.5)
    // A 2nd (¼ by interval) with all the room in the world.
    expect(beamRiseCap(shape(1, 40), 'musescore')).toBe(0.25)
  })

  // ⚠️ The dissent, asserted rather than described: at the width Gould DREW her example, the tables
  // give half of what she engraved. See `docs/beam-slope-research.md` §2.2 — it is one of the
  // reasons the algorithm is an open question and not a settled one.
  it('🚨 …and at Gould’s own plate the tables are FLATTER than she engraved', () => {
    expect(beamRiseCap(shape(2, 4.4), 'musescore'), 'her 3rd: the tables agree').toBe(0.5)
    expect(beamRiseCap(shape(6, 4.8), 'musescore'), 'her 7th: she draws 1.0, the tables say ½').toBe(0.5)
  })
})

describe('the `vexflow` rule — what we drew before P4b, kept as the baseline', () => {
  it('⭐ it caps the ANGLE, so the climb it allows GROWS with the bar', () => {
    expect(beamRiseCap(shape(7, 2.5), 'vexflow')).toBeCloseTo(0.625, 6)
    expect(beamRiseCap(shape(7, 10), 'vexflow')).toBeCloseTo(2.5, 6)
    // 🚨 The difference between the two families, in one assertion: the tradition's budget is FIXED
    // by the interval and the spacing; VexFlow's is a fraction of however wide the bar happens to be.
    expect(beamRiseCap(shape(7, 40), 'vexflow')).toBeGreaterThan(beamRiseCap(shape(7, 40), 'musescore'))
  })

  it('⛔ it does not read the interval at all — a 2nd and an octave get the same room', () => {
    expect(beamRiseCap(shape(1, 6), 'vexflow')).toBe(beamRiseCap(shape(7, 6), 'vexflow'))
  })
})

describe('the TABLE stays a table', () => {
  it('⭐ every row answers, for every shape a real beam can have', () => {
    for (const [name, rule] of Object.entries(BEAM_SLOPE_RULES)) {
      for (const s of [shape(0, 0), shape(1, 2.5), shape(7, 30), shape(40, 1)]) {
        const rise = rule(s)
        expect(Number.isFinite(rise), `${name} answered a number`).toBe(true)
        expect(rise, `${name} never asks for a NEGATIVE climb`).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('⭐ the active rule is one of the rows — swapping algorithms is one word', () => {
    expect(Object.keys(BEAM_SLOPE_RULES)).toContain(ACTIVE_BEAM_SLOPE_RULE)
    expect(beamRiseCap(shape(2, 6))).toBe(BEAM_SLOPE_RULES[ACTIVE_BEAM_SLOPE_RULE](shape(2, 6)))
  })
})

describe('the two ENGINE rows — ⛔ partial ports, and the specs say which part', () => {
  it('⭐ lilypond damps a shallow slope to 60% of what the notes suggest', () => {
    // ⚠️ `tanh x ≈ x` only NEAR zero: at a slope of 0.2 the damping is 0.6 × tanh(0.2) = 0.1184,
    // so the budget is 0.592 rather than a clean 0.6 — the curve is already bending at ordinary
    // slopes, which is the half of LilyPond's rule a linear reading would miss.
    const s = shape(2, 5, 2, /* naturalRise */ 1)
    expect(beamRiseCap(s, 'lilypond')).toBeCloseTo(0.592, 3)
  })

  it('⭐⭐ …and SATURATES a steep one — `tanh` can never exceed 1', () => {
    // A wild leap over a short distance: the natural slope is 2, but tanh(2) = 0.964.
    const steep = shape(14, 4, 2, /* naturalRise */ 8)
    expect(beamRiseCap(steep, 'lilypond')).toBeLessThan(0.6 * 4)
    // ⭐ The ceiling it approaches: 0.6 × width, however extreme the pitches.
    expect(beamRiseCap(shape(40, 4, 2, 200), 'lilypond')).toBeCloseTo(2.4, 2)
  })

  it('⛔ …and it reads the DRAWING, not the interval — the tables’ opposite', () => {
    const a = shape(2, 5, 2, /* naturalRise */ 1)
    const b = shape(7, 5, 2, /* naturalRise */ 1)
    expect(beamRiseCap(a, 'lilypond'), 'same natural rise ⇒ same budget').toBe(beamRiseCap(b, 'lilypond'))
    expect(beamRiseCap(a, 'musescore'), '…where the table hears a 3rd').not.toBe(beamRiseCap(b, 'musescore'))
  })

  it('⭐ verovio’s ladder: a close PAIR takes the quarter-space step', () => {
    expect(beamRiseCap(shape(7, 2.5), 'verovio'), 'two notes within 3 spaces').toBe(0.25)
    expect(beamRiseCap(shape(7, 4), 'verovio'), '…and a whole space once they part').toBe(1)
  })

  it('⭐⭐ …but ⛔ never for a group carrying three beams — Gould p. 21, from the other side', () => {
    expect(beamRiseCap(shape(7, 2.5, 2, 3.5, /* beamCount */ 3), 'verovio')).toBe(1)
  })

  it('⭐ verovio branches on the NOTE COUNT, which no other row reads', () => {
    expect(beamRiseCap(shape(6, 8, 3), 'verovio'), 'three notes, a 7th, spread out').toBe(2)
    expect(beamRiseCap(shape(4, 8, 3), 'verovio'), '…a 5th or smaller reduces it').toBe(1)
    expect(beamRiseCap(shape(2, 8, 6), 'verovio'), 'a long group of small steps').toBe(0.25)
  })
})
