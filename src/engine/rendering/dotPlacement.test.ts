// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { EngravedNote } from './EngravedNote'
import {
  dotShift,
  dotReservationPx,
  reserveDotRoom,
  VEXFLOW_DOT_BASE_GAP,
  VEXFLOW_DOT_SPACING,
} from './dotPlacement'
import { attachEngravedDots, dotsOn } from './EngravedDot'
import { armedDotGap, resetDotGapRule, setDotGapRule } from '@/engine/layout/dotGap'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'

/** What the armed row asks for, in pixels — recomputed per assertion, ⛔ never captured. */
const headPx = () => armedDotGap().head * STAFF_SPACE_PX
const dotPx = () => armedDotGap().dot * STAFF_SPACE_PX

afterEach(() => resetDotGapRule())

describe('the gap a dot stands off its notehead', () => {
  it('is half a staff space — the armed `house` row', () => {
    expect(armedDotGap().head).toBe(0.5)
    expect(headPx()).toBe(5)
  })

  it('opens the gap for a note VexFlow leaves its 2px default on', () => {
    expect(dotShift(false)).toBe(headPx() - VEXFLOW_DOT_BASE_GAP)
  })

  it('leaves a stem-up flagged note alone — its dot already clears the flag', () => {
    expect(dotShift(true)).toBe(0)
  })

  it('only ever OPENS a gap, so a wider one is never pulled in', () => {
    expect(dotShift(false)).toBeGreaterThanOrEqual(0)
    expect(dotShift(true)).toBe(0)
  })
})

describe('reserveDotRoom', () => {
  it('widens every dot of the note, so the formatter buys the room the shift will need', () => {
    // ⚠️ jsdom cannot measure a glyph, so the dots start at width 0 — what this asserts is the
    // DELTA, which is the whole of what the reservation is. Where the ink lands is `e2e/notes`.
    const note = new EngravedNote({ keys: ['g/4'], duration: 'q' })
    attachEngravedDots(note)
    attachEngravedDots(note)
    const before = dotsOn(note).map(d => d.getWidth())
    reserveDotRoom(note)
    const after = dotsOn(note).map(d => d.getWidth())
    expect(after).toHaveLength(2)
    expect(after.map((w, i) => w - before[i])).toEqual([dotReservationPx(), dotReservationPx()])
  })

  it('reserves what the DOT→DOT gap asks for beyond VexFlow’s own 1px', () => {
    // …which is also what puts the two dots of a double-dotted note that far apart:
    // `Dot.format` steps the next one along by `width + dotSpacing`.
    expect(dotReservationPx()).toBe(dotPx() - VEXFLOW_DOT_SPACING)
  })

  it('does nothing to a note with no dots', () => {
    const note = new EngravedNote({ keys: ['g/4'], duration: 'q' })
    expect(() => reserveDotRoom(note)).not.toThrow()
    expect(dotsOn(note)).toHaveLength(0)
  })
})

describe('⭐⭐ the armed ROW is what both numbers come from', () => {
  it('⭐ arming a row moves BOTH gaps — the head from `head`, the reservation from `dot`', () => {
    expect(setDotGapRule('vexflow')).toBe(true)
    // VexFlow's own: 0.2 sp to the head (2 px — under its own 2 px default, so no shift at all)
    // and 0.1 sp between dots (1 px — exactly its `dotSpacing`, so nothing extra to reserve).
    expect(dotShift(false)).toBe(0)
    expect(dotReservationPx()).toBe(0)

    expect(setDotGapRule('gouldDrawn')).toBe(true)
    // ⭐⭐ The row that proves the two columns are not one number: her plate crowds the dots closer
    // to each other (0.26) than the first dot sits from the head (0.40).
    expect(dotShift(false)).toBeCloseTo(0.4 * STAFF_SPACE_PX - VEXFLOW_DOT_BASE_GAP, 10)
    expect(dotReservationPx()).toBeCloseTo(0.26 * STAFF_SPACE_PX - VEXFLOW_DOT_SPACING, 10)
  })

  it('⛔ REFUSES an unknown row — a console typo that looked like it worked would be the worst instrument', () => {
    expect(setDotGapRule('gould' as never)).toBe(true)
    expect(setDotGapRule('not-a-row' as never)).toBe(false)
    expect(armedDotGap().source).toContain('Gould')
  })

  it('⭐ reset puts back what shipped', () => {
    setDotGapRule('verovio')
    resetDotGapRule()
    expect(armedDotGap().head).toBe(0.5)
  })
})
