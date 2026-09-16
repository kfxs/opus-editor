/**
 * Which column each accidental of a chord takes. ⚠️ Exactness against `Accidental.format` was proved
 * once, on 3,264 signs of random chords (S9d, `docs/vexflow-removal-map.md` §5.2); pinned here is the
 * rule's shape.
 */
import { describe, it, expect } from 'vitest'
import { type StackedAccidental, stackAccidentals } from './accidentalStack'
import {
  ACCIDENTAL_LEFT_PADDING_PX, ACCIDENTAL_NOTEHEAD_PADDING_PX, ACCIDENTAL_SPACING_PX,
} from '@/engine/engrave/inheritedDefaults'

const W = 8
const sign = (line: number, type = '#', over: Partial<StackedAccidental> = {}): StackedAccidental => ({
  line, type, width: W, displacedRoom: 0, ...over,
})
/** The distance one column adds: a sign and its spacing. */
const COLUMN = W + ACCIDENTAL_SPACING_PX
const FIRST = ACCIDENTAL_NOTEHEAD_PADDING_PX

describe('stackAccidentals', () => {
  it('one sign stands in the first column, and the note gains its room', () => {
    const { xShifts, leftShift } = stackAccidentals([sign(3)], 0)
    expect(xShifts).toEqual([FIRST])
    expect(leftShift).toBe(FIRST + COLUMN + ACCIDENTAL_LEFT_PADDING_PX)
  })

  it('⭐ signs an octave apart share a column', () => {
    expect(stackAccidentals([sign(1), sign(4.5)], 0).xShifts).toEqual([FIRST, FIRST])
  })

  it('⭐ a third apart they collide: the upper sign stays nearest, the lower steps out', () => {
    expect(stackAccidentals([sign(3), sign(4)], 0).xShifts).toEqual([FIRST + COLUMN, FIRST])
  })

  it('⭐ a close triad takes the 1-3-2 pattern: top, bottom, middle', () => {
    const { xShifts } = stackAccidentals([sign(3), sign(4), sign(5)], 0)
    expect(xShifts).toEqual([FIRST + COLUMN, FIRST + 2 * COLUMN, FIRST])
  })

  it('flats may come half a line closer: 2½ lines apart is clear when the UPPER line is flats', () => {
    expect(stackAccidentals([sign(2, 'b'), sign(4.5, 'b')], 0).xShifts).toEqual([FIRST, FIRST])
    expect(stackAccidentals([sign(2, 'b'), sign(4.5, '#')], 0).xShifts, 'a sharp above still collides')
      .toEqual([FIRST + COLUMN, FIRST])
  })

  it('two signs on ONE line pack side by side', () => {
    expect(stackAccidentals([sign(3, 'b'), sign(3, '#')], 0).xShifts).toEqual([FIRST, FIRST + COLUMN])
  })

  it('a left-displaced head pushes every sign out', () => {
    expect(stackAccidentals([sign(3, '#', { displacedRoom: 10 })], 0).xShifts).toEqual([FIRST + 10])
  })

  it('starts from the column’s existing left shift', () => {
    expect(stackAccidentals([sign(3)], 5).xShifts).toEqual([5 + FIRST])
  })
})
