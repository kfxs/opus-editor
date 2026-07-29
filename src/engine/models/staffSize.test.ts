import { describe, it, expect } from 'vitest'
import { ScoreModel } from './ScoreModel'
import { resolveStaffSize, setStaffSize, isValidStaffSize, STAFF_SPACE_PX, DEFAULT_STAFF_SIZE } from './staffSize'

/** A two-staff model; returns it with both staff ids. */
function twoStaves(): { model: ScoreModel, top: string, bottom: string } {
  const model = new ScoreModel()
  const top = model.getScore().staves![0].id
  const bottom = model.addStaffBelow(0)
  return { model, top, bottom }
}

describe('staffSize — the value', () => {
  it('absent size resolves to full size (1), by rule and not by a stored default', () => {
    const { model, top } = twoStaves()
    expect(resolveStaffSize(model.getScore(), top)).toBe(DEFAULT_STAFF_SIZE)
    expect(model.getScore().staves![0].size).toBeUndefined()
  })

  it('resolves the ratio a staff was given, per staff', () => {
    const { model, top, bottom } = twoStaves()
    model.setStaffSize(top, 0.7)
    expect(resolveStaffSize(model.getScore(), top)).toBe(0.7)
    expect(resolveStaffSize(model.getScore(), bottom)).toBe(1)
  })

  it('is a ratio, not two states — any positive number is legal', () => {
    const { model, top } = twoStaves()
    for (const size of [0.55, 0.8, 1.25, 2]) {
      expect(model.setStaffSize(top, size)).toBe(true)
      expect(resolveStaffSize(model.getScore(), top)).toBe(size)
    }
  })

  it('an unknown staff id is full size, never undefined (every caller needs a number)', () => {
    const { model } = twoStaves()
    expect(resolveStaffSize(model.getScore(), 'no-such-staff')).toBe(1)
  })

  it('accepts an opening-measure id today and ignores it (per-system size is not built)', () => {
    const { model, top } = twoStaves()
    model.setStaffSize(top, 0.7)
    const m1 = model.getScore().measures[0].id
    expect(resolveStaffSize(model.getScore(), top, m1)).toBe(0.7)
    expect(resolveStaffSize(model.getScore(), top, 'any-other-measure')).toBe(0.7)
  })

  it('STAFF_SPACE_PX is the score staff size the layout math converts against', () => {
    expect(STAFF_SPACE_PX).toBe(10)
  })
})

describe('staffSize — the mutator', () => {
  it('setting back to 1 CLEARS the field, so absent = full size holds and the JSON stays clean', () => {
    const { model, top } = twoStaves()
    model.setStaffSize(top, 0.7)
    expect(model.setStaffSize(top, 1)).toBe(true)
    expect('size' in model.getScore().staves![0]).toBe(false)
  })

  it('reports no change when the size is already what was asked', () => {
    const { model, top } = twoStaves()
    expect(model.setStaffSize(top, 0.7)).toBe(true)
    expect(model.setStaffSize(top, 0.7)).toBe(false)
    expect(model.setStaffSize(top, 1)).toBe(true)
    expect(model.setStaffSize(top, 1)).toBe(false)
  })

  it('refuses a size that is not a drawable ratio, leaving the staff untouched', () => {
    const { model, top } = twoStaves()
    model.setStaffSize(top, 0.7)
    for (const bad of [0, -1, NaN, Infinity]) {
      expect(model.setStaffSize(top, bad)).toBe(false)
    }
    expect(resolveStaffSize(model.getScore(), top)).toBe(0.7)
  })

  it('refuses an unknown staff id rather than inventing a staff', () => {
    const { model } = twoStaves()
    expect(setStaffSize(model.getScore(), 'no-such-staff', 0.7)).toBe(false)
    expect(model.getScore().staves!.every(s => s.size === undefined)).toBe(true)
  })

  it('isValidStaffSize is the one predicate both the mutator and the load boundary ask', () => {
    expect(isValidStaffSize(0.7)).toBe(true)
    expect(isValidStaffSize(1)).toBe(true)
    expect(isValidStaffSize(0)).toBe(false)
    expect(isValidStaffSize(-0.5)).toBe(false)
    expect(isValidStaffSize(NaN)).toBe(false)
  })
})

describe('staffSize — JSON', () => {
  it('round-trips the ratio, per staff', () => {
    const { model, top, bottom } = twoStaves()
    model.setStaffSize(bottom, 0.7)

    const loaded = ScoreModel.fromJSON(model.toJSON())
    expect(resolveStaffSize(loaded.getScore(), bottom)).toBe(0.7)
    expect(resolveStaffSize(loaded.getScore(), top)).toBe(1)
  })

  it('a full-size staff writes no size at all', () => {
    const { model } = twoStaves()
    expect(model.toJSON()).not.toContain('"size"')
  })

  it('REPORTS a size that is not a drawable ratio rather than repairing it', () => {
    const { model, top } = twoStaves()
    const raw = JSON.parse(model.toJSON())
    raw.staves[0].size = 0
    expect(() => ScoreModel.fromJSON(JSON.stringify(raw))).toThrow(/staff size/i)
    // and the staff id is named, so the report says WHICH staff
    expect(() => ScoreModel.fromJSON(JSON.stringify(raw))).toThrow(new RegExp(top))
  })
})
