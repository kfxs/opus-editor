// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { StaveNote, Dot } from 'vexflow'
import {
  dotShift,
  reserveDotRoom,
  DOT_GAP_PX,
  DOT_GAP_SPACES,
  DOT_RESERVATION_PX,
  VEXFLOW_DOT_BASE_GAP,
  VEXFLOW_DOT_SPACING,
} from './dotPlacement'

describe('the gap a dot stands off its notehead', () => {
  it('is half a staff space', () => {
    expect(DOT_GAP_SPACES).toBe(0.5)
    expect(DOT_GAP_PX).toBe(5)
  })

  it('opens the gap for a note VexFlow leaves its 2px default on', () => {
    expect(dotShift(false)).toBe(DOT_GAP_PX - VEXFLOW_DOT_BASE_GAP)
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
    const note = new StaveNote({ keys: ['g/4'], duration: 'q' })
    Dot.buildAndAttach([note], { all: true })
    Dot.buildAndAttach([note], { all: true })
    const before = Dot.getDots(note).map(d => d.getWidth())
    reserveDotRoom(note)
    const after = Dot.getDots(note).map(d => d.getWidth())
    expect(after).toHaveLength(2)
    expect(after.map((w, i) => w - before[i])).toEqual([DOT_RESERVATION_PX, DOT_RESERVATION_PX])
  })

  it('reserves what the half space asks for beyond VexFlow’s own 1px', () => {
    // …which is also what puts the two dots of a double-dotted note half a space apart:
    // `Dot.format` steps the next one along by `width + dotSpacing`.
    expect(DOT_RESERVATION_PX).toBe(DOT_GAP_PX - VEXFLOW_DOT_SPACING)
  })

  it('does nothing to a note with no dots', () => {
    const note = new StaveNote({ keys: ['g/4'], duration: 'q' })
    expect(() => reserveDotRoom(note)).not.toThrow()
    expect(Dot.getDots(note)).toHaveLength(0)
  })
})
