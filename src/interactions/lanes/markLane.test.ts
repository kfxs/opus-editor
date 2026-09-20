import { describe, it, expect, vi } from 'vitest'
import type { Score } from '../../types/music'
import type { ElementRegistry } from '../../engine/ElementRegistry'
import { fracCreate as frac } from '../../utils/fraction'
import { staffIndexOf, markStaffSpacePx, sameSlotAddress } from './markLane'

const score = (ids?: string[]) => ({ staves: ids?.map(id => ({ id })) } as unknown as Score)

describe('markLane.staffIndexOf', () => {
  it('absent IS the first staff — and so is an id the score no longer has', () => {
    expect(staffIndexOf(score(['a', 'b']), undefined)).toBe(0)
    expect(staffIndexOf(score(['a', 'b']), 'gone')).toBe(0)
    expect(staffIndexOf(score(), 'a')).toBe(0)
  })
  it('names the staff by its position', () => {
    expect(staffIndexOf(score(['a', 'b']), 'b')).toBe(1)
  })
})

describe('markLane.markStaffSpacePx', () => {
  const registry = (drawn: object[], lineSpacing?: number) => ({
    getByType: vi.fn(() => drawn),
    getStaffGeometry: vi.fn(() => (lineSpacing === undefined ? undefined : { lineSpacing })),
  })

  it('reads the staff space of the staff the mark was DRAWN on, by its own kind', () => {
    const r = registry([{ id: 'o1', measure: 3, staff: 1 }], 7)
    expect(markStaffSpacePx(r as unknown as ElementRegistry, 'ottava', 'o1')).toBe(7)
    expect(r.getByType).toHaveBeenCalledWith('ottava')
    expect(r.getStaffGeometry).toHaveBeenCalledWith(3, 1)
  })
  it('⛔ answers null rather than guess: nothing drawn, no bar on the entry, or no measured staff', () => {
    expect(markStaffSpacePx(registry([]) as unknown as ElementRegistry, 'pedal', 'p1')).toBeNull()
    expect(markStaffSpacePx(registry([{ id: 'p1' }], 7) as unknown as ElementRegistry, 'pedal', 'p1')).toBeNull()
    expect(markStaffSpacePx(registry([{ id: 'p1', measure: 1 }]) as unknown as ElementRegistry, 'pedal', 'p1')).toBeNull()
  })
})

describe('markLane.sameSlotAddress', () => {
  it('compares the beat as a FRACTION, not by its spelling', () => {
    expect(sameSlotAddress({ measure: 2, beat: frac(1, 2) }, { measure: 2, beat: frac(2, 4) })).toBe(true)
    expect(sameSlotAddress({ measure: 2, beat: frac(1, 2) }, { measure: 3, beat: frac(1, 2) })).toBe(false)
  })
})
