import { describe, it, expect } from 'vitest'
import { stemExtents, stemLineHeight, stemReach, type StemSpan } from './stemLength'
import { STEM_LENGTH_PX } from '@/engine/engrave/inheritedDefaults'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'

/**
 * ⚠️ The agreement with VexFlow was proved by a throwaway probe (S6e: 2,700 combinations of head
 * span, direction, extension and both y-offsets, `getHeight` and `getExtents` identical to a plain
 * `Stem`). ⛔ A spec of ours may not import VexFlow to re-prove it.
 */
const UP = 1
const DOWN = -1
const single = (y: number, stemDirection: number, extension = 0): StemSpan =>
  ({ yTop: y, yBottom: y, stemDirection, extension })

describe('stemReach', () => {
  it('is 3½ staff spaces by default — the number all four treatises state', () => {
    expect(stemReach(0)).toBe(3.5 * STAFF_SPACE_PX)
    expect(stemReach(0)).toBe(STEM_LENGTH_PX)
  })

  it('takes whatever the note asked to add, either way', () => {
    expect(stemReach(7.5)).toBe(STEM_LENGTH_PX + 7.5)
    expect(stemReach(-5)).toBe(STEM_LENGTH_PX - 5)
  })
})

describe('stemExtents', () => {
  it('runs a stem UP from its head — the tip is ABOVE, the base is the head', () => {
    const { tipY, baseY } = stemExtents(single(100, UP))
    expect(baseY).toBe(100)
    expect(tipY).toBe(100 - STEM_LENGTH_PX)
  })

  it('runs a stem DOWN from its head — ⚠️ the tip is BELOW the base', () => {
    const { tipY, baseY } = stemExtents(single(100, DOWN))
    expect(baseY).toBe(100)
    expect(tipY).toBe(100 + STEM_LENGTH_PX)
    expect(tipY).toBeGreaterThan(baseY)
  })

  it('measures a CHORD from the head at the stem’s tip end, and bases it at the other', () => {
    // A chord spanning 30px: stem up leaves from the lowest head and is measured from the highest.
    const chord: StemSpan = { yTop: 70, yBottom: 100, stemDirection: UP, extension: 0 }
    expect(stemExtents(chord)).toEqual({ tipY: 70 - STEM_LENGTH_PX, baseY: 100 })
    expect(stemExtents({ ...chord, stemDirection: DOWN }))
      .toEqual({ tipY: 100 + STEM_LENGTH_PX, baseY: 70 })
  })

  it('pushes the tip out by the extension, never the base', () => {
    const a = stemExtents(single(100, UP))
    const b = stemExtents(single(100, UP, 12))
    expect(b.baseY).toBe(a.baseY)
    expect(a.tipY - b.tipY).toBe(12)
  })
})

describe('stemLineHeight', () => {
  it('is SIGNED by the direction, so one subtraction draws it either way', () => {
    expect(stemLineHeight(single(100, UP))).toBe(STEM_LENGTH_PX)
    expect(stemLineHeight(single(100, DOWN))).toBe(-STEM_LENGTH_PX)
  })

  it('⭐ spans the chord as well as the reach — the ink starts at the OTHER head', () => {
    const chord: StemSpan = { yTop: 70, yBottom: 100, stemDirection: UP, extension: 0 }
    expect(stemLineHeight(chord)).toBe(30 + STEM_LENGTH_PX)
    // …and that is exactly what the extents do NOT include:
    const { tipY, baseY } = stemExtents(chord)
    expect(baseY - tipY).toBe(30 + STEM_LENGTH_PX)
  })

  it('starts short by the y-offset when a head asks for one', () => {
    expect(stemLineHeight(single(100, UP), 4)).toBe(STEM_LENGTH_PX - 4)
    expect(stemLineHeight(single(100, DOWN), 4)).toBe(-(STEM_LENGTH_PX - 4))
  })

  it('agrees with the extents on a single note, which is the whole invariant', () => {
    for (const dir of [UP, DOWN]) for (const ext of [0, 9, -3]) {
      const span = single(212.5, dir, ext)
      const { tipY, baseY } = stemExtents(span)
      expect(Math.abs(stemLineHeight(span)), `${dir} ${ext}`).toBe(Math.abs(baseY - tipY))
    }
  })
})
