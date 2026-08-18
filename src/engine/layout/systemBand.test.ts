import { describe, it, expect } from 'vitest'
import { neighbourBandOf, stepStaysInBand } from './systemBand'

/**
 * How far a hand-nudged mark may reach before it is in a neighbouring staff's room.
 *
 * Subject: {@link systemBand}, sitting beside this file. Pure arithmetic over bands and boxes handed
 * in — the numbers come from a render in life (`ElementRegistry.staffBands`), and jsdom measures
 * nothing (`reference_jsdom_cannot_measure_glyphs`).
 *
 * ⭐ His report, 2026-08-18: a dragged slur endpoint reached 66 staff-spaces, the arc a near-vertical
 * hairline across five systems. The PAGE limit was not at fault — it refuses a step that pushes ink
 * further off its sheet, and 660 px down from mid-page is still on the page.
 */
const staff = (top: number) => ({ top, bottom: top + 40 }) // five lines, 10 px apart

describe('neighbourBandOf', () => {
  it('⭐ gives half the gap to the nearest staff on each side', () => {
    // Systems 100 px apart: the staff below starts 60 px under mine, so I may use 30 of it.
    const band = neighbourBandOf(staff(100), [staff(0), staff(200)])
    expect(band.top).toBe(100 - 30)
    expect(band.bottom).toBe(140 + 30)
  })

  it('takes the NEAREST on each side, not the first or the furthest', () => {
    const band = neighbourBandOf(staff(300), [staff(0), staff(200), staff(500), staff(400)])
    expect(band.top).toBe(300 - 30)   // the staff at 200 (ends 240) is nearest above
    expect(band.bottom).toBe(340 + 30) // …and 400 nearest below
  })

  it('🚨 gives a side with NO neighbour the room a neighbour would have — never infinity', () => {
    // His report, 2026-08-18: the first version made a missing side unbounded, so bar 3 of the TOP
    // system had no upward limit at all and a drag reached −11 spaces past the new guard. The gap
    // between the two painted staves here is 160, so the missing side upstairs gets the same 80.
    const band = neighbourBandOf(staff(100), [staff(300)])
    expect(band.top).toBe(100 - 80)
    expect(band.bottom).toBe(140 + 80)
  })

  it('takes the TIGHTEST gap on the page as that fallback, not an average', () => {
    // The limit has to hold where the systems are closest; a generous mean would license ink that
    // collides there. Gaps here are 60 and 160 → the fallback is half of 60.
    const band = neighbourBandOf(staff(0), [staff(100), staff(300)])
    expect(band.top).toBe(0 - 30)
  })

  it('⛔ …and the staff’s OWN height when the page has no other staff to compare with', () => {
    const band = neighbourBandOf(staff(100), [])
    expect(band.top).toBe(100 - 20)
    expect(band.bottom).toBe(140 + 20)
  })

  it('⚠️ ignores a band that OVERLAPS mine — halving a negative gap would bind tighter than the staff', () => {
    // …and having ignored it, that side has no neighbour, so it takes the fallback: the only positive
    // gap on this page is 300 − 180 = 120, giving 60 of room upstairs.
    expect(neighbourBandOf(staff(100), [{ top: 120, bottom: 180 }, staff(300)]).top).toBe(100 - 60)
  })

  it('makes no distinction between a piano’s other staff and the next system’s', () => {
    // Both are somebody else's room, and the rule that keeps ink out of one keeps it out of the
    // other — which is why the derivation never asks which system a band belongs to.
    expect(neighbourBandOf(staff(100), [staff(160)])).toEqual(neighbourBandOf(staff(100), [staff(160)]))
  })
})

describe('stepStaysInBand', () => {
  const band = { top: 70, bottom: 170 }
  // ⚠️ The box's BOTTOM EDGE is what the limit judges, so the room below is 170 − (100 + 20) = 50.
  const ink = { x: 0, y: 100, width: 50, height: 20 }

  it('allows a step that stays inside', () => {
    expect(stepStaysInBand(band, [ink], 25)).toBe(true)
    expect(stepStaysInBand(band, [ink], 50), 'right up to the edge').toBe(true)
  })

  it('🚨 refuses the step that would leave it — the 66-space drag', () => {
    expect(stepStaysInBand(band, [ink], 60)).toBe(false)
    expect(stepStaysInBand(band, [ink], 660)).toBe(false)
  })

  it('⭐ lets ink that is ALREADY outside come BACK', () => {
    // The rule judges whether the overhang gets WORSE, never whether the ink is outside — otherwise a
    // saved score carrying a wild offset could never be dragged back, which is the bug that started
    // this. 66 spaces down, moving up: allowed.
    const wild = { x: 0, y: 700, width: 50, height: 20 }
    expect(stepStaysInBand(band, [wild], -50)).toBe(true)
    expect(stepStaysInBand(band, [wild], 5)).toBe(false)
  })

  it('⛔ allows anything when there is no drawn ink to measure', () => {
    // The page limit's rule, for its reason: refusing on no evidence makes an object unmovable for a
    // reason the user cannot see.
    expect(stepStaysInBand(band, [], 5000)).toBe(true)
  })

  it('judges only the VERTICAL — a band has no left or right edge', () => {
    expect(stepStaysInBand({ top: -Infinity, bottom: Infinity }, [ink], 9999)).toBe(true)
  })
})
