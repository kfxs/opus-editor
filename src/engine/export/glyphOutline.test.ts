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
})
