import { describe, it, expect } from 'vitest'
import opentype from 'opentype.js'
import { glyphPathData } from './glyphOutline'

/** A contour the way Bravura's bare stem (E204) is written: four corners and NO closing `Z`. */
function openRect(x: number, y: number, w: number, h: number): opentype.Path {
  const path = new opentype.Path()
  path.moveTo(x + w, y)
  path.lineTo(x + w, y - h)
  path.lineTo(x, y - h)
  path.lineTo(x, y)
  return path
}
const points = (d: string) => [...d.matchAll(/[ML]/g)].length

describe('glyphPathData', () => {
  it('🚨 keeps all four corners of a THIN shape — a stem 0.78 wide, the keypad\'s size', () => {
    const stem = openRect(7.85, -1.2, 0.78, 16.7)
    expect(points(glyphPathData(stem))).toBe(4)
    // …which is the point of the module: the library's own default writes a three-point wedge,
    // because the last corner lies within 1 unit of the contour's start.
    expect(points(stem.toPathData(3))).toBe(3)
  })

  it('does not FLIP the picture — the options form of `toPathData` does unless told not to', () => {
    const d = glyphPathData(openRect(0, 0, 10, 5))
    const ys = [...d.matchAll(/[ML]-?[\d.]+[ ,]?(-?[\d.]+)/g)].map(m => Number(m[1]))
    expect(Math.min(...ys)).toBe(-5) // the shape went UP from y = 0, and SVG's up is negative
    expect(Math.max(...ys)).toBe(0)
  })

  it('writes what the library writes for a shape its optimiser leaves alone', () => {
    const wide = openRect(0, 0, 10, 5)
    expect(glyphPathData(wide)).toBe(wide.toPathData(3))
  })

  it('🚨 writes a coordinate whose fraction is below 1e-6 as a NUMBER — the library writes `NaN`', () => {
    // A measured position carries float32 noise: a browser hands back 11.3 as 11.300000190734863,
    // and a shift of −4 lands on 9.000000190734863. opentype's rounding is string arithmetic, so
    // that fraction stringifies in exponential form and `Math.round` of it is NaN — the coordinate
    // is written as the text `NaN` and the browser draws NOTHING (the keypad's dot key, 2026-09-23).
    const noisy = openRect(9.000000190734863, 0, 4, 4)
    const d = glyphPathData(noisy)
    expect(d).not.toContain('NaN')
    expect(d).toContain('13 0') // 9.000000190734863 + 4, rounded to the places we print
    // …and the library's own writer really does produce it, which is why the rounding is ours:
    expect(openRect(9.000000190734863, 0, 4, 4).toPathData(3)).toContain('NaN')
  })

  it('rounds to the places it prints, and leaves a well-behaved number alone', () => {
    expect(glyphPathData(openRect(1.23456, 0, 2, 2))).toContain('3.235')
    expect(glyphPathData(openRect(1.5, 0, 2, 2))).toContain('3.5')
  })
})
