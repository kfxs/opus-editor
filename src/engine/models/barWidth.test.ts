import { describe, it, expect } from 'vitest'
import { ScoreModel } from './ScoreModel'
import {
  barWidthKey,
  barWidthOverrideOf,
  measureStretch,
  spacingPositionKey,
  restPositionKey,
  BAR_STRETCH_MIN,
  BAR_STRETCH_MAX,
} from './engravingOverrides'
import { fracCreate } from '@/utils/fraction'
import type { BarWidthOverride } from '@/types/music'

/**
 * Client #11 — user-authored bar stretch (docs/bar-width-plan.md §1).
 *
 * The key is id-keyed and the value is a MULTIPLIER; both are the design, and both are pinned
 * here. So is the pair of write-time clamps: the caller's measured floor, and the absolute one
 * that stops a hand-typed `0` in the Score JSON panel from producing a negative-width bar.
 */
describe('barWidthKey', () => {
  it('names the BAR, by id — which is why a rebar carries the stretch for free', () => {
    expect(barWidthKey('m1')).toBe('m1:barwidth')
  })

  it('starts with `{measureId}:`, which is what sweeps it into the measure shape key', () => {
    expect(barWidthKey('m7').startsWith('m7:')).toBe(true)
  })

  it('cannot collide with the other position-keyed clients in the same bar', () => {
    const beat = fracCreate(1, 1)
    expect(barWidthKey('m1')).not.toBe(spacingPositionKey('m1', beat))
    expect(barWidthKey('m1')).not.toBe(restPositionKey('m1', 0, beat))
    expect(barWidthKey('m1')).not.toBe(restPositionKey('m1', 0, beat, 'staff-2'))
  })
})

describe('ScoreModel.setBarWidth', () => {
  const setup = () => {
    const model = new ScoreModel()
    return { model, key: barWidthKey(model.getScore().measures[0].id) }
  }

  it('stores the stretch as a multiplier', () => {
    const { model, key } = setup()
    model.setBarWidth(key, 1.5, BAR_STRETCH_MIN)
    expect(barWidthOverrideOf(model.getScore(), model.getScore().measures[0].id)?.stretch).toBe(1.5)
  })

  it('clears at 1, so absent = the engraver’s own width', () => {
    const { model, key } = setup()
    model.setBarWidth(key, 1.5, BAR_STRETCH_MIN)
    model.setBarWidth(key, 1, BAR_STRETCH_MIN)
    expect(barWidthOverrideOf(model.getScore(), model.getScore().measures[0].id)).toBeUndefined()
  })

  it('reads back as 1 when nobody has touched the bar', () => {
    const model = new ScoreModel()
    expect(measureStretch(model.getScore(), model.getScore().measures[0].id)).toBe(1)
  })

  it('clamps to the caller’s measured floor — the clamp is on the way IN', () => {
    const { model, key } = setup()
    expect(model.setBarWidth(key, 0.4, 0.8)).toBe(0.8)
  })

  it('clamps a hand-authored 0 to the absolute floor — a negative-width bar is not reachable', () => {
    const { model, key } = setup()
    expect(model.setBarWidth(key, 0, BAR_STRETCH_MIN)).toBe(BAR_STRETCH_MIN)
    expect(model.setBarWidth(key, -3, -100)).toBe(BAR_STRETCH_MIN)
  })

  it('clamps an absurd stretch to the absolute ceiling', () => {
    const { model, key } = setup()
    expect(model.setBarWidth(key, 500, BAR_STRETCH_MIN)).toBe(BAR_STRETCH_MAX)
  })

  it('a clamp that lands exactly on 1 clears the entry rather than storing 1', () => {
    const { model, key } = setup()
    model.setBarWidth(key, 2, BAR_STRETCH_MIN)
    expect(model.setBarWidth(key, 0.5, 1)).toBe(1)
    expect(barWidthOverrideOf(model.getScore(), model.getScore().measures[0].id)).toBeUndefined()
  })

  it('does not snapshot — the facade owns undo, or a drag pushes one entry per frame', () => {
    const { model, key } = setup()
    const before = JSON.stringify(model.getScore())
    model.setBarWidth(key, 2, BAR_STRETCH_MIN)
    expect(JSON.stringify(model.getScore())).not.toBe(before)
  })
})

describe('measureStretch — what the layout honours', () => {
  it('bounds a value that never passed through setBarWidth (an imported / hand-edited score)', () => {
    const model = new ScoreModel()
    const m = model.getScore().measures[0].id
    model.setEngravingOverride(barWidthKey(m), { kind: 'barWidth', stretch: 0 } as BarWidthOverride)
    expect(measureStretch(model.getScore(), m)).toBe(BAR_STRETCH_MIN)
    model.setEngravingOverride(barWidthKey(m), { kind: 'barWidth', stretch: 5000 } as BarWidthOverride)
    expect(measureStretch(model.getScore(), m)).toBe(BAR_STRETCH_MAX)
  })

  it('reports the stored value verbatim — it bounds the layout, it does not repair the score', () => {
    const model = new ScoreModel()
    const m = model.getScore().measures[0].id
    model.setEngravingOverride(barWidthKey(m), { kind: 'barWidth', stretch: 0 } as BarWidthOverride)
    expect(barWidthOverrideOf(model.getScore(), m)?.stretch).toBe(0)
  })

  it('treats a non-numeric stretch as no stretch at all', () => {
    const model = new ScoreModel()
    const m = model.getScore().measures[0].id
    model.setEngravingOverride(barWidthKey(m), { kind: 'barWidth', stretch: NaN } as BarWidthOverride)
    expect(measureStretch(model.getScore(), m)).toBe(1)
  })
})
