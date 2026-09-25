/**
 * {@link glyphInkShape} — a glyph's drawn box less the corners the font's SMuFL cut-out anchors say are
 * empty (Bravura's sharp: `cutOutSW` [0.144, −0.896], `cutOutNW` [0.144, 0.568], and the two on its right).
 */
import { describe, it, expect } from 'vitest'
import { distanceToInk, glyphInkShape } from './glyphInkShape'
import { anchor, glyphBox } from '@/engine/fonts/fontMetrics'

const SP = 10
const sharp = glyphBox('accidentalSharp')
// The sharp drawn with its origin at (100, 50): its box, as `drawnInk` reports it.
const box = { x: 100 + sharp.left * SP, y: 50 - sharp.up * SP, width: (sharp.right - sharp.left) * SP, height: (sharp.up + sharp.down) * SP }

describe('glyphInkShape', () => {
  const shape = glyphInkShape('accidentalSharp', box)

  it('⭐ the sharp\'s lower-left corner holds NO ink — the font says so (cutOutSW)', () => {
    const sw = anchor('accidentalSharp', 'cutOutSW')!
    // A point just inside the box's lower-left corner, inside the cut-out: outside the ink.
    const x = box.x + 0.05 * SP
    const y = box.y + box.height - 0.05 * SP
    expect(sw[1]).toBeLessThan(0)
    expect(distanceToInk(x, y, shape)).toBeGreaterThan(0)
    expect(distanceToInk(x, y, [{ left: box.x, right: box.x + box.width, top: box.y, bottom: box.y + box.height }])).toBe(0)
  })

  it('the middle of the glyph is ink', () => {
    expect(distanceToInk(box.x + box.width / 2, 50, shape)).toBe(0)
  })

  it('the shape never reaches outside the box', () => {
    for (const r of shape) {
      expect(r.left).toBeGreaterThanOrEqual(box.x - 1e-9)
      expect(r.right).toBeLessThanOrEqual(box.x + box.width + 1e-9)
      expect(r.top).toBeGreaterThanOrEqual(box.y - 1e-9)
      expect(r.bottom).toBeLessThanOrEqual(box.y + box.height + 1e-9)
    }
  })

  it('a glyph the font gives no cut-outs is its box', () => {
    const plain = (['augmentationDot', 'restQuarter'] as const)
      .find(n => !['cutOutNW', 'cutOutSW', 'cutOutNE', 'cutOutSE'].some(c => anchor(n, c)))!
    expect(plain).toBeDefined()
    expect(glyphInkShape(plain, box)).toEqual([{ left: box.x, right: box.x + box.width, top: box.y, bottom: box.y + box.height }])
  })
})
