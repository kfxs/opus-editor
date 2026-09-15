import { describe, it, expect } from 'vitest'
import { modifierStart, type ModifierStartNote } from './modifierStart'

/** A stem-up flagged eighth: origin 100, head 12 wide, flag 8, shift 3, two heads, head y 50. */
function note(over: Partial<ModifierStartNote> = {}): ModifierStartNote {
  return {
    originX: 100, glyphWidth: 12, xShift: 3, stemDirection: 1, hasFlag: true, flagWidth: () => 8,
    hasStem: true, stemX: () => 111, headCount: 2, headY: 50, headGlyph: '', spacePx: 10,
    ...over,
  }
}

describe('modifierStart', () => {
  it('LEFT stands 2 px before the origin, and ignores the note shift', () => {
    expect(modifierStart('left', 0, note())).toEqual({ x: 98, y: 50 })
  })

  it('RIGHT stands past the head, the shift and 2 px — and past the flag only for the inner head', () => {
    expect(modifierStart('right', 0, note()).x).toBe(100 + 12 + 3 + 2)
    expect(modifierStart('right', 1, note()).x, 'the inner head of a stem-up chord is its top one').toBe(125)
  })

  it('a caller may force the flag push (the dot does); a stem-down note or no flag never pushes', () => {
    expect(modifierStart('right', 0, note(), true).x).toBe(125)
    expect(modifierStart('right', 0, note({ stemDirection: -1 }), true).x).toBe(117)
    expect(modifierStart('right', 1, note({ hasFlag: false })).x).toBe(117)
  })

  it('ABOVE and BELOW stand at the head centre, without the note shift', () => {
    expect(modifierStart('above', 0, note()).x).toBe(106)
    expect(modifierStart('below', 0, note()).x).toBe(106)
    expect(modifierStart('center', 0, note()).x).toBe(100)
  })

  it("a rest's modifier moves off its line by the rest glyph", () => {
    expect(modifierStart('right', 0, note({ headGlyph: '' })).y, 'whole rest').toBe(55)
    expect(modifierStart('right', 0, note({ headGlyph: '' })).y, 'quarter rest').toBe(45)
    expect(modifierStart('right', 0, note({ headGlyph: '' })).y, '128th rest').toBe(25)
  })

  it('⭐ the mark anchor: a mark follows the hand offset on both sides', () => {
    const anchor = { offsetPx: 7, stemAlign: false }
    expect(modifierStart('above', 0, note({ markAnchor: anchor })).x).toBe(113)
    expect(modifierStart('below', 0, note({ markAnchor: anchor })).x).toBe(113)
    expect(modifierStart('right', 0, note({ markAnchor: anchor })).x, 'never a side mark').toBe(117)
  })

  it('⭐ the mark anchor: stem alignment puts only the STEM-side mark on the stem', () => {
    const anchor = { offsetPx: 7, stemAlign: true }
    expect(modifierStart('above', 0, note({ markAnchor: anchor })).x, 'stem up: above is the stem side').toBe(111)
    expect(modifierStart('below', 0, note({ markAnchor: anchor })).x, 'the head side follows the offset').toBe(113)
    expect(modifierStart('below', 0, note({ markAnchor: anchor, stemDirection: -1 })).x).toBe(111)
    expect(modifierStart('above', 0, note({ markAnchor: anchor, hasStem: false })).x, 'a stemless note keeps its head').toBe(113)
  })
})
