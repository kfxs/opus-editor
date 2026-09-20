import { describe, it, expect } from 'vitest'
import { CLEF_LINES, clefSign } from './clefSign'

/**
 * ⭐ A clef's sign is TODAY's picture, copied exactly from VexFlow's `Clef.types` and `Clef.getPoint`
 * (S4b0 of `docs/history/vexflow-removal-map.md`). ⚠️ Rows, not laws — a change here is a decision about the
 * look (rule 13), ⛔ never a way to make this spec pass.
 */
describe('clefSign — what a clef draws, as ours', () => {
  it('each clef names its line, counted from the top line', () => {
    expect(CLEF_LINES).toEqual({ treble: 3, bass: 1, alto: 2, tenor: 1 })
    expect(clefSign('treble', 'default').line).toBe(3)
    expect(clefSign('tenor', 'default').line).toBe(1)
  })

  it('stamps the SMuFL clef glyph — G for treble, F for bass, C for alto and tenor', () => {
    expect(clefSign('treble', 'default').glyph).toBe('') // gClef
    expect(clefSign('bass', 'default').glyph).toBe('') // fClef
    expect(clefSign('alto', 'default').glyph).toBe('') // cClef
    expect(clefSign('tenor', 'small').glyph).toBe('')
  })

  it('a clef is set at 30 pt, and a small one at 20', () => {
    expect(clefSign('treble', 'default').font.size).toBe(30)
    expect(clefSign('bass', 'small').font.size).toBe(20)
  })
})
