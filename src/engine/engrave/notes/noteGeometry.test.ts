import { describe, it, expect } from 'vitest'
import {
  displacedHeadRoom, glyphCentreX, headsLeftX, headsRightX, stemX, tieLeftX, type NoteXInputs,
} from './noteGeometry'
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

describe('noteGeometry — displaced heads (S6b)', () => {
  const width = () => 12

  it('no second in the chord, no room on either side', () => {
    expect(displacedHeadRoom({ displaced: false, stemDirection: -1, hasFlag: false, glyphWidth: width }))
      .toEqual({ left: 0, right: 0 })
  })

  it('a stem DOWN pushes a head to the LEFT, one glyph wide', () => {
    expect(displacedHeadRoom({ displaced: true, stemDirection: -1, hasFlag: true, glyphWidth: width }))
      .toEqual({ left: 12, right: 0 })
  })

  it('a stem UP pushes one to the RIGHT — unless a flag already takes that side', () => {
    expect(displacedHeadRoom({ displaced: true, stemDirection: 1, hasFlag: false, glyphWidth: width }))
      .toEqual({ left: 0, right: 12 })
    expect(displacedHeadRoom({ displaced: true, stemDirection: 1, hasFlag: true, glyphWidth: width }))
      .toEqual({ left: 0, right: 0 })
  })

  it('the width is only asked for when a side takes room', () => {
    let asked = 0
    displacedHeadRoom({ displaced: false, stemDirection: 1, hasFlag: false, glyphWidth: () => { asked++; return 12 } })
    expect(asked).toBe(0)
  })

  it('a tie leaves on the left at the heads’ edge, less the left room', () => {
    expect(tieLeftX(note(), 0)).toBe(104)
    expect(tieLeftX(note(), 12)).toBe(92)
  })
})
