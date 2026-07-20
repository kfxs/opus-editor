import { describe, it, expect } from 'vitest'
import { ScoreModel } from './ScoreModel'
import { cautionaryAllowedOf, cautionaryClefAllowedOf, cautionaryKey } from './engravingOverrides'

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
 * The clef twin, keyed per STAFF as well as per measure — a clef belongs to one staff, unlike a
 * meter, which is score-wide.
 */
describe('cautionary clef', () => {
  it('allows none by default', () => {
    const m = new ScoreModel()
    expect(cautionaryClefAllowedOf(m.getScore(), m.getScore().measures[0].id, undefined)).toBe(false)
  })

  it('keys the allowance to a staff, so one staff does not answer for another', () => {
    const m = new ScoreModel()
    const measure = m.getScore().measures[0]
    m.setCautionaryClefAllowed(measure.id, 'staff-2', true)
    expect(cautionaryClefAllowedOf(m.getScore(), measure.id, 'staff-2')).toBe(true)
    expect(cautionaryClefAllowedOf(m.getScore(), measure.id, 'staff-1')).toBe(false)
    expect(cautionaryClefAllowedOf(m.getScore(), measure.id, undefined)).toBe(false)
  })

  // ⚠️ The bug this feature shipped with: the writer resolved staff 0 through `staffIdForIndex`,
  // which returns UNDEFINED for it, while the reader passed the first staff's real id — two keys
  // for one staff, and the flag was written where nobody looked. Absent IS the first staff.
  it('writes staff 0 under the ABSENT-staff key, which is where the layout looks', () => {
    const m = new ScoreModel()
    const measure = m.getScore().measures[0]
    m.setCautionaryClefAllowed(measure.id, undefined, true)
    const firstStaffRealId = m.getScore().staves?.[0]?.id
    expect(cautionaryClefAllowedOf(m.getScore(), measure.id, undefined)).toBe(true)
    // Named explicitly, the same staff answers NO — which is exactly how it failed on screen.
    if (firstStaffRealId) {
      expect(cautionaryClefAllowedOf(m.getScore(), measure.id, firstStaffRealId)).toBe(false)
    }
  })

  // Its own KIND, so a clef's courtesy and a meter's cannot be read for one another even though
  // both hang off the same measure.
  it('does not answer for the meter\'s courtesy at the same measure', () => {
    const m = new ScoreModel()
    const measure = m.getScore().measures[0]
    m.setCautionaryClefAllowed(measure.id, undefined, true)
    expect(cautionaryAllowedOf(m.getScore(), measure.id)).toBe(false)
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
