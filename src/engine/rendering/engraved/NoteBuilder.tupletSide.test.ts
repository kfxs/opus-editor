/**
 * The single-voice DEFAULT side of a tuplet's number and bracket: the STEM side (his rule, 2026-09-29 — a
 * stems-up triplet had its number under the heads). Stand-in notes carry only what the rule asks.
 */
import { describe, it, expect } from 'vitest'
import { stemMajorityTupletLocation, tupletOnNoteheadSide, TUPLET_LOCATION_ABOVE, TUPLET_LOCATION_BELOW } from './NoteBuilder'

type Notes = Parameters<typeof stemMajorityTupletLocation>[0]
const stem = (dir: 1 | -1) => ({ isRest: () => false, hasStem: () => true, getStem: () => ({}), getStemDirection: () => dir })
const rest = () => ({ isRest: () => true, hasStem: () => true, getStem: () => ({}), getStemDirection: () => -1 })
const whole = () => ({ isRest: () => false, hasStem: () => false, getStem: () => undefined, getStemDirection: () => -1 })
const side = (...notes: object[]) => stemMajorityTupletLocation(notes as unknown as Notes)

describe('stemMajorityTupletLocation — the STEM side', () => {
  it('stems UP → the mark goes ABOVE (reported: C4 D4 E4 sixteenths drew it below)', () => {
    expect(side(stem(1), stem(1), stem(1))).toBe(TUPLET_LOCATION_ABOVE)
  })

  it('stems DOWN → BELOW', () => {
    expect(side(stem(-1), stem(-1), stem(-1))).toBe(TUPLET_LOCATION_BELOW)
  })

  it('the majority decides; a tie goes above', () => {
    expect(side(stem(-1), stem(-1), stem(1))).toBe(TUPLET_LOCATION_BELOW)
    expect(side(stem(-1), stem(1))).toBe(TUPLET_LOCATION_ABOVE)
  })

  it('a REST or a stemless note has no vote — it does not drag an up-stem group below', () => {
    expect(side(stem(1), rest(), rest())).toBe(TUPLET_LOCATION_ABOVE)
    expect(side(whole(), whole(), whole())).toBe(TUPLET_LOCATION_ABOVE)
    expect(side(rest(), stem(-1), rest())).toBe(TUPLET_LOCATION_BELOW)
  })
})

describe('tupletOnNoteheadSide — the mark opposite the stem majority', () => {
  const on = (location: number, ...notes: object[]) => tupletOnNoteheadSide(notes as unknown as Notes, location)

  it('stems up with the mark below, or stems down with it above, is the notehead side', () => {
    expect(on(TUPLET_LOCATION_BELOW, stem(1), stem(1), stem(1))).toBe(true)
    expect(on(TUPLET_LOCATION_ABOVE, stem(-1), stem(-1))).toBe(true)
  })

  it('on the stem side it is not', () => {
    expect(on(TUPLET_LOCATION_ABOVE, stem(1), stem(1))).toBe(false)
    expect(on(TUPLET_LOCATION_BELOW, stem(-1), rest())).toBe(false)
  })

  it('an even split, or no stems at all, has no notehead side', () => {
    expect(on(TUPLET_LOCATION_BELOW, stem(1), stem(-1))).toBe(false)
    expect(on(TUPLET_LOCATION_ABOVE, rest(), whole())).toBe(false)
  })
})
