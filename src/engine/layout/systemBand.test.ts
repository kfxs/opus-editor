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
  it('⭐ reaches the nearest staff on each side, and stops at its EDGE', () => {
    // Staves 100 px apart: the one above ends at 40 and the one below begins at 200, and the ink may
    // use all of both gaps. ⛔ Not halfway — see the chapter below for the two reports.
    const band = neighbourBandOf(staff(100), [staff(0), staff(200)])
    expect(band.top).toBe(40)
    expect(band.bottom).toBe(200)
  })

  it('takes the NEAREST on each side, not the first or the furthest', () => {
    const band = neighbourBandOf(staff(300), [staff(0), staff(200), staff(500), staff(400)])
    expect(band.top).toBe(240)    // the staff at 200 ends there — nearest above
    expect(band.bottom).toBe(400) // …and 400 begins nearest below
  })

  /**
   * ⭐⭐ **A SIDE WITH NO STAFF IS BOUNDED BY THE SHEET** — his rule, 2026-08-21: *"always ask if what
   * we have above is the beginning of the canvas or a staff, and suppose the same below"*, and
   * *"if the 8va y is less than the page y then refuse, else go ahead"*.
   *
   * 🚨 It used to make up a number there — half the tightest gap elsewhere on the page, or half the
   * staff's own height when the page held no other staff. On the TOP system that invention is the
   * only thing between the mark and the paper, and it sits CLOSER to the staff than the above-staff
   * ladder draws: an `8va` began outside its own limit and could not be lifted at all.
   */
  const sheet = { top: -30, bottom: 900 }

  it('🚨 a side with no staff takes the SHEET’s edge — ⛔ never a made-up allowance', () => {
    const band = neighbourBandOf(staff(100), [staff(300)], sheet)
    expect(band.top, 'nothing above ⇒ the top of the page').toBe(-30)
    expect(band.bottom, 'a staff below ⇒ its own edge').toBe(300)
  })

  it('⭐ …both sides at once when the staff is alone on the sheet', () => {
    expect(neighbourBandOf(staff(100), [], sheet)).toEqual({ top: -30, bottom: 900 })
  })

  it('⚠️ ignores a band that OVERLAPS mine — halving a negative gap would bind tighter than the staff', () => {
    // …and having ignored it, that side has no staff, so it takes the sheet's edge.
    expect(neighbourBandOf(staff(100), [{ top: 120, bottom: 180 }, staff(300)], sheet).top).toBe(-30)
  })

  it('⛔ unbounded when the caller cannot say what the sheet is — the page limit still composes', () => {
    // A canvas answers for its TOP only, and `MusicEngine` passes what `pageBoxAt` gives it.
    expect(neighbourBandOf(staff(100), [])).toEqual({ top: -Infinity, bottom: Infinity })
  })

  /**
   * 🚨🚨 **NO MIDPOINT — the boundary is the neighbouring staff's own EDGE.** His two reports of
   * 2026-08-21, minutes apart: *"look how the pedal is limit before the pedal lane"* and *"why the
   * pedal is limit so early if there is enough space between this and the next system… there is a
   * problem with the bands"*.
   *
   * ⛔ This file used to assert the halving in as many words. It is only generous to a mark that
   * lives near its own staff; the pedal — the outermost below-staff family — is already most of the
   * way to the midpoint before the user touches it, so the travel left over was a space or two with
   * the paper visibly empty underneath.
   */
  it('🚨 stops at the neighbour\'s near EDGE, ⛔ never halfway to it', () => {
    const mine = staff(100)      // 100…140
    expect(neighbourBandOf(mine, [staff(200)]).bottom, 'the staff below, not 170').toBe(200)
    expect(neighbourBandOf(mine, [staff(20)]).top, 'the staff above, not 80').toBe(60)
  })

  it('⭐ …and that is the same question for a grand staff partner and the next system', () => {
    // The rule no longer asks which system a band belongs to: both are staves, both stop the ink at
    // their edge, and what keeps a mark on its own system is that it may not enter anyone else's.
    const mine = staff(100)
    expect(neighbourBandOf(mine, [staff(200), staff(400)]).bottom, 'the NEAREST one').toBe(200)
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
