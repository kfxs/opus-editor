import { describe, it, expect } from 'vitest'
import { systemStopFor, type SystemJumpPort } from './markSystemJump'

/**
 * ⭐⭐ WHICH SYSTEM A DRAGGED MARK BELONGS TO — the rule, against a fake port.
 *
 * Subject: {@link markSystemJump}, extracted from the dynamic's drag on 2026-08-19 when the tempo
 * mark wanted it too. Its two real ports are exercised through their own chapters; what this file
 * states is the rule itself, which belongs to neither mark:
 *
 * ⚠️⚠️ **EXPLORATORY (2026-08-30) — the rule is being found by eye, one change at a time.** What it
 * says today: **the mark belongs to the staff whose own MUSIC is nearest its ink**, so the switch
 * falls in the middle of the white space a reader actually sees — between the two staves' notes,
 * ⛔ not between their five lines, and ⛔ no longer halfway between where the mark sits and where it
 * would sit (that one fired a third of the way up the gap for a mark hanging on the far side of its
 * staff, which he rejected: *"have not even reach the middle of the white space"*).
 *
 * ⭐ The superseded rule is still computed in the module, one line away, and printed in the trace —
 * so these two chapters state the difference rather than pretending it was never there.
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
 * The mark is anchored top-left and DRAWN at 110 by default, i.e. 30 px below its staff's bottom
 * line. These bands declare no ink of their own, so the five lines answer for it and the white
 * space between the staves runs 80…340 — the switch is its middle, **210**.
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
  it('⭐⭐ hands the mark over in the MIDDLE OF THE WHITE SPACE between the two staves', () => {
    // ⛔ Not at the staff's lines (340), which is late — and ⛔ not a third of the way up the gap,
    // which is what "halfway to where it would sit there" came to for a mark hanging below its own
    // staff. One pixel either side of 210.
    expect(systemStopFor(port(), 290, 209)).toBeNull()
    expect(systemStopFor(port(), 290, 211)).toBe('low-right')
  })

  it('⭐⭐ …and it is the staves’ MUSIC that the middle is measured between', () => {
    // The lower staff's stems reach 100 px up into the gap, so its music starts at 240 and the
    // middle moves with it, to 160. His call, 2026-08-30, on an 8va left sitting on those stems.
    const withInk = port({
      bands: () => [
        { top: 40, bottom: 80, left: 100, right: 300, inkTop: 40, inkBottom: 80 },
        { top: 340, bottom: 380, left: 100, right: 300, inkTop: 240, inkBottom: 380 },
      ],
    })
    expect(systemStopFor(withInk, 290, 159)).toBeNull()
    expect(systemStopFor(withInk, 290, 161)).toBe('low-right')
  })

  it('⭐ the landing is the stop nearest the mark’s own BEGINNING when it can say where that is', () => {
    // The hand is over the right-hand stop; the bracket itself begins on the left, and it is the
    // bracket that lands (his report: the guide line ran off to "a space where there is nothing").
    expect(systemStopFor(port({ inkX: () => 100 }), 290, 300)).toBe('low-left')
    // ⛔ …and without it, the hand still answers — every family but the ottava, for now.
    expect(systemStopFor(port(), 290, 300)).toBe('low-right')
  })

  it('⭐ the x picks the stop WITHIN the system it landed on — never a hypotenuse', () => {
    expect(systemStopFor(port(), 110, 300)).toBe('low-left')
  })

  it('⛔ NOTHING while the mark still belongs where it is', () => {
    expect(systemStopFor(port(), 290, 150)).toBeNull()
    // …and dragged UP through its own staff and above it: the only other home is 300 px the other way.
    expect(systemStopFor(port(), 290, 20)).toBeNull()
  })

  it('⚠️ a mark the hand has CARRIED is judged by where it is, lift and all', () => {
    // ⭐ The lift no longer enters the decision at all — it was there to work out where the mark
    // would "look at home" on each staff, and the white space does not care. A mark drawn at 260 because
    // the hand carried it 150 px down is simply a mark at 260, which is past the middle.
    expect(systemStopFor(port({ inkY: () => 260, liftPx: () => 150 }), 290, 261)).toBe('low-right')
  })

  it('⭐ the same middle for a mark that hangs ABOVE its staff — one rule, both directions', () => {
    // ⛔ The side no longer moves the switch: a mark in the white space is judged by the space, so
    // an 8va and an 8vb dragged to the same y belong to the same staff.
    const above = port({ inkY: () => 10, above: () => true })
    expect(systemStopFor(above, 290, 209)).toBeNull()
    expect(systemStopFor(above, 290, 211)).toBe('low-right')
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
