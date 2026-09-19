/**
 * A note's flag, ours (S12j-d3): the glyph the note draws and the box its hit box merges. ⚠️ That the page
 * is unchanged was proved by the S12j-d3 A/B (`docs/vexflow-removal-map.md`); pinned here is its contract,
 * against a stand-in measurement — jsdom has no fonts.
 */
import { describe, it, expect, vi } from 'vitest'

vi.mock('./glyphPainter', () => ({
  measureTextMetrics: (_tag: string, text: string) =>
    text === '' ? { width: 0, ascent: 0, descent: 0, left: 0, right: 0 } : { width: 8, ascent: 3, descent: 20, left: 0, right: 8 },
}))

const { EngravedFlag } = await import('./EngravedFlag')

describe('EngravedFlag', () => {
  it('measures the glyph it was given — nothing before it has one', () => {
    const flag = new EngravedFlag()
    expect(flag.getWidth()).toBe(0)
    flag.setText('')
    expect(flag.getText()).toBe('')
    expect([flag.getWidth(), flag.getHeight()]).toEqual([8, 23])
    expect(flag.getTextMetrics()).toEqual({ actualBoundingBoxAscent: 3, actualBoundingBoxDescent: 20 })
  })

  it('⭐ boxes itself from the point the draw wrote back — its ascent above it', () => {
    const box = new EngravedFlag().setText('').setX(100).setY(50).getBoundingBox()
    expect([box.x, box.y, box.w, box.h]).toEqual([100, 47, 8, 23])
  })
})
