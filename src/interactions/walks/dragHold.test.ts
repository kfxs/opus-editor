import { describe, it, expect } from 'vitest'
import { catchupGain, HOLD_MAX_PX, HOLD_RATIO, logHold, releaseHold, spendHold, takeHold } from './dragHold'

/**
 * Subject: {@link spendHold} / {@link takeHold}, sitting beside this file — the motor-space ledger a
 * snapping drag keeps.
 *
 * ⭐⭐ **The claim that matters is CONSERVATION**: the hold makes the cursor and the ink disagree
 * mid-gap by design, and the catch-up must bring them back level by the time the next anchor is
 * reached. A hold that is not repaid *exactly* over the gap it was sized on drifts once per anchor —
 * his report, 2026-08-18: *"the far i go the far the x position of the mouse deviate more and more"*.
 */
describe('the hold absorbs, and the catch-up repays', () => {
  it('⭐⭐ a whole gap of cursor travel moves the ink a whole gap — the debt closes exactly', () => {
    // ⭐ THE arithmetic claim, and the reason the gain is derived rather than chosen: hold `r·gap`
    //   plus catch-up at `1/(1−r)` comes to `gap` of cursor travel for `gap` of ink, at any spacing.
    const hold = releaseHold()
    const gap = 100 * 0.3 // 30 px, so the ratio governs rather than the cap
    takeHold(hold, { gapAheadPx: gap, discardedPx: 0, dirSign: 1 })

    let ink = 0
    for (let i = 0; i < gap; i++) ink += spendHold(hold, 1) // one pixel of cursor at a time

    expect(ink, 'the ink covered the gap the cursor did').toBeCloseTo(gap, 6)
    expect(hold.debtPx, 'and owes nothing on arrival').toBeCloseTo(0, 6)
  })

  it('⭐ …and mid-hold the ink has not moved at all — that IS the stronger latch', () => {
    const hold = releaseHold()
    takeHold(hold, { gapAheadPx: 100, discardedPx: 0, dirSign: 1 })
    expect(hold.holdPx, 'a 100 px gap is capped, not 0.8 of it').toBe(HOLD_MAX_PX)

    const ink = spendHold(hold, HOLD_MAX_PX - 1)
    expect(ink, 'every pixel of it absorbed').toBe(0)
    expect(hold.debtPx).toBeCloseTo(HOLD_MAX_PX - 1, 6)
  })

  it('⭐ what the LATCH dropped is on the debt, so the catch-up hands it back too', () => {
    const hold = releaseHold()
    takeHold(hold, { gapAheadPx: 20, discardedPx: 7, dirSign: 1 })
    expect(hold.debtPx, 'the dropped travel starts the debt').toBe(7)
  })

  it('🚨 turning back RELEASES the hold — an anchor is never sticky in both directions', () => {
    const hold = releaseHold()
    takeHold(hold, { gapAheadPx: 20, discardedPx: 0, dirSign: 1 })
    expect(spendHold(hold, -5), 'the other way is not absorbed').toBe(-5)
    expect(hold.holdPx, 'and the hold is gone').toBe(0)
    expect(hold.debtPx, 'a change of mind cancels the debt, it is not repaid backwards').toBe(0)
  })

  it('⚠️ …but a sub-pixel wobble the other way is JITTER, not a change of mind', () => {
    // A hand held still still sends frames whose delta wobbles either side of zero; releasing on the
    // first negative crumb makes a strong hold feel intermittent instead of firm.
    const hold = releaseHold()
    takeHold(hold, { gapAheadPx: 20, discardedPx: 0, dirSign: 1 })
    expect(spendHold(hold, -0.4), 'nothing moves').toBe(0)
    expect(hold.holdPx, 'and the hold stands').toBeGreaterThan(0)
  })

  it('⛔ no room to repay ⇒ no amplification, rather than a division by zero', () => {
    expect(catchupGain(10, 0), 'nothing ahead').toBe(1)
    expect(catchupGain(20, 20), 'the hold swallowed the whole gap').toBe(1)
    expect(catchupGain(0, 30), 'no hold taken').toBe(1)
    expect(catchupGain(0.8 * 30, 30), 'and the derived gain otherwise').toBeCloseTo(1 / (1 - HOLD_RATIO), 6)
  })

  it('⭐ the instrument counts the CURSOR even on a frame the hold swallowed whole', () => {
    // ⛔ Otherwise the deviation it reports is its own arithmetic rather than the gesture's — which
    //   is exactly how the ratcheting debt hid for a day.
    const hold = releaseHold()
    takeHold(hold, { gapAheadPx: 20, discardedPx: 0, dirSign: 1 })
    logHold('x', hold, 5, 0, false)
    expect(hold.cursorTravel).toBe(5)
    expect(hold.inkTravel).toBe(0)
    expect(hold.cursorTravel - hold.inkTravel, 'the deviation the hold introduced').toBe(5)
  })
})
