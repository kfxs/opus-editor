import { describe, it, expect } from 'vitest'
import { glyphCentreX, headsLeftX, headsRightX, stemX, type NoteXInputs } from './noteGeometry'
import { STEM_THICKNESS_PX } from '@/engine/engrave/inheritedDefaults'

function note(over: Partial<NoteXInputs> = {}): NoteXInputs {
  return { originX: 100, xShift: 4, glyphWidth: 12, stemDirection: 1, isRestType: false, ...over }
}

describe('noteGeometry — a note’s x’s', () => {
  it('the heads run from origin + shift, one glyph wide', () => {
    expect(headsLeftX(note())).toBe(104)
    expect(headsRightX(note())).toBe(116)
    expect(glyphCentreX(note())).toBe(110)
  })

  it('a stem UP stands at the heads’ right edge, half a stroke inside them', () => {
    expect(stemX(note())).toBe(116 - STEM_THICKNESS_PX / 2)
  })

  it('a stem DOWN stands at their left edge, half a stroke inside', () => {
    expect(stemX(note({ stemDirection: -1 }))).toBe(104 + STEM_THICKNESS_PX / 2)
  })

  it('a note with no direction takes the right edge and no half-stroke', () => {
    expect(stemX(note({ stemDirection: 0 }))).toBe(116)
  })

  it('a REST’s stem is its glyph centre, whatever direction it carries', () => {
    expect(stemX(note({ isRestType: true, stemDirection: -1 }))).toBe(110)
  })
})
