/**
 * APPLYING a grouping sign to a run of staves, and keeping the overlay honest.
 *
 * Subject: {@link applyGroupSymbol}, {@link pruneStaffGroups}. ⭐ The division this file pins is the
 * one P5 turns on: **the user owns MEMBERSHIP, the model owns referential integrity**. Before
 * 2026-08-29 the model owned both and rebuilt `staffGroups` as one group over every staff.
 */
import { describe, it, expect } from 'vitest'
import { applyGroupSymbol, pruneStaffGroups } from './staffGroupOps'
import type { Score, StaffGroup } from '@/types/music'

const score = (staffCount = 4, groups?: StaffGroup[]): Score => ({
  id: 's', title: '', measures: [],
  staves: Array.from({ length: staffCount }, (_, i) => ({ id: `st${i}` })),
  ...(groups ? { staffGroups: groups } : {}),
}) as unknown as Score

describe('applying a sign', () => {
  it('⭐ creates a group over exactly the staves named', () => {
    const s = score()
    expect(applyGroupSymbol(s, ['st1', 'st2'], 'bracket')).toBe(true)
    expect(s.staffGroups).toHaveLength(1)
    expect(s.staffGroups![0]).toMatchObject({ staffIds: ['st1', 'st2'], symbol: 'bracket' })
  })

  it('⭐ ONE staff is a legal group — Gould p. 516, and his authoring rule', () => {
    const s = score()
    expect(applyGroupSymbol(s, ['st2'], 'bracket')).toBe(true)
    expect(s.staffGroups![0].staffIds).toEqual(['st2'])
  })

  it('⭐ stores ids in SCORE order, whatever order they arrive in', () => {
    const s = score()
    applyGroupSymbol(s, ['st3', 'st0', 'st2'], 'brace')
    expect(s.staffGroups![0].staffIds).toEqual(['st0', 'st2', 'st3'])
  })

  it('re-applying to the SAME staves replaces the sign — ⛔ it does not stack a second group', () => {
    const s = score()
    applyGroupSymbol(s, ['st0', 'st1'], 'brace')
    const id = s.staffGroups![0].id
    expect(applyGroupSymbol(s, ['st1', 'st0'], 'bracket')).toBe(true) // ⭐ order-independent match
    expect(s.staffGroups).toHaveLength(1)
    expect(s.staffGroups![0]).toMatchObject({ id, symbol: 'bracket' })
  })

  it('⭐ a DIFFERENT run of staves is a different group — this is what nesting is made of', () => {
    const s = score()
    applyGroupSymbol(s, ['st0', 'st1'], 'brace')
    applyGroupSymbol(s, ['st0', 'st1', 'st2', 'st3'], 'bracket')
    expect(s.staffGroups).toHaveLength(2)
  })

  it('⛔ answers false when nothing changed — the same sign on the same staves', () => {
    const s = score()
    applyGroupSymbol(s, ['st0', 'st1'], 'brace')
    expect(applyGroupSymbol(s, ['st0', 'st1'], 'brace')).toBe(false)
  })

  it('⚠️ ignores staff ids the score does not have, ⛔ rather than storing them', () => {
    const s = score()
    applyGroupSymbol(s, ['st0', 'ghost'], 'brace')
    expect(s.staffGroups![0].staffIds).toEqual(['st0'])
  })

  it('⛔ names NO real staff → no group, and no change', () => {
    const s = score()
    expect(applyGroupSymbol(s, ['ghost'], 'brace')).toBe(false)
    expect(s.staffGroups).toBeUndefined()
  })
})

describe('removing a sign — ⭐ `undefined` DELETES the group', () => {
  it('drops the group covering those staves', () => {
    const s = score()
    applyGroupSymbol(s, ['st0', 'st1'], 'brace')
    expect(applyGroupSymbol(s, ['st0', 'st1'], undefined)).toBe(true)
    expect(s.staffGroups).toBeUndefined()
  })

  it('⭐ leaves other groups alone', () => {
    const s = score()
    applyGroupSymbol(s, ['st0', 'st1'], 'brace')
    applyGroupSymbol(s, ['st2', 'st3'], 'bracket')
    applyGroupSymbol(s, ['st0', 'st1'], undefined)
    expect(s.staffGroups!.map(g => g.symbol)).toEqual(['bracket'])
  })

  it('⛔ removing where there is nothing changes nothing', () => {
    const s = score()
    expect(applyGroupSymbol(s, ['st0'], undefined)).toBe(false)
  })
})

describe('pruning — ⭐ the model’s ONLY remaining duty over the overlay', () => {
  it('drops staff ids the score no longer has', () => {
    const s = score(2, [{ id: 'g', staffIds: ['st0', 'st1', 'gone'], symbol: 'brace' }])
    expect(pruneStaffGroups(s)).toBe(true)
    expect(s.staffGroups![0].staffIds).toEqual(['st0', 'st1'])
  })

  it('drops a group left naming nothing', () => {
    const s = score(2, [{ id: 'g', staffIds: ['gone'], symbol: 'brace' }])
    expect(pruneStaffGroups(s)).toBe(true)
    expect(s.staffGroups).toBeUndefined()
  })

  it('⛔ never touches a healthy overlay, and says so by answering false', () => {
    const s = score(2, [{ id: 'g', staffIds: ['st0', 'st1'], symbol: 'brace' }])
    expect(pruneStaffGroups(s)).toBe(false)
    expect(s.staffGroups![0].symbol).toBe('brace')
  })

  it('⛔ never INVENTS a group — a score with none keeps none', () => {
    const s = score(3)
    expect(pruneStaffGroups(s)).toBe(false)
    expect(s.staffGroups).toBeUndefined()
  })
})

describe('🚨🚨 the id trap — a group is a LIST OF MEMBERS, not staff-anchored content', () => {
  it('⛔ STAFF 0 MUST BE IN THE LIST BY ITS REAL ID', () => {
    // `MusicEngine.staffIdForIndex` is the CONTENT write convention: staff 0 stamps **no id**
    // (absent = staff 0, keeping single-staff JSON byte-identical). Using it here dropped staff 0
    // from every group and drew the sign over staff 1 alone — caught by the browser suite as a rod
    // starting 10 staff spaces too low, which was the only way it ever showed.
    const s = score(2)
    applyGroupSymbol(s, ['st0', 'st1'], 'bracket')
    expect(s.staffGroups![0].staffIds, 'both members, both real ids').toEqual(['st0', 'st1'])
  })

  it('⛔ an UNDEFINED member is not a member — it cannot silently mean "staff 0" here', () => {
    const s = score(2)
    // What the content helper would have produced for staves 0..1.
    applyGroupSymbol(s, [undefined as unknown as string, 'st1'], 'bracket')
    expect(s.staffGroups![0].staffIds, 'the group is staff 1 alone — visibly wrong, ⛔ not silently')
      .toEqual(['st1'])
  })
})
