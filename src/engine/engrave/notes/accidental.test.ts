/**
 * ⭐ The accidental's ink, as arithmetic — the one rule it owns (it hangs LEFT) and the stamp.
 * ⛔ Not an ink EXTENT: `width` arrives as an argument precisely because measuring one needs a font.
 */
import { describe, it, expect } from 'vitest'
import { SceneRecorder } from '@/engine/scene/SceneRecorder'
import { scenePrimitives } from '@/engine/scene/Scene'
import { accidentalOriginX, drawAccidental } from './accidental'

describe('accidentalOriginX', () => {
  it('⭐ sets the glyph back by its own width — its RIGHT edge meets the point the note offered', () => {
    expect(accidentalOriginX(100, 8)).toBe(92)
  })

  it('⚠️ a zero width (jsdom, no fonts) collapses the origin onto the start — the standing limit', () => {
    expect(accidentalOriginX(100, 0)).toBe(100)
  })

  it('⭐ a WIDER sign hangs further left, ⛔ it does not push the note', () => {
    const sharp = accidentalOriginX(100, 8)
    const doubleFlat = accidentalOriginX(100, 14)
    expect(doubleFlat).toBeLessThan(sharp)
  })
})

describe('drawAccidental', () => {
  it('⭐ stamps ONE glyph at the origin it was handed, in the face it was handed', () => {
    const r = new SceneRecorder()
    drawAccidental(r, { glyph: '', x: 92, y: 40, font: { family: 'Bravura', size: 30 } })
    expect(scenePrimitives(r.scene)).toEqual([
      {
        kind: 'text', text: '', x: 92, y: 40,
        font: { family: 'Bravura', size: 30 },
        style: { fill: undefined, stroke: undefined, lineWidth: undefined, lineDash: undefined },
      },
    ])
  })

  it('⛔ opens NO group — an accidental’s text belongs inside its notehead’s, where the highlight looks', () => {
    const r = new SceneRecorder()
    drawAccidental(r, { glyph: '', x: 0, y: 0, font: undefined })
    expect(r.scene.children.every(c => c.kind !== 'group')).toBe(true)
  })
})
