import { describe, it, expect } from 'vitest'
import { encompassCeiling } from './slurEncompass'
import type { SlurAttachment } from './slurStemEndpoint'

/**
 * {@link slurEncompass} — how far out the notes BETWEEN a slur's two ends reach.
 *
 * Pure arithmetic on numbers the renderer measured, so it belongs headless: y grows DOWN, a slur
 * ABOVE is direction −1, and "further out" means a smaller y for it. ⚠️ Nothing here asserts a
 * DRAWN position — the inputs are stated, not measured (docs/ARCHITECTURE.md §"The browser suite").
 */
const ABOVE = -1
const BELOW = 1

/** One covered column. `stemTipY` absent = a note that draws no stem (a whole note). */
const col = (headY: number, stemDirection: number, stemTipY?: number): SlurAttachment =>
  ({ headYs: [headY], stemDirection, stemTipY, headHalfWidth: 6 })

describe('encompassCeiling', () => {
  it('⛔ answers UNDEFINED with nothing in between — which is every two-note slur', () => {
    // The honest answer, and the reason the caller can treat "no interior notes" as "the endpoint
    // rules had it right" instead of as a case to write out.
    expect(encompassCeiling([], ABOVE)).toBeUndefined()
  })

  it('⭐ a stem pointing the slur\'s way IS the obstacle — the tip, not the head', () => {
    // Slur above, stem up: the stem reaches 3.5 spaces past its own notehead.
    expect(encompassCeiling([col(100, 1, 65)], ABOVE)).toBe(65)
  })

  it('a stem pointing AWAY contributes nothing beyond its notehead', () => {
    // Slur above, stem DOWN: the stem hangs below the head, so the head is the whole obstacle.
    expect(encompassCeiling([col(100, -1, 135)], ABOVE)).toBe(100)
  })

  it('a note with NO stem is its notehead and nothing more', () => {
    // A whole note. ⚠️ `NoteBuilder` still gives it a stem DIRECTION, so the direction alone would
    // wrongly promise a tip that was never drawn — absence of `stemTipY` is the answer.
    expect(encompassCeiling([col(100, 1, undefined)], ABOVE)).toBe(100)
  })

  it('takes the FURTHEST out across the covered columns', () => {
    const cols = [col(95, 1, 60), col(90, 1, 55), col(85, 1, 50)]
    expect(encompassCeiling(cols, ABOVE)).toBe(50)
    // …and order cannot matter.
    expect(encompassCeiling([...cols].reverse(), ABOVE)).toBe(50)
  })

  it('⭐ a chord reaches from its OUTER head on the slur\'s side', () => {
    const chord: SlurAttachment = { headYs: [100, 90, 80], stemDirection: -1, headHalfWidth: 6 }
    expect(encompassCeiling([chord], ABOVE)).toBe(80)  // the top of the chord
    expect(encompassCeiling([chord], BELOW)).toBe(100) // …and the bottom, below
  })

  it('mirrors below the staff', () => {
    // Slur below, stem DOWN: the tip hangs past the head and is the obstacle.
    expect(encompassCeiling([col(100, -1, 135)], BELOW)).toBe(135)
    // …and an up stem, below, is behind its own notehead.
    expect(encompassCeiling([col(100, 1, 65)], BELOW)).toBe(100)
  })
})
