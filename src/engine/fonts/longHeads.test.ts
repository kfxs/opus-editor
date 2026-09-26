import { afterEach, describe, it, expect } from 'vitest'
import { longHeadGlyph, longHeadGeneration, resetLongHeads, setLongHead } from './longHeads'
import { noteheadGlyph } from './fontMetrics'

afterEach(resetLongHeads)

describe('longHeads — the breve\'s and longa\'s head, a house-style row (other-durations P4)', () => {
  it('defaults: the breve ROUND, the longa SQUARE', () => {
    expect(longHeadGlyph('breve')).toBe('noteheadDoubleWhole')
    expect(longHeadGlyph('longa')).toBe('noteheadDoubleWholeSquare')
  })

  it('⭐ the notehead a duration is drawn with asks it — and follows a re-arm', () => {
    expect(noteheadGlyph('breve')).toBe('noteheadDoubleWhole')
    setLongHead('breve', 'square')
    expect(noteheadGlyph('breve')).toBe('noteheadDoubleWholeSquare')
    expect(noteheadGlyph('w'), 'a whole note is untouched').toBe('noteheadWhole')
  })

  it('a re-arm moves the generation (the width and shape keys); ⛔ an unknown shape is refused', () => {
    const before = longHeadGeneration()
    expect(setLongHead('longa', 'round')).toBe(true)
    expect(longHeadGeneration()).toBeGreaterThan(before)
    expect(setLongHead('longa', 'oval' as never)).toBe(false)
    expect(longHeadGlyph('longa')).toBe('noteheadDoubleWhole')
  })
})
