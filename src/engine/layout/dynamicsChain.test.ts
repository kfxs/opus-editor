/**
 * {@link levelDynamicsChains} — things that TOUCH share a line.
 *
 * ⭐ Headless because the module is: it takes each member's own answer and its span, and returns the
 * answer it should use. No stave, no font, no SVG — which is what lets the rule be stated as
 * assertions about numbers rather than about pixels. Whether the drawn wedges actually line up is
 * `e2e/hairpin.e2e.ts`'s.
 */
import { describe, it, expect } from 'vitest'
import { fracCreate as frac } from '@/utils/fraction'
import { levelDynamicsChains, type ChainItem } from './dynamicsChain'

/** A member: `key`, the absolute beats it covers, and the baseline the local rule gave it. */
const item = (
  key: string,
  start: number,
  end: number,
  baseline: number,
  extra: Partial<ChainItem> = {},
): ChainItem => ({
  key,
  line: 0,
  staffId: undefined,
  placement: 'below',
  start: frac(start, 1),
  end: frac(end, 1),
  baseline,
  ...extra,
})

describe('levelDynamicsChains', () => {
  it('leaves a lone mark exactly where the local rule put it', () => {
    // The guarantee that keeps P1's local rule intact: touching nothing means a chain of one.
    const out = levelDynamicsChains([item('a', 0, 0, 6.1), item('b', 8, 8, 9.4)])
    expect(out.get('a')).toBe(6.1)
    expect(out.get('b')).toBe(9.4)
  })

  it('⭐⭐ two wedges that MEET take the outermost of the two', () => {
    // His case: `< >` where the first sits over a low C. Before, each took its own answer and the
    // pair stepped mid-gesture.
    const out = levelDynamicsChains([item('cresc', 0, 2, 8.0), item('dim', 2, 4, 6.1)])
    expect(out.get('cresc')).toBe(8.0)
    expect(out.get('dim')).toBe(8.0)
  })

  it('⭐⭐ chains ACROSS a barline — a wedge ending on one and a wedge starting on it', () => {
    // The decision he took over a bar-bounded variant: connected marks stepping apart reads worse
    // than a slightly generous line. A bar is a spelling convenience, not a phrase.
    const out = levelDynamicsChains([item('barOne', 0, 4, 6.1), item('barTwo', 4, 8, 9.0)])
    expect(out.get('barOne')).toBe(9.0)
    expect(out.get('barTwo')).toBe(9.0)
  })

  it('a LETTER at a wedge\'s end joins it — touching is joining', () => {
    // `>` running into an `f`: the letter is a point on the axis, and `end >= start` catches it.
    const out = levelDynamicsChains([item('wedge', 0, 4, 8.5), item('f', 4, 4, 6.1)])
    expect(out.get('f')).toBe(8.5)
  })

  it('a letter one beat PAST the wedge is its own chain', () => {
    const out = levelDynamicsChains([item('wedge', 0, 4, 8.5), item('f', 5, 5, 6.1)])
    expect(out.get('wedge')).toBe(8.5)
    expect(out.get('f')).toBe(6.1)
  })

  it('an ABOVE chain takes the HIGHEST, not the lowest', () => {
    // Outermost means "furthest from the staff", and on this axis that is the smaller number.
    const above = { placement: 'above' as const }
    const out = levelDynamicsChains([item('a', 0, 2, -3.0, above), item('b', 2, 4, -5.5, above)])
    expect(out.get('a')).toBe(-5.5)
    expect(out.get('b')).toBe(-5.5)
  })

  it('⚠️ never chains across a SYSTEM — two marks a line apart are not one gesture', () => {
    const out = levelDynamicsChains([item('a', 0, 4, 6.1), item('b', 4, 8, 9.0, { line: 1 })])
    expect(out.get('a')).toBe(6.1)
    expect(out.get('b')).toBe(9.0)
  })

  it('⚠️ never chains across a STAFF, nor across sides', () => {
    const out = levelDynamicsChains([
      item('upper', 0, 4, 6.1),
      item('lower', 4, 8, 9.0, { staffId: 'lower' }),
      item('over', 4, 8, -4.0, { placement: 'above' }),
    ])
    expect(out.get('upper')).toBe(6.1)
    expect(out.get('lower')).toBe(9.0)
    expect(out.get('over')).toBe(-4.0)
  })

  it('a RUN of three levels all of them, and the extreme need not be at an end', () => {
    const out = levelDynamicsChains([
      item('a', 0, 2, 6.1), item('b', 2, 4, 11.0), item('c', 4, 6, 6.1),
    ])
    expect([out.get('a'), out.get('b'), out.get('c')]).toEqual([11.0, 11.0, 11.0])
  })

  it('a member fully INSIDE another (a letter under a long wedge) joins it', () => {
    const out = levelDynamicsChains([item('long', 0, 16, 7.0), item('mid', 8, 8, 6.1)])
    expect(out.get('mid')).toBe(7.0)
  })

  it('breaks the chain after a gap, however long the run before it', () => {
    const out = levelDynamicsChains([
      item('a', 0, 2, 9.0), item('b', 2, 4, 9.0), item('gap', 6, 8, 6.1),
    ])
    expect(out.get('b')).toBe(9.0)
    expect(out.get('gap')).toBe(6.1)
  })

  it('is order-independent — the input is a set, not a sequence', () => {
    const forward = levelDynamicsChains([item('a', 0, 2, 6.1), item('b', 2, 4, 9.0)])
    const backward = levelDynamicsChains([item('b', 2, 4, 9.0), item('a', 0, 2, 6.1)])
    expect(forward).toEqual(backward)
  })

  it('answers for every item handed in, and for nothing else', () => {
    const out = levelDynamicsChains([item('a', 0, 2, 6.1), item('b', 5, 5, 7.0)])
    expect([...out.keys()].sort()).toEqual(['a', 'b'])
  })
})
