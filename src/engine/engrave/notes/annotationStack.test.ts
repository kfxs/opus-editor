/**
 * How a column's text annotations stack. ⚠️ Exactness against `Annotation.format` was proved once, on
 * ~1,100 texts of random scores (S9f, `docs/vexflow-removal-map.md` §5.2); pinned here is the rule.
 */
import { describe, it, expect } from 'vitest'
import { type AnnotationColumnState, type StackedAnnotation, stackAnnotations } from './annotationStack'

const empty: AnnotationColumnState = { leftShift: 0, rightShift: 0, textLine: 0, topTextLine: 0 }
/** A 18-px text: (2 + 18) / 10 = 2 staff spaces tall. */
const text = (over: Partial<StackedAnnotation> = {}): StackedAnnotation => ({
  align: 'left', side: 'bottom', fontPx: 18, width: 30, noteGlyphWidth: 12,
  stemDirection: 1, stemSpaces: 3.5, staffLines: 5, topLine: 3, bottomLine: 3, ...over,
})

describe('stackAnnotations', () => {
  it('⭐ a text below a note inside the staff jumps clear of the bottom line', () => {
    // Head on line 3, stem up: 5 − 3 + 0 + 1 = 3 < 5, so the text starts 2 lines further out.
    const { textLines, state } = stackAnnotations([text()], empty)
    expect(textLines).toEqual([2])
    expect(state.textLine).toBe(2 + 2)
  })

  it('…but stacks on what is already there once that is outside the staff', () => {
    const { textLines, state } = stackAnnotations([text()], { ...empty, textLine: 3 })
    expect(textLines).toEqual([3])
    expect(state.textLine).toBe(3 + 2)
  })

  it('above, it counts from the stem tip when the stem points up', () => {
    // 3 + 3.5 + 0 + 0.5 = 7 — already outside, so it stacks at 0.
    expect(stackAnnotations([text({ side: 'top' })], empty).textLines).toEqual([0])
    // A stem-down note starts inside: 3 + 0.5 < 5, so it jumps to 5 − 3.
    expect(stackAnnotations([text({ side: 'top', stemDirection: -1 })], empty).textLines).toEqual([2])
  })

  it('a text with neither side takes the lower counter and leaves it', () => {
    const { textLines, state } = stackAnnotations([text({ side: 'other' })], { ...empty, textLine: 1.5 })
    expect(textLines).toEqual([1.5])
    expect(state.textLine).toBe(1.5)
  })

  it('the column widens by what a left-justified text overhangs on its right', () => {
    const { state } = stackAnnotations([text({ width: 30 })], empty)
    expect(state.rightShift).toBe(30 - 12)
    expect(state.leftShift).toBe(0)
  })

  it('no texts, no change', () => {
    expect(stackAnnotations([], empty)).toEqual({ textLines: [], state: empty })
  })
})
