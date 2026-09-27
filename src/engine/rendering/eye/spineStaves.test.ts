import { describe, it, expect } from 'vitest'
import { circleSpine, straightSpine } from '@/engine/engrave/staff/staffSpine'
import { staffStridePx } from '@/engine/layout/staffStride'
import { ScoreModel } from '@/engine/models/ScoreModel'
import { fracFromInt } from '@/utils/fraction'
import { barOnStaff, spineStaffTops, spineStaves } from './spineStaves'
import type { SpineBar } from './spineSpacing'

/** ⭐ A system on one path: where each staff stands below the reference, and how a bar maps onto it. */

function twoStaves(): ScoreModel {
  const m = new ScoreModel('staves')
  m.addStaffBelow(0)
  return m
}

describe('spineStaffTops — the page\'s own vertical arithmetic', () => {
  it('one staff stands ON the path', () => {
    expect([...spineStaffTops(new ScoreModel('one').getScore()).values()]).toEqual([0])
  })

  it('⭐ a second staff stands one staff STRIDE further down — its lines plus the staff gap', () => {
    expect([...spineStaffTops(twoStaves().getScore()).values()]).toEqual([0, staffStridePx(1)])
  })
})

describe('spineStaves', () => {
  it('a straight spine: every staff\'s path is as long as the reference', () => {
    const staves = spineStaves(twoStaves().getScore(), straightSpine(0, 0, 800))
    expect(staves.map(staff => staff.ratio)).toEqual([1, 1])
    expect(staves[1].spine.at(100).y).toBeCloseTo(staffStridePx(1), 9)
  })

  it('⭐ a circle: the second staff is the INNER ring', () => {
    const staves = spineStaves(twoStaves().getScore(), circleSpine(0, 0, 300))
    const radius = (s: number) => { const p = staves[1].spine.at(s); return Math.hypot(p.x, p.y) }
    expect(radius(0)).toBeCloseTo(300 - staffStridePx(1), 9)
    expect(staves[1].ratio).toBeCloseTo((300 - staffStridePx(1)) / 300, 9)
  })
})

describe('barOnStaff — a bar spaced on the reference, mapped by ANGLE', () => {
  const bar: SpineBar = { start: 100, end: 300, columnAt: () => 150, musicStart: 120, columns: [] }

  it('scales every distance by the staff\'s ratio', () => {
    const inner = barOnStaff(bar, 0.5)
    expect([inner.start, inner.end, inner.musicStart, inner.columnAt(fracFromInt(0))]).toEqual([50, 150, 60, 75])
  })

  it('ratio 1 is the bar itself', () => {
    expect(barOnStaff(bar, 1)).toBe(bar)
  })
})
