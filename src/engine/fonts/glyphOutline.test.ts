/**
 * {@link glyphOutline} — a glyph's real outline, read from the font file we ship (no baking): null until
 * its face has arrived, then contours in staff spaces that agree with the glyph's measured box.
 */
import { describe, it, expect } from 'vitest'
import { parse } from 'opentype.js'
import { glyphOutline, glyphOutlineGeneration, installGlyphOutlineFont } from './glyphOutline'
import { glyphBox } from './fontMetrics'

describe('glyphOutline', () => {
  it('⛔ null before the face has arrived — never a guessed shape (and no fetch: loading is off in a spec)', () => {
    expect(glyphOutline('accidentalSharp')).toBeNull()
  })

  it('⭐ from Bravura.otf: the sharp\'s outline, inside its measured box, with the comb on its left', async () => {
    // ⚠️ The app's tsconfig carries no Node types, so `fs` is reached through a non-literal import (typed
    //    `any`) — the spec reads the very file the page serves, which no browser API can do in vitest.
    const fsModule: string = 'node:fs'
    const { readFileSync } = await import(/* @vite-ignore */ fsModule)
    const buf: Uint8Array = readFileSync('public/fonts/Bravura.otf')
    const before = glyphOutlineGeneration()
    installGlyphOutlineFont('Bravura', parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)))
    expect(glyphOutlineGeneration()).toBe(before + 1)

    const contours = glyphOutline('accidentalSharp')!
    expect(contours.length).toBeGreaterThan(0)
    const xs = contours.flat().map(p => p[0]), ys = contours.flat().map(p => p[1])
    const box = glyphBox('accidentalSharp')
    expect(Math.min(...xs)).toBeCloseTo(box.left, 1)
    expect(Math.max(...xs)).toBeCloseTo(box.right, 1)
    expect(Math.max(...ys)).toBeCloseTo(box.up, 1)
    expect(Math.min(...ys)).toBeCloseTo(-box.down, 1)
    // The comb: at the box's left edge the ink is two crossbar TIPS (y ≈ 0.14…0.42 and −0.80…−0.52),
    // with no ink between them.
    const leftmost = xs.reduce((m, x) => Math.min(m, x), Infinity)
    const atLeft = contours.flat().filter(p => p[0] < leftmost + 0.05).map(p => p[1])
    expect(atLeft.length).toBeGreaterThan(0)
    expect(atLeft.some(y => y > 0.1 && y < 0.5)).toBe(true)
    expect(atLeft.some(y => y < -0.5 && y > -0.85)).toBe(true)
    expect(atLeft.every(y => y > 0.05 || y < -0.4)).toBe(true)
  })
})
