/**
 * WHICH grouping signs stand at a bar, and in what order.
 *
 * Subject: {@link groupsAt}. ⭐ The two facts worth pinning are the **gate** (a group with no
 * `symbol` draws nothing — the auto-writer's groups must stay invisible) and the **order**
 * (innermost first, because the smaller group's sign is drawn further left).
 */
import { describe, it, expect } from 'vitest'
import { groupsAt } from './staffGroups'
import type { Score, StaffGroup } from '@/types/music'

const score = (staffCount: number, groups?: StaffGroup[]): Score => ({
  id: 's', title: '', measures: [],
  staves: Array.from({ length: staffCount }, (_, i) => ({ id: `st${i}` })),
  ...(groups ? { staffGroups: groups } : {}),
}) as unknown as Score

const all = (n: number) => Array.from({ length: n }, (_, i) => `st${i}`)

describe('the gate — ⛔ `symbol`, not the overlay’s presence', () => {
  it('🚨🚨 a group with NO symbol draws nothing — this is what keeps the auto-writer invisible', () => {
    // Exactly what `ScoreModel.ensureSingleGroupSpansAllStaves` writes on every `addStaff`.
    expect(groupsAt(score(2, [{ id: 'g', staffIds: all(2) }]), 1)).toEqual([])
  })

  it('…and the SAME group with a symbol does draw', () => {
    const found = groupsAt(score(2, [{ id: 'g', staffIds: all(2), symbol: 'brace' }]), 1)
    expect(found).toHaveLength(1)
    expect(found[0].symbol).toBe('brace')
    expect([found[0].topStaffIndex, found[0].bottomStaffIndex]).toEqual([0, 1])
  })

  it('no overlay at all is no signs', () => {
    expect(groupsAt(score(2), 1)).toEqual([])
  })
})

describe('what is skipped rather than drawn wrongly', () => {
  it('⛔ a one-staff score has no system to group', () => {
    expect(groupsAt(score(1, [{ id: 'g', staffIds: ['st0'], symbol: 'brace' }]), 1)).toEqual([])
  })

  it('⛔ a single-staff group is not a system either', () => {
    expect(groupsAt(score(3, [{ id: 'g', staffIds: ['st1'], symbol: 'bracket' }]), 1)).toEqual([])
  })

  it('⛔ staff ids that are not in the score are dropped, and a group left with one is skipped', () => {
    expect(groupsAt(score(2, [{ id: 'g', staffIds: ['st0', 'gone'], symbol: 'brace' }]), 1)).toEqual([])
  })

  it('⚠️ a NON-CONTIGUOUS group resolves to the span it encloses — visibly too wide, ⛔ not silent', () => {
    const found = groupsAt(score(4, [{ id: 'g', staffIds: ['st0', 'st2'], symbol: 'bracket' }]), 1)
    expect([found[0].topStaffIndex, found[0].bottomStaffIndex]).toEqual([0, 2])
  })
})

describe('the order — ⭐⭐ the SMALLER group’s sign is drawn further LEFT', () => {
  it('returns innermost first, whatever order the score lists them in', () => {
    const found = groupsAt(score(4, [
      { id: 'outer', staffIds: all(4), symbol: 'bracket' },
      { id: 'inner', staffIds: ['st0', 'st1'], symbol: 'brace' },
    ]), 1)
    expect(found.map(g => g.group.id)).toEqual(['inner', 'outer'])
  })

  it('⭐ nesting needs NO depth field — a subset IS the inner group, and the sort says so', () => {
    const found = groupsAt(score(6, [
      { id: 'whole', staffIds: all(6), symbol: 'bracket' },
      { id: 'piano', staffIds: ['st4', 'st5'], symbol: 'brace' },
      { id: 'strings', staffIds: ['st0', 'st1', 'st2', 'st3'], symbol: 'bracket' },
    ]), 1)
    expect(found.map(g => g.group.id)).toEqual(['piano', 'strings', 'whole'])
  })

  it('two groups of the same size keep SCORE order — the tie-break is stable, not `sort`’s', () => {
    const found = groupsAt(score(4, [
      { id: 'lower', staffIds: ['st2', 'st3'], symbol: 'brace' },
      { id: 'upper', staffIds: ['st0', 'st1'], symbol: 'brace' },
    ]), 1)
    expect(found.map(g => g.group.id)).toEqual(['upper', 'lower'])
  })
})

describe('the reserved bar', () => {
  it('⭐ answers the same at every bar today — the parameter is the OPEN DOOR, not a feature', () => {
    const s = score(2, [{ id: 'g', staffIds: all(2), symbol: 'brace' }])
    expect(groupsAt(s, 1)).toEqual(groupsAt(s, 40))
    expect(groupsAt(s)).toEqual(groupsAt(s, 1))
  })
})
