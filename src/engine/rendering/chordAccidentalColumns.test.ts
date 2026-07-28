import { describe, it, expect } from 'vitest'
import { chordAccidentalLayout, chordAccidentalWidth, MIN_SHARED_COLUMN_LINES } from './chordAccidentalColumns'

const CHORD_LEFT = 100
const GAP = 2

describe('chordAccidentalLayout', () => {
  it('places nothing, and asks for no room, when the chord has no accidentals', () => {
    expect(chordAccidentalLayout([], CHORD_LEFT, GAP)).toEqual({ xs: [], width: 0 })
  })

  it('hangs a single accidental one gap left of the chord', () => {
    const { xs, width } = chordAccidentalLayout([{ line: 3, width: 10 }], CHORD_LEFT, GAP)
    expect(xs).toEqual([88]) // right edge 98, ten wide
    expect(width).toBe(12)
  })

  it('opens a second column for accidentals a second apart', () => {
    const { xs, width } = chordAccidentalLayout(
      [{ line: 4, width: 10 }, { line: 4.5, width: 10 }],
      CHORD_LEFT, GAP,
    )
    // The HIGHER one takes the column nearest the chord; the lower is pushed out past it.
    expect(xs[1]).toBe(88)
    expect(xs[0]).toBe(76)
    expect(width).toBe(24)
  })

  it('shares one column once the notes are a sixth apart', () => {
    const far = 1 + MIN_SHARED_COLUMN_LINES
    const { xs, width } = chordAccidentalLayout(
      [{ line: 1, width: 10 }, { line: far, width: 10 }],
      CHORD_LEFT, GAP,
    )
    expect(xs).toEqual([88, 88])
    expect(width).toBe(12)
  })

  it('works inwards: top, then bottom, then what is left', () => {
    // Top (5) and bottom (1) clear each other and share the near column; the middle (4.5) is a
    // second from the top, so it is the one pushed out.
    const { xs } = chordAccidentalLayout(
      [{ line: 5, width: 10 }, { line: 4.5, width: 10 }, { line: 1, width: 10 }],
      CHORD_LEFT, GAP,
    )
    expect(xs[0]).toBe(88)
    expect(xs[2]).toBe(88)
    expect(xs[1]).toBe(76)
  })

  it('right-aligns a narrow glyph inside a column its neighbour widened', () => {
    // A flat sharing a column with a wider sign still ends flush against the chord.
    const { xs } = chordAccidentalLayout(
      [{ line: 1, width: 10 }, { line: 4, width: 6 }],
      CHORD_LEFT, GAP,
    )
    expect(xs).toEqual([88, 92])
  })

  it('measures the room from the widest glyph in each column, not from one of them', () => {
    const items = [{ line: 4, width: 6 }, { line: 4.5, width: 10 }]
    expect(chordAccidentalWidth(items, GAP)).toBe(chordAccidentalLayout(items, 0, GAP).width)
    expect(chordAccidentalWidth(items, GAP)).toBe(20) // gap + 10 + gap + 6
  })
})
