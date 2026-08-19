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

/** Two staves, 40–80 and 340–380, with a candidate at each end of each. */
const BANDS = [{ top: 40, bottom: 80 }, { top: 340, bottom: 380 }]
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
