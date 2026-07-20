import { describe, it, expect } from 'vitest'
import { ScoreModel } from './ScoreModel'
import { cautionaryAllowedOf, cautionaryKey } from './engravingOverrides'

/**
 * A courtesy time signature is a property of the CHANGE, in two halves: this flag, and whether that
 * change happens to open a system (the layout's half). Nothing is drawn and then hidden — a
 * courtesy that is not allowed is never produced.
 */
describe('cautionary time signature', () => {
  const model = () => new ScoreModel()

  it('allows none by default — a courtesy exists only where a change says so', () => {
    const m = model()
    const measure = m.getScore().measures[0]
    expect(cautionaryAllowedOf(m.getScore(), measure.id)).toBe(false)
  })

  it('records the allowance against the measure the change STARTS at', () => {
    const m = model()
    const measure = m.getScore().measures[0]
    expect(m.setCautionaryAllowed(measure.id, true)).toBe(true)
    expect(cautionaryAllowedOf(m.getScore(), measure.id)).toBe(true)
    expect(m.getScore().engravingOverrides?.[cautionaryKey(measure.id)]).toEqual([{ kind: 'cautionary' }])
  })

  it('reports no change when told what it already knows', () => {
    const m = model()
    const measure = m.getScore().measures[0]
    m.setCautionaryAllowed(measure.id, true)
    expect(m.setCautionaryAllowed(measure.id, true)).toBe(false)
  })

  // Disallowing REMOVES the entry rather than storing a false: the compartment holds departures
  // from the default, so a score that allows nothing carries nothing.
  it('leaves the compartment empty again when disallowed', () => {
    const m = model()
    const measure = m.getScore().measures[0]
    m.setCautionaryAllowed(measure.id, true)
    m.setCautionaryAllowed(measure.id, false)
    expect(m.getScore().engravingOverrides?.[cautionaryKey(measure.id)] ?? []).toEqual([])
  })
})

/**
 * C and ¢ are how 4/4 and 2/2 are PRINTED, so the spelling has to survive being stored. It did not:
 * `copyTimeSignature` listed its fields by hand, so the meter arrived as 4/4-drawn-as-C and was
 * kept as a bare 4/4 — the ghost drew C and the score drew 4/4.
 */
describe('a meter keeps how it is printed', () => {
  it('stores the symbol through setTimeSignature', () => {
    const m = new ScoreModel()
    m.setTimeSignature(1, { numerator: 4, denominator: 4, symbol: 'common' })
    expect(m.getScore().measures[0].timeSignature.symbol).toBe('common')
  })

  it('carries it to the measures that inherit the change', () => {
    const m = new ScoreModel()
    m.addMeasure()
    m.addMeasure()
    m.setTimeSignature(1, { numerator: 2, denominator: 2, symbol: 'cut' })
    expect(m.getScore().measures.map((measure) => measure.timeSignature.symbol)).toEqual(['cut', 'cut', 'cut'])
  })

  it('keeps a grouping alongside it, still deep-copied', () => {
    const m = new ScoreModel()
    const grouping = [3, 2, 2]
    m.setTimeSignature(1, { numerator: 7, denominator: 8, grouping })
    grouping[0] = 99 // the caller's array must not be the score's
    expect(m.getScore().measures[0].timeSignature.grouping).toEqual([3, 2, 2])
  })
})
