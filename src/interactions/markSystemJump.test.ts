import { describe, it, expect } from 'vitest'
import { systemStopFor, type SystemJumpPort } from './markSystemJump'

/**
 * ⭐⭐ WHICH SYSTEM A DRAGGED MARK BELONGS TO — the rule, against a fake port.
 *
 * Subject: {@link markSystemJump}, extracted from the dynamic's drag on 2026-08-19 when the tempo
 * mark wanted it too. Its two real ports are exercised through their own chapters; what this file
 * states is the rule itself, which belongs to neither mark:
 *
 * **the mark belongs to whichever system it would LOOK AT HOME on** — its natural distance from its
 * own staff, read from every other staff, nearest wins — so the switch falls exactly halfway between
 * where it sits and where it would sit. ⛔ NOT crossing the staff's five lines, which is late and
 * lopsided (his verdict after trying it).
 */

/** Two staves, 40–80 and 340–380, each running x 100…300, with a candidate at each end of each. */
const BANDS = [
  { top: 40, bottom: 80, left: 100, right: 300 },
  { top: 340, bottom: 380, left: 100, right: 300 },
]
const CANDIDATES = [
  { x: 100, y: 60, stop: 'top-left' },
  { x: 300, y: 60, stop: 'top-right' },
  { x: 100, y: 360, stop: 'low-left' },
  { x: 300, y: 360, stop: 'low-right' },
]

/**
 * The mark is anchored top-left and DRAWN at `inkAt` — 110 by default, i.e. 30 px below its staff's
 * bottom line, which is its natural home. Its twin position on the second staff is 410, so the
 * switch sits halfway between: **260**.
 */
const port = (over: Partial<SystemJumpPort<string>> = {}): SystemJumpPort<string> => ({
  bands: () => BANDS,
  candidates: () => CANDIDATES,
  anchor: () => ({ x: 100, y: 60 }),
  inkY: () => 110,
  liftPx: () => 0,
  above: () => false,
  ...over,
})

describe('systemStopFor', () => {
  it('⭐⭐ hands the mark over HALFWAY to where it would sit on the next system', () => {
    // ⛔ Not at the staff's lines (340): that is late, and it is lopsided for a mark that hangs to
    // one side. One pixel either side of 260.
    expect(systemStopFor(port(), 290, 259)).toBeNull()
    expect(systemStopFor(port(), 290, 261)).toBe('low-right')
  })

  it('⭐ the x picks the stop WITHIN the system it landed on — never a hypotenuse', () => {
    expect(systemStopFor(port(), 110, 300)).toBe('low-left')
  })

  it('⛔ NOTHING while the mark still belongs where it is', () => {
    expect(systemStopFor(port(), 290, 150)).toBeNull()
    // …and dragged UP through its own staff and above it: the only other home is 300 px the other way.
    expect(systemStopFor(port(), 290, 20)).toBeNull()
  })

  it('🚨 the mark’s own LIFT is taken back out before the halfway point is worked out', () => {
    // The bug this rule replaced: with the lift left in, the mark's "natural" home follows it down
    // for ever and the switch never arrives (a dynamic at y: 44.86, a guide line over three staves).
    // Here the mark is DRAWN at 260 because the hand has already carried it 150 px down — its
    // natural home is still 110, so 261 hands it over.
    expect(systemStopFor(port({ inkY: () => 260, liftPx: () => 150 }), 290, 261)).toBe('low-right')
  })

  it('⭐ an ABOVE mark measures from the staff’s TOP line, so the rule mirrors', () => {
    // Drawn 30 px above its own staff (10); its twin on the second staff is 310, halfway is 160.
    const above = port({ inkY: () => 10, above: () => true })
    expect(systemStopFor(above, 290, 159)).toBeNull()
    expect(systemStopFor(above, 290, 161)).toBe('low-right')
  })

  it('⛔ null when the system it now belongs to holds nothing this mark can anchor to', () => {
    expect(systemStopFor(port({ candidates: () => CANDIDATES.slice(0, 2) }), 290, 300)).toBeNull()
  })

  it('⛔ null with one staff on the page, and when the picture cannot say', () => {
    expect(systemStopFor(port({ bands: () => [BANDS[0]] }), 290, 400)).toBeNull()
    expect(systemStopFor(port({ inkY: () => null }), 290, 400)).toBeNull()
    expect(systemStopFor(port({ anchor: () => null }), 290, 400)).toBeNull()
  })
})

/**
 * 🚨🚨 **TWO SHEETS SIDE BY SIDE SHARE A ROW** — his report, 2026-08-30, on the Prelude: dragging a
 * hairpin, then an octave line, made the mark vanish. `PagePass` draws the pages side by side, so
 * page 2's system sits at page 1's system's y; a band keyed by its y alone folds them into one, and
 * the jump landed the mark on the sheet that happened to hold the nearest candidate — measured in
 * the browser, x 1382 while his cursor was at 334, a page away and off screen.
 *
 * ⭐ A drag is vertical travel on ONE sheet: system and staff may change, ⛔ never page.
 */
describe('systemStopFor across two sheets', () => {
  /**
   * ⚠️ The rows do NOT line up, and that is the measured shape: systems have different heights, so
   * after the first row each sheet's rows drift past the other's. Page 1 at x 100…300 with rows at
   * 40–80 and 340–380; page 2 at x 1100…1300 with rows at 200–240 and 500–540 — page 2's first row
   * sits BETWEEN page 1's two, which is exactly how a y-only choice lands on the wrong sheet.
   */
  const SHEETS = [
    { top: 40, bottom: 80, left: 100, right: 300 },
    { top: 340, bottom: 380, left: 100, right: 300 },
    { top: 200, bottom: 240, left: 1100, right: 1300 },
    { top: 500, bottom: 540, left: 1100, right: 1300 },
  ]
  const ACROSS = [
    { x: 100, y: 60, stop: 'p1-top' },
    { x: 200, y: 360, stop: 'p1-low' },
    { x: 1100, y: 220, stop: 'p2-top' },
    { x: 1200, y: 520, stop: 'p2-low' },
  ]
  const sheetPort = (over: Partial<SystemJumpPort<string>> = {}): SystemJumpPort<string> => ({
    bands: () => SHEETS,
    candidates: () => ACROSS,
    anchor: () => ({ x: 100, y: 60 }),
    inkY: () => 110,
    liftPx: () => 0,
    above: () => false,
    ...over,
  })

  it('🚨 drags DOWN onto this sheet’s next system — ⛔ never the other sheet’s, however near its y', () => {
    // Natural home is 30px below the staff: on page 1's lower row that is 410, on page 2's upper row
    // 270. By y alone 270 wins from an ink at 280 — and the mark leaves the page.
    expect(systemStopFor(sheetPort(), 200, 280)).toBe('p1-low')
  })

  it('and a hand over the SECOND sheet stays on the second', () => {
    const onPageTwo = sheetPort({ anchor: () => ({ x: 1100, y: 220 }), inkY: () => 270 })
    expect(systemStopFor(onPageTwo, 1200, 530)).toBe('p2-low')
  })

  it('a cursor in the MARGIN belongs to the nearer sheet — distance, not containment', () => {
    // x 90 is outside page 1's music and 1010px from page 2's: still plainly page 1.
    expect(systemStopFor(sheetPort(), 90, 280)).toBe('p1-low')
  })

  it('⛔ null rather than a teleport when this sheet’s row holds nothing to anchor to', () => {
    // The measured case: a row whose only candidates are on another sheet (his log's x 1382 while
    // the cursor was at 334). Not jumping is the honest answer; landing a page away is not.
    const empty = sheetPort({ candidates: () => ACROSS.filter(c => c.stop !== 'p1-low') })
    expect(systemStopFor(empty, 200, 280)).toBeNull()
  })
})
