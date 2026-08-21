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
  setHairpinEndpointOffset, resetHairpinEndpointOffset, setHairpinAperture,
  setHairpinOffset, resetHairpinOffset, setHairpinVoiceScope, setHairpinAtStaffSlot,
} from './hairpinOps'
import { setEngravingOverride } from './overrideOps'
import { engravingOverridesOf, hairpinEndpointOffsetOverrideOf, hairpinApertureOverrideOf } from './engravingOverrides'

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

describe('toggleHairpinType — the `x` key', () => {
  it('flips cresc ↔ dim and leaves everything else alone', () => {
    // ⚠️ The one thing `x` does that is not a SIDE flip: it changes what the mark MEANS. Its
    // address, extent and lane must survive untouched, or the key would be moving music.
    const model = new ScoreModel()
    const score = model.getScore()
    const before = addHairpin(score, 1, {
      type: 'cresc', beat: frac(1, 1), length: frac(2, 1), voice: 1, placement: 'above',
    })!
    const snapshot = { beat: before.beat, length: before.length, voice: before.voice, placement: before.placement }

    expect(toggleHairpinType(score, before.id)).toBe('dim')
    const after = getHairpinById(score, before.id)!
    expect(after.type).toBe('dim')
    expect({ beat: after.beat, length: after.length, voice: after.voice, placement: after.placement }).toEqual(snapshot)
  })
})

/**
 * ⭐⭐ THE WEDGE'S RESHAPE — {@link setHairpinEndpointOffset} / {@link resetHairpinEndpointOffset}.
 *
 * The claim worth a chapter is the CATEGORY: this is the one hairpin edit that writes the engraving-
 * overrides compartment and not the wedge. So every case checks the model is untouched — a reshape
 * that quietly shortened `length` would put the drawing and the playback into disagreement, which is
 * the exact failure §4 forbids.
 */
describe('setHairpinEndpointOffset — reshaping the drawn wedge', () => {
  let model: ScoreModel
  let score: Score
  let id: string
  beforeEach(() => {
    model = new ScoreModel()
    score = model.getScore()
    id = addHairpin(score, 1, { type: 'cresc', beat: frac(0, 1), length: frac(2, 1) })!.id
  })

  const offset = () => hairpinEndpointOffsetOverrideOf(score, id)

  it('⭐ writes the OVERRIDE and leaves the extent exactly as it was', () => {
    expect(setHairpinEndpointOffset(score, id, 'end', 1.5, -1)).toBe(true)
    expect(offset()).toEqual({ kind: 'hairpinEndpointOffset', end: { x: 1.5, y: -1 } })
    const h = getHairpinById(score, id)!
    expect([fracToNumber(h.beat), fracToNumber(h.length)]).toEqual([0, 2])
  })

  it('ACCUMULATES, so a held arrow key walks the end out', () => {
    setHairpinEndpointOffset(score, id, 'start', 0.25, 0)
    setHairpinEndpointOffset(score, id, 'start', 0.25, -0.5)
    expect(offset()!.start).toEqual({ x: 0.5, y: -0.5 })
  })

  it('keeps the two ends independent — which is what lets one `y` TILT the wedge', () => {
    setHairpinEndpointOffset(score, id, 'start', 0, 1)
    setHairpinEndpointOffset(score, id, 'end', 0, -1)
    expect(offset()).toEqual({
      kind: 'hairpinEndpointOffset', start: { x: 0, y: 1 }, end: { x: 0, y: -1 },
    })
  })

  it('resets ONE end and keeps the other, then prunes the entry when the last goes', () => {
    setHairpinEndpointOffset(score, id, 'start', 1, 1)
    setHairpinEndpointOffset(score, id, 'end', 2, 2)
    expect(resetHairpinEndpointOffset(score, id, 'start')).toBe(true)
    expect(offset()).toEqual({ kind: 'hairpinEndpointOffset', end: { x: 2, y: 2 } })
    expect(resetHairpinEndpointOffset(score, id, 'end')).toBe(true)
    expect(offset()).toBeUndefined()
    expect(score.engravingOverrides).toBeUndefined()
  })

  it('⛔ a reset with nothing authored answers false, so the key falls through', () => {
    expect(resetHairpinEndpointOffset(score, id, 'end')).toBe(false)
    setHairpinEndpointOffset(score, id, 'start', 1, 0)
    expect(resetHairpinEndpointOffset(score, id, 'end')).toBe(false)
  })

  it('⚠️ SURVIVES a resize — the nudge is about the shape, not about the note it sat near', () => {
    // The slur's endpoint nudge dies on a re-anchor because it was tuned against one notehead's ink.
    // A wedge's says "this far out from wherever the end lands", so moving the extent keeps it.
    setHairpinEndpointOffset(score, id, 'end', 1, 0)
    setHairpinLength(score, id, frac(3, 1))
    expect(offset()!.end).toEqual({ x: 1, y: 0 })
  })

  it('dies with the hairpin', () => {
    setHairpinEndpointOffset(score, id, 'end', 1, 0)
    removeHairpin(score, id)
    expect(offset()).toBeUndefined()
  })

  it('returns false for an unknown hairpin rather than orphaning an override', () => {
    expect(setHairpinEndpointOffset(score, 'ghost', 'end', 1, 0)).toBe(false)
    expect(score.engravingOverrides).toBeUndefined()
  })
})

/**
 * ⭐ {@link setHairpinAperture} — the wedge's MOUTH, its third override and the only one that is one
 * number for the whole span (his ask, 2026-08-17).
 */
describe('setHairpinAperture — the mouth', () => {
  let model: ScoreModel
  let score: Score
  let id: string
  beforeEach(() => {
    model = new ScoreModel()
    score = model.getScore()
    id = addHairpin(score, 1, { type: 'cresc', beat: frac(0, 1), length: frac(2, 1) })!.id
  })

  const mouth = () => hairpinApertureOverrideOf(score, id)

  it('stores what was asked for — it REPLACES the automatic width, it does not accumulate', () => {
    expect(setHairpinAperture(score, id, 2.5)).toBe(true)
    expect(mouth()).toEqual({ kind: 'hairpinAperture', aperture: 2.5 })
    setHairpinAperture(score, id, 1.75)
    expect(mouth()!.aperture).toBe(1.75)
  })

  it('null hands the mouth back to the automatic, length-aware default', () => {
    setHairpinAperture(score, id, 2.5)
    expect(setHairpinAperture(score, id, null)).toBe(true)
    expect(mouth()).toBeUndefined()
    expect(score.engravingOverrides).toBeUndefined()
  })

  it('⛔ REFUSES a non-positive mouth — the renderer draws nothing for one, silently', () => {
    expect(setHairpinAperture(score, id, 0)).toBe(false)
    expect(setHairpinAperture(score, id, -1)).toBe(false)
    expect(mouth()).toBeUndefined()
  })

  it('a reset with nothing authored answers false', () => {
    expect(setHairpinAperture(score, id, null)).toBe(false)
  })

  it('leaves the extent alone — a wider mouth is not a longer wedge', () => {
    setHairpinAperture(score, id, 3)
    const h = getHairpinById(score, id)!
    expect([fracToNumber(h.beat), fracToNumber(h.length)]).toEqual([0, 2])
  })

  it('lives alongside the end nudges, and all of them die with the hairpin', () => {
    setHairpinAperture(score, id, 2)
    setHairpinEndpointOffset(score, id, 'end', 1, 0)
    expect(engravingOverridesOf(score, id)).toHaveLength(2)
    removeHairpin(score, id)
    expect(engravingOverridesOf(score, id)).toEqual([])
  })

  it('returns false for an unknown hairpin rather than orphaning an override', () => {
    expect(setHairpinAperture(score, 'ghost', 2)).toBe(false)
    expect(score.engravingOverrides).toBeUndefined()
  })
})

/**
 * ⭐ {@link setHairpinOffset} / {@link resetHairpinOffset} — moving the WHOLE wedge (the arrows with a
 * hairpin selected and no square armed).
 *
 * ⭐ The claim: it is the per-end nudge applied TWICE, not a field of its own. So the assertions are
 * about the two ends staying equal under it, and about it composing with a per-end nudge rather than
 * competing with one — two places the same pixels could come from is the thing this avoids.
 */
describe('setHairpinOffset — the whole wedge', () => {
  let model: ScoreModel
  let score: Score
  let id: string
  beforeEach(() => {
    model = new ScoreModel()
    score = model.getScore()
    id = addHairpin(score, 1, { type: 'cresc', beat: frac(0, 1), length: frac(2, 1) })!.id
  })

  const offset = () => hairpinEndpointOffsetOverrideOf(score, id)

  it('⭐ moves BOTH ends by the same delta — which IS moving the wedge', () => {
    expect(setHairpinOffset(score, id, 0.5, -1)).toBe(true)
    expect(offset()).toEqual({
      kind: 'hairpinEndpointOffset', start: { x: 0.5, y: -1 }, end: { x: 0.5, y: -1 },
    })
  })

  it('accumulates, so a held arrow walks the wedge across the page', () => {
    setHairpinOffset(score, id, 0.25, 0)
    setHairpinOffset(score, id, 0.25, 0)
    expect(offset()!.start).toEqual({ x: 0.5, y: 0 })
    expect(offset()!.end).toEqual({ x: 0.5, y: 0 })
  })

  it('⭐ COMPOSES with a per-end nudge instead of overwriting it', () => {
    // Open the right end, then move the whole thing: the difference between the ends survives, which
    // is what a separate "whole wedge" field could not have promised.
    setHairpinEndpointOffset(score, id, 'end', 1, 0)
    setHairpinOffset(score, id, 0.5, 0)
    expect(offset()!.start).toEqual({ x: 0.5, y: 0 })
    expect(offset()!.end).toEqual({ x: 1.5, y: 0 })
  })

  it('leaves the extent alone — the wedge covers the same notes wherever it is drawn', () => {
    setHairpinOffset(score, id, 2, 2)
    const h = getHairpinById(score, id)!
    expect([fracToNumber(h.beat), fracToNumber(h.length)]).toEqual([0, 2])
  })

  it('resets both ends at once, and declines when neither carries one', () => {
    expect(resetHairpinOffset(score, id)).toBe(false)
    setHairpinOffset(score, id, 1, 1)
    expect(resetHairpinOffset(score, id)).toBe(true)
    expect(offset()).toBeUndefined()
  })

  it('returns false for an unknown hairpin rather than orphaning an override', () => {
    expect(setHairpinOffset(score, 'ghost', 1, 1)).toBe(false)
    expect(score.engravingOverrides).toBeUndefined()
  })
})

/**
 * ⭐ {@link setHairpinVoiceScope} — the wedge's half of P4. `setDynamicVoiceScope`'s twin, and the
 * same one claim: `'all'` removes the field.
 */
describe('setHairpinVoiceScope', () => {
  let score: Score
  let id: string

  beforeEach(() => {
    score = new ScoreModel().getScore()
    id = addHairpin(score, 1, { type: 'cresc', beat: frac(0, 1), length: frac(2, 1) })!.id
  })

  const mark = () => getHairpinById(score, id)!

  it('narrows an unscoped wedge, and `all` takes the field back out', () => {
    expect(setHairpinVoiceScope(score, id, 3)).toBe(true)
    expect(mark().voice).toBe(3)
    expect(setHairpinVoiceScope(score, id, 'all')).toBe(true)
    expect('voice' in mark()).toBe(false)
  })

  it('⛔ declines a no-op, and an unknown id', () => {
    expect(setHairpinVoiceScope(score, id, 'all')).toBe(false)
    expect(setHairpinVoiceScope(score, 'ghost', 0)).toBe(false)
  })
})

/**
 * ⭐⭐ {@link setHairpinAtStaffSlot} — **the wedge lands on ANOTHER STAFF**, his ask 2026-08-21:
 * *"we already did on dynamic correctly, now we should apply this also to hairpin."*
 *
 * `dynamicOps.setDynamicAtStaffSlot`'s claims one lane over, plus the one this family adds: the
 * LENGTH rides along, because the extent is an amount of music and the other staff has the same bars.
 */
describe('setHairpinAtStaffSlot — a staff is a place too', () => {
  let model: ScoreModel
  let score: Score
  let id: string
  let lower: string

  beforeEach(() => {
    model = new ScoreModel()
    lower = model.addStaffBelow(0)
    score = model.getScore()
    // Beats 0 and 1 on the TOP staff; beat 0 only on the lower one (a half note covers 0..1 there).
    for (const b of [0, 1]) {
      model.addNote({ step: 'C', octave: 5, alter: 0, duration: 'q', measure: 1, beat: frac(b, 1) } as never)
    }
    model.addNote({ step: 'C', octave: 3, alter: 0, duration: 'h', measure: 1, beat: frac(0, 1), staff: 1 } as never)
    id = addHairpin(score, 1, { type: 'cresc', beat: frac(0, 1), length: frac(2, 1) })!.id
  })

  const mark = () => getHairpinById(score, id)!

  it('⭐⭐ hands the wedge to the other staff, at the SAME address, KEEPING its length', () => {
    expect(setHairpinAtStaffSlot(score, id, { measure: 1, beat: frac(0, 1), staffId: lower })).toBe(true)
    expect(mark().staffId).toBe(lower)
    expect(fracToNumber(mark().length), 'the extent is an amount of MUSIC, not a second address').toBe(2)
  })

  it('⭐ …and back, storing the FIRST staff as an ABSENT id — one spelling, not two', () => {
    setHairpinAtStaffSlot(score, id, { measure: 1, beat: frac(0, 1), staffId: lower })
    expect(setHairpinAtStaffSlot(score, id, {
      measure: 1, beat: frac(0, 1), staffId: score.staves![0].id,
    })).toBe(true)
    expect('staffId' in mark()).toBe(false)
    expect(JSON.parse(model.toJSON()).measures[0].hairpins[0]).not.toHaveProperty('staffId')
  })

  it('⭐⭐ the VOICE SCOPE survives the move — scope is not position', () => {
    setHairpinVoiceScope(score, id, 2)
    setHairpinAtStaffSlot(score, id, { measure: 1, beat: frac(0, 1), staffId: lower })
    expect(mark().voice).toBe(2)
  })

  it('⭐ the landing slot is looked for on the TARGET staff, not the one it is leaving', () => {
    // Beat 1 is an onset on the top staff and NOT on the lower one.
    expect(setHairpinAtStaffSlot(score, id, { measure: 1, beat: frac(1, 1), staffId: lower })).toBe(false)
    expect('staffId' in mark()).toBe(false)
  })

  it('⛔ declines when neither the staff nor the address would change — a drag frame asks this', () => {
    expect(setHairpinAtStaffSlot(score, id, { measure: 1, beat: frac(0, 1), staffId: undefined })).toBe(false)
  })

  it('⛔ declines for an id no longer in the score', () => {
    expect(setHairpinAtStaffSlot(score, 'ghost', { measure: 1, beat: frac(0, 1), staffId: lower })).toBe(false)
  })
})
