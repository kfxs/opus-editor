import { describe, it, expect } from 'vitest'
import { setBarlineSpace } from './overrideOps'
import { barlineSpaceKey, barlineSpaceOf, measureLeadingSpaces, measureUserSpacePx, spacingPositionKey } from './engravingOverrides'
import { setNoteSpacing } from './overrideOps'
import { fracCreate } from '@/utils/fraction'
import type { Score } from '@/types/music'

/**
 * The write side of the BARLINE GAP — the space between a bar's last element and the line that ends
 * it (`BarlineSpaceOverride`).
 *
 * The arithmetic only. Whether the gap actually opens in the drawing is `e2e/barlineGap.e2e.ts`'s
 * job: it depends on the line's justification, and every width in jsdom is zero.
 */
const score = (): Score => ({ id: 's', title: '', measures: [] } as unknown as Score)
const M = 'measure-1'

describe('setBarlineSpace', () => {
  it('stores the asked space, in staff-spaces', () => {
    const s = score()
    expect(setBarlineSpace(s, barlineSpaceKey(M), 1.5, -99)).toBe(1.5)
    expect(barlineSpaceOf(s, M)).toBe(1.5)
  })

  it('clamps against the caller\'s measured floor — only the last render knows it', () => {
    const s = score()
    expect(setBarlineSpace(s, barlineSpaceKey(M), -5, -1.25)).toBe(-1.25)
    expect(barlineSpaceOf(s, M)).toBe(-1.25)
  })

  it('zero CLEARS the entry, so "absent = the engraver\'s own gap" holds', () => {
    const s = score()
    setBarlineSpace(s, barlineSpaceKey(M), 2, -99)
    setBarlineSpace(s, barlineSpaceKey(M), 0, -99)
    expect(barlineSpaceOf(s, M)).toBe(0)
    expect(s.engravingOverrides?.[barlineSpaceKey(M)] ?? []).toHaveLength(0)
  })

  it('is absent by default — nobody pays for a feature they have not used', () => {
    expect(barlineSpaceOf(score(), M)).toBe(0)
  })
})

describe('the barline gap in the width math', () => {
  it('is summed into the bar\'s authored space, which is all its plumbing', () => {
    const s = score()
    setBarlineSpace(s, barlineSpaceKey(M), 2, -99)
    expect(measureUserSpacePx(s, M), '2 staff-spaces = 20px of extra bar').toBe(20)
  })

  it('adds to any leading spaces the bar already carries, rather than replacing them', () => {
    const s = score()
    setNoteSpacing(s, spacingPositionKey(M, fracCreate(1, 1)), 1, -99)
    setBarlineSpace(s, barlineSpaceKey(M), 2, -99)
    expect(measureUserSpacePx(s, M)).toBe(30)
  })

  it('⭐ is NOT reachable as a column address — it shifts no note', () => {
    // `measureLeadingSpaces` is what the renderer's shift pass walks. A gap before the barline must
    // never appear there: it widens the bar and moves nothing, which is the whole difference
    // between this and a leading space.
    const s = score()
    setBarlineSpace(s, barlineSpaceKey(M), 2, -99)
    expect(measureLeadingSpaces(s, M)).toEqual([])
  })

  it('and its key cannot be mistaken for a column\'s', () => {
    const s = score()
    setBarlineSpace(s, barlineSpaceKey(M), 2, -99)
    setNoteSpacing(s, spacingPositionKey(M, fracCreate(3, 1)), 1, -99)
    expect(measureLeadingSpaces(s, M).map(x => x.space), 'one column space, not two').toEqual([1])
    expect(barlineSpaceOf(s, M), 'and the barline gap is still its own value').toBe(2)
  })
})
