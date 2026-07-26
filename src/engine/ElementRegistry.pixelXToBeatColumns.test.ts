import { describe, it, expect } from 'vitest'
import { ElementRegistry, type ElementInfo } from './ElementRegistry'

/**
 * Pixel → beat, resolved from the columns actually DRAWN.
 *
 * The mapper's version divides the note area evenly — `(relativeX / usableWidth) * barQuarters` —
 * which is right only when time and space are proportional in the bar. They essentially never are:
 * VexFlow gives a quarter note more room than an eighth, and user-authored spacing moves a column
 * anywhere its author wants it. So the drawn notes and rests are the mapping, and a pixel between
 * two of them is interpolated in the time between their beats.
 *
 * The bar these tests use is `♩ ♪ ♪ ♪` — deliberately the case the straight line gets wrong. Its
 * columns sit at 100 / 220 / 280 / 340 px for beats 0 / 1 / 1.5 / 2, with the barline at 400.
 */
function registryWith(columns: Array<{ beat: number; x: number; staff?: number }>, opts: {
  noteEndX?: number
} = {}): ElementRegistry {
  const registry = new ElementRegistry()
  for (const c of columns) {
    registry.add({
      type: 'note', id: `n${c.beat}-${c.staff ?? 0}`, measure: 1, staff: c.staff ?? 0, beat: c.beat,
      headX: c.x, bbox: { x: c.x - 4, y: 0, width: 8, height: 8 },
    } as ElementInfo)
  }
  const staves = [...new Set(columns.map(c => c.staff ?? 0))]
  for (const staff of staves) {
    registry.setStaffGeometry({
      measure: 1, staff, lineYPositions: [0, 10, 20, 30, 40], lineSpacing: 10,
      noteStartX: 50, noteEndX: opts.noteEndX ?? 400, clef: 'treble',
    })
  }
  return registry
}

/** ♩ ♪ ♪ ♪ in 4/4 — uneven on purpose. */
const UNEVEN = [{ beat: 0, x: 100 }, { beat: 1, x: 220 }, { beat: 1.5, x: 280 }, { beat: 2, x: 340 }]

describe('ElementRegistry.pixelXToBeat', () => {
  it('returns a column’s own beat when you point at it', () => {
    const r = registryWith(UNEVEN)
    expect(r.pixelXToBeat(100, 1, 4)).toBe(0)
    expect(r.pixelXToBeat(220, 1, 4)).toBe(1)
    expect(r.pixelXToBeat(340, 1, 4)).toBe(2)
  })

  it('interpolates in TIME between two columns, not in bar-width', () => {
    // Halfway in pixels between beat 1 (220) and beat 1.5 (280) is beat 1.25.
    expect(registryWith(UNEVEN).pixelXToBeat(250, 1, 4)).toBe(1.25)
  })

  it('⭐ disagrees with an even division exactly where the music is uneven', () => {
    // x=280 is 66% across the note area (50..400), so the straight line calls it beat 2.75.
    // It is in fact the third eighth: beat 1.5. That gap is the whole reason this exists.
    const even = ((280 - 50) / (400 - 50)) * 4
    expect(Math.round(even * 4) / 4).toBe(2.75)
    expect(registryWith(UNEVEN).pixelXToBeat(280, 1, 4)).toBe(1.5)
  })

  it('runs on past the last column to the barline, so the tail of the bar is reachable', () => {
    const r = registryWith(UNEVEN)
    // Between beat 2 (340) and the barline (400 ↔ beat 4): halfway is beat 3.
    expect(r.pixelXToBeat(370, 1, 4)).toBe(3)
    expect(r.pixelXToBeat(400, 1, 4)).toBe(4)
  })

  it('names a beat that holds NO note — an empty bar must still be aimable', () => {
    // One whole rest at beat 0 and nothing else: you must still be able to point at beat 3.
    const r = registryWith([{ beat: 0, x: 100 }])
    expect(r.pixelXToBeat(325, 1, 4)).toBe(3)
  })

  it('clamps left of the first column to its beat', () => {
    expect(registryWith(UNEVEN).pixelXToBeat(10, 1, 4)).toBe(0)
  })

  it('is scoped to ONE staff — staves share a barline, not a rhythm', () => {
    // Each staff formats in its own Formatter, so the same beat can sit at different x on each.
    // Here staff 0 runs 120px per beat and staff 1 runs 100px — a pixel between their columns
    // therefore means different things on each, and the answer must follow the staff you are on.
    const r = registryWith([
      { beat: 0, x: 100, staff: 0 }, { beat: 1, x: 220, staff: 0 }, { beat: 2, x: 340, staff: 0 },
      { beat: 0, x: 100, staff: 1 }, { beat: 2, x: 300, staff: 1 }, // two half notes, spaced wider
    ])
    expect(r.pixelXToBeat(200, 1, 4, 0)).toBe(0.75) // 100/120 of the way to beat 1
    expect(r.pixelXToBeat(200, 1, 4, 1)).toBe(1)    // 100/200 of the way to beat 2
  })

  it('collapses a chord / two voices at one beat into ONE column', () => {
    const r = registryWith([{ beat: 0, x: 100 }, { beat: 0, x: 104 }, { beat: 2, x: 340 }])
    expect(r.pixelXToBeat(100, 1, 4)).toBe(0)
    expect(r.pixelXToBeat(220, 1, 4)).toBe(1) // halfway between the two columns
  })

  it('declines when nothing is drawn there, so the caller can fall back', () => {
    expect(registryWith(UNEVEN).pixelXToBeat(200, 9, 4)).toBeNull()
    expect(registryWith(UNEVEN).pixelXToBeat(200, 1, 4, 3)).toBeNull()
    expect(new ElementRegistry().pixelXToBeat(200, 1, 4)).toBeNull()
  })

  it('survives a bar whose last column sits AT the barline', () => {
    const r = registryWith([{ beat: 0, x: 100 }, { beat: 3, x: 400 }], { noteEndX: 400 })
    expect(r.pixelXToBeat(400, 1, 4)).toBe(3)
    expect(r.pixelXToBeat(250, 1, 4)).toBe(1.5)
  })
})

describe('ElementRegistry.pixelXToBeat — user-authored spacing', () => {
  it('follows the column when a space moves it', () => {
    // Same music, but 40px of authored space pushed the beat-2 column right (and the barline with
    // it). Under an even division the extra width would drag every beat's pixel with it; here the
    // untouched half of the bar keeps its answers and only the spaced part moves.
    const before = registryWith([{ beat: 0, x: 100 }, { beat: 1, x: 200 }, { beat: 2, x: 300 }])
    const after = registryWith([{ beat: 0, x: 100 }, { beat: 1, x: 200 }, { beat: 2, x: 340 }],
      { noteEndX: 440 })

    expect(before.pixelXToBeat(150, 1, 4)).toBe(0.5)
    expect(after.pixelXToBeat(150, 1, 4)).toBe(0.5)   // left of the space: unchanged
    expect(before.pixelXToBeat(250, 1, 4)).toBe(1.5)
    expect(after.pixelXToBeat(270, 1, 4)).toBe(1.5)   // …and the midpoint travelled with the column
  })
})
