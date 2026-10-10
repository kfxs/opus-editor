import { describe, it, expect } from 'vitest'
import type { PitchStep } from '@/types/music'
import {
  comparePitch, lowToHigh, MIDDLE_C_POSITION, octaveAbove, octaveNearest, pitchDirection, samePitch, staffPosition,
} from './pitchOrder'

const p = (step: PitchStep, alter: number, octave: number) => ({ step, alter, octave })

describe('staffPosition', () => {
  it('counts lines and spaces from C0; the signs play no part', () => {
    expect(staffPosition(p('C', 0, 4))).toBe(MIDDLE_C_POSITION)
    expect(staffPosition(p('C', 1, 4))).toBe(28)
    expect(staffPosition(p('D', -1, 4))).toBe(29)
    expect(staffPosition(p('B', 0, 4))).toBe(34)
  })
})

describe('comparePitch — the staff first, then the rank', () => {
  it('a higher line is higher, whatever the signs', () => {
    expect(comparePitch(p('C', 2, 4), p('D', -2, 4))).toBeLessThan(0)
    // ⚠️ written order, not sound: E♯ stands a line BELOW F♭ though it sounds higher
    expect(comparePitch(p('E', 1, 4), p('F', -1, 4))).toBeLessThan(0)
  })

  it('on the same line, the sign\'s rank decides', () => {
    expect(comparePitch(p('C', -1, 4), p('C', 0, 4))).toBeLessThan(0)
    expect(comparePitch(p('C', 2, 4), p('C', 1, 4))).toBeGreaterThan(0)
    expect(comparePitch(p('C', 0, 4), { step: 'C', octave: 4 })).toBe(0)
  })

  it('lowToHigh sorts a copy', () => {
    const chord = [p('G', 0, 4), p('C', 1, 4), p('C', 0, 4), p('E', -1, 4)]
    expect(lowToHigh(chord)).toEqual([p('C', 0, 4), p('C', 1, 4), p('E', -1, 4), p('G', 0, 4)])
    expect(chord[0]).toEqual(p('G', 0, 4))
  })

  it('pitchDirection: +1 up, −1 down, 0 the same', () => {
    expect(pitchDirection(p('C', 0, 4), p('D', 0, 4))).toBe(1)
    expect(pitchDirection(p('D', 0, 4), p('C', 0, 4))).toBe(-1)
    expect(pitchDirection(p('D', 1, 4), p('D', 1, 4))).toBe(0)
  })
})

describe('samePitch — letter, signs and octave (M1)', () => {
  it('the same written pitch', () => {
    expect(samePitch(p('C', 1, 4), p('C', 1, 4))).toBe(true)
    expect(samePitch(p('C', 0, 4), { step: 'C', octave: 4 })).toBe(true) // absent alter = natural
  })

  it('⭐ C♯ and D♭ are TWO pitches — only a tuning says they sound alike', () => {
    expect(samePitch(p('C', 1, 4), p('D', -1, 4))).toBe(false)
    expect(samePitch(p('G', 2, 4), p('A', 0, 4))).toBe(false)
  })

  it('another sign or another octave is another pitch', () => {
    expect(samePitch(p('C', 1, 4), p('C', 0, 4))).toBe(false)
    expect(samePitch(p('A', 0, 4), p('A', 0, 5))).toBe(false)
  })
})

describe('octaveNearest — a typed letter lands on the nearest line', () => {
  it('always within a fourth, so never a tie', () => {
    expect(octaveNearest('D', staffPosition(p('C', 0, 4)))).toBe(4)
    expect(octaveNearest('B', staffPosition(p('C', 0, 4)))).toBe(3)
    expect(octaveNearest('F', staffPosition(p('C', 0, 4)))).toBe(4) // a fourth up beats a fifth down
    expect(octaveNearest('G', staffPosition(p('C', 0, 4)))).toBe(3) // a fourth down beats a fifth up
  })

  it('B4 then F goes DOWN to F4 (3 steps), not up a tritone (MuseScore\'s answer too)', () => {
    expect(octaveNearest('F', staffPosition(p('B', 0, 4)))).toBe(4)
  })

  it('the reference\'s accidental plays no part: F♯4 then C is C4', () => {
    expect(octaveNearest('C', staffPosition(p('F', 1, 4)))).toBe(4)
  })
})

describe('octaveAbove — a letter added to a chord lands strictly above its top line', () => {
  it('the next line up with that letter', () => {
    expect(octaveAbove('E', staffPosition(p('C', 0, 4)))).toBe(4)
    expect(octaveAbove('C', staffPosition(p('E', 0, 4)))).toBe(5)
  })

  it('never on the top note\'s own line: D♭4, Shift+D is D5', () => {
    expect(octaveAbove('D', staffPosition(p('D', -1, 4)))).toBe(5)
    expect(octaveAbove('C', staffPosition(p('B', 1, 4)))).toBe(5)
  })
})
