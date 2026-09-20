/**
 * A face normalised and written as CSS — VexFlow's `Font.validate` / `Font.toCSSString`, as ours (S13a).
 * ⚠️ Equality with VexFlow's was proved once over a 1,600-case grid (`docs/history/vexflow-removal-map.md` S13a);
 * pinned here are the rules and the quirks.
 */
import { describe, it, expect } from 'vitest'
import { fontToCss, validateFont } from './fontFace'

describe('validateFont', () => {
  it('fills every gap from the root face and writes a numeric size as POINTS', () => {
    expect(validateFont({ size: 12 })).toEqual({ family: 'Bravura,Academico', size: '12pt', weight: 'normal', style: 'normal' })
    expect(validateFont('Foo', 13.52, 700, '')).toEqual({ family: 'Foo', size: '13.52pt', weight: '700', style: 'normal' })
  })

  it('keeps a CSS size as it came', () => {
    expect(validateFont({ family: 'Foo', size: '16px' }).size).toBe('16px')
  })

  it('⛔ refuses a bare CSS shorthand — the DOM parses that, the painter\'s branch', () => {
    expect(() => validateFont('12pt Foo')).toThrow(/bare CSS shorthand/)
  })
})

describe('fontToCss', () => {
  it('writes style, weight, size, family — a normal style or weight left out', () => {
    expect(fontToCss({ family: 'Academico', size: '12pt', weight: 'bold', style: 'italic' })).toBe('italic bold 12pt Academico')
    expect(fontToCss({ family: 'Bravura,Academico', size: 30, weight: 'normal', style: 'normal' })).toBe('30pt Bravura,Academico')
  })

  it('⚠️ keeps VexFlow\'s slip: an absent size is written with no space before the family', () => {
    expect(fontToCss({ family: 'Foo' })).toBe('30ptFoo')
  })

  it('nothing in, nothing out', () => {
    expect(fontToCss(undefined)).toBe('')
  })
})
