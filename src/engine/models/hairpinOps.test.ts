/**
 * {@link hairpinOps} — the crescendo / diminuendo wedge as STORAGE: where it lives, what it
 * refuses, and what dies with it.
 *
 * There is no geometry here and there cannot be: a hairpin's drawn shape is derived from the
 * render every frame and stored nowhere (docs/dynamics-line-and-hairpins-plan.md §6), so what a
 * unit test can check is the model's own contract — the wedge rides its start measure, its extent
 * is an amount of MUSIC rather than a second address, a non-positive extent is refused rather
 * than clamped or deleted, and an override never outlives its anchor.
 *
 * A `ScoreModel` is the FIXTURE; the subject is the free functions in `./hairpinOps`.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import type { Score, DynamicOffsetOverride } from '@/types/music'
import { ScoreModel } from './ScoreModel'
import { fracCreate as frac, fracToNumber, fracEq } from '@/utils/fraction'
import {
  addHairpin, removeHairpin, updateHairpin, setHairpinLength, toggleHairpinType,
  getHairpinById, hairpinMeasure, measureHairpins, hairpinEndBeat,
} from './hairpinOps'
import { setEngravingOverride } from './overrideOps'
import { engravingOverridesOf } from './engravingOverrides'

describe('hairpinOps — storage', () => {
  let model: ScoreModel
  let score: Score
  beforeEach(() => {
    model = new ScoreModel() // measure 1, 4/4 by default
    model.addMeasure()
    score = model.getScore()
  })

  it('stores the hairpin on the measure its START lands in, with a fresh id', () => {
    const created = addHairpin(score, 1, { type: 'cresc', beat: frac(1, 1), length: frac(2, 1) })
    expect(created).not.toBeNull()
    expect(created!.id).toBeTruthy()
    expect(measureHairpins(score.measures[0])).toHaveLength(1)
    expect(measureHairpins(score.measures[1])).toHaveLength(0)
    expect(hairpinMeasure(score, created!.id)).toBe(score.measures[0])
  })

  it('lets the wedge run PAST its own bar — length is not clamped to the measure', () => {
    // A 4/4 bar holds 4 beats; this wedge starts on beat 3 and covers 6.
    const created = addHairpin(score, 1, { type: 'cresc', beat: frac(3, 1), length: frac(6, 1) })!
    expect(fracToNumber(created.length)).toBe(6)
    expect(fracToNumber(hairpinEndBeat(created))).toBe(9) // past the bar, deliberately
    // …and it is still stored on bar 1 only. "The hairpins of measure N" means the ones that
    // START there, which is what makes a span need no second address.
    expect(measureHairpins(score.measures[0])).toHaveLength(1)
    expect(measureHairpins(score.measures[1])).toHaveLength(0)
  })

  it('refuses a zero or negative length, and refuses it on update too', () => {
    expect(addHairpin(score, 1, { type: 'cresc', beat: frac(0, 1), length: frac(0, 1) })).toBeNull()
    expect(addHairpin(score, 1, { type: 'cresc', beat: frac(0, 1), length: frac(-2, 1) })).toBeNull()
    expect(measureHairpins(score.measures[0])).toHaveLength(0)

    const id = addHairpin(score, 1, { type: 'dim', beat: frac(0, 1), length: frac(2, 1) })!.id
    expect(setHairpinLength(score, id, frac(0, 1))).toBe(false)
    expect(updateHairpin(score, id, { length: frac(-1, 1) })).toBeNull()
    // Refused, NOT destructive: shortening past nothing must not delete the thing being shortened.
    expect(fracToNumber(getHairpinById(score, id)!.length)).toBe(2)
  })

  it('returns null for a measure that does not exist', () => {
    expect(addHairpin(score, 99, { type: 'cresc', beat: frac(0, 1), length: frac(1, 1) })).toBeNull()
  })

  it('keeps the list sorted by start beat, and lets two share one beat', () => {
    addHairpin(score, 1, { type: 'cresc', beat: frac(3, 1), length: frac(1, 1) })
    addHairpin(score, 1, { type: 'dim', beat: frac(1, 1), length: frac(1, 1) })
    // Stacking is the DYNAMICS rule (nothing is replaced), not the clef rule (last wins).
    addHairpin(score, 1, { type: 'cresc', beat: frac(1, 1), length: frac(2, 1), voice: 1 })
    const beats = measureHairpins(score.measures[0]).map(h => fracToNumber(h.beat))
    expect(beats).toEqual([1, 1, 3])
  })

  it('re-sorts when an update moves the start beat', () => {
    const first = addHairpin(score, 1, { type: 'cresc', beat: frac(0, 1), length: frac(1, 1) })!
    addHairpin(score, 1, { type: 'dim', beat: frac(2, 1), length: frac(1, 1) })
    updateHairpin(score, first.id, { beat: frac(3, 1) })
    expect(measureHairpins(score.measures[0]).map(h => fracToNumber(h.beat))).toEqual([2, 3])
  })

  it('setHairpinLength writes the MODEL — not an engraving override', () => {
    const id = addHairpin(score, 1, { type: 'cresc', beat: frac(0, 1), length: frac(1, 1) })!.id
    expect(setHairpinLength(score, id, frac(7, 2))).toBe(true)
    expect(fracEq(getHairpinById(score, id)!.length, frac(7, 2))).toBe(true)
    // §4: time comes from the address, engraving from the compartment. A length edit must leave
    // the compartment untouched, or "three beats long" becomes sayable in two places at once.
    expect(engravingOverridesOf(score, id)).toHaveLength(0)
  })

  it('toggles cresc ↔ dim', () => {
    const id = addHairpin(score, 1, { type: 'cresc', beat: frac(0, 1), length: frac(1, 1) })!.id
    expect(toggleHairpinType(score, id)).toBe('dim')
    expect(toggleHairpinType(score, id)).toBe('cresc')
    expect(toggleHairpinType(score, 'ghost')).toBeNull()
  })

  it('removes by id, drops the empty array, and takes its overrides with it', () => {
    const id = addHairpin(score, 1, { type: 'cresc', beat: frac(0, 1), length: frac(1, 1) })!.id
    // Nothing writes a hairpin-keyed override yet; stand one in to prove it cannot orphan.
    const stub: DynamicOffsetOverride = { kind: 'dynamicOffset', x: 0, y: -2 }
    setEngravingOverride(score, id, stub)
    expect(engravingOverridesOf(score, id)).toHaveLength(1)

    expect(removeHairpin(score, id)).toBe(true)
    expect(score.measures[0].hairpins).toBeUndefined()
    expect(engravingOverridesOf(score, id)).toHaveLength(0)
    expect(removeHairpin(score, id)).toBe(false)
    expect(getHairpinById(score, id)).toBeNull()
  })

  it('survives a JSON round trip — Fractions and all', () => {
    addHairpin(score, 2, { type: 'dim', beat: frac(1, 2), length: frac(5, 3), placement: 'above' })
    const reloaded = ScoreModel.fromJSON(model.toJSON()).getScore()
    const [hp] = measureHairpins(reloaded.measures[1])
    expect(hp.type).toBe('dim')
    expect(hp.placement).toBe('above')
    expect(fracEq(hp.beat, frac(1, 2))).toBe(true)
    expect(fracEq(hp.length, frac(5, 3))).toBe(true)
  })
})
