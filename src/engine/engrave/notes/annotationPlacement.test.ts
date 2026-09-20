/**
 * Where a text annotation stands on its note (S12g — `Annotation.draw`'s placement, transcribed).
 * ⚠️ Exactness against VexFlow was proved on the page: 50 random scores (797 dynamics, 138 hairpins)
 * byte-identical, down to the last bit of the note boxes they merge into (`docs/history/vexflow-removal-map.md`
 * S12g). Pinned here is the rule.
 */
import { describe, it, expect } from 'vitest'
import { ANNOTATION_ALIGN, ANNOTATION_SIDE, placeAnnotation, type AnnotationPlacementInput } from './annotationPlacement'

/** A stem-up quarter whose head is at y 100, its stem tip at 65; the staff's top line at 80. */
const input = (over: Partial<AnnotationPlacementInput> = {}): AnnotationPlacementInput => ({
  align: ANNOTATION_ALIGN.LEFT, side: ANNOTATION_SIDE.BOTTOM, textLine: 0, textWidth: 20, textHeight: 16,
  startX: 50, stemX: 60, hasStem: true, stemDirection: 1, stemTopY: 65, stemBaseY: 100,
  staffSpace: 10, topLineY: 80, headYs: [100],
  noteTopTextY: () => 60, staveBottomTextY: () => 130,
  ...over,
})

describe('placeAnnotation', () => {
  it('hangs off the modifier point by its justification — left edge, right edge, middle, or middle on the stem', () => {
    expect(placeAnnotation(input()).x).toBe(50)
    expect(placeAnnotation(input({ align: ANNOTATION_ALIGN.RIGHT })).x).toBe(30)
    expect(placeAnnotation(input({ align: ANNOTATION_ALIGN.CENTER })).x).toBe(40)
    expect(placeAnnotation(input({ align: ANNOTATION_ALIGN.CENTER_STEM })).x).toBe(50)
  })

  it('⭐ BELOW: a line past the lowest head per text line, plus its own height', () => {
    expect(placeAnnotation(input()).y).toBe(100 + 10 + 16)
    expect(placeAnnotation(input({ textLine: 1 })).y).toBe(100 + 20 + 16)
  })

  it('BELOW a stem that points down, it clears the stem\'s tip', () => {
    const y = placeAnnotation(input({ stemDirection: -1, stemTopY: 140, stemBaseY: 100 })).y
    expect(y).toBe(140 + 16)
  })

  it('⭐ ABOVE a stem that points up, a space clear of the tip — a full line when the tip is above the staff', () => {
    expect(placeAnnotation(input({ side: ANNOTATION_SIDE.TOP })).y).toBe(65 - 10)
    expect(placeAnnotation(input({ side: ANNOTATION_SIDE.TOP, stemTopY: 85 })).y).toBe(85 - 10)
  })

  it('CENTRED between the note\'s top-text row and the stave\'s bottom-text row', () => {
    expect(placeAnnotation(input({ side: ANNOTATION_SIDE.CENTER })).y).toBe(59 + (130 - 59) / 2 + 8)
  })
})
