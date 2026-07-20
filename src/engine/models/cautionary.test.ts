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
