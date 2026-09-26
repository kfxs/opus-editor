import { afterEach, describe, it, expect } from 'vitest'
import { barRestDuration, barRestGeneration, resetBarRestStyle, setBarRestStyle } from './barRestStyle'
import { fracCreate } from '@/utils/fraction'

afterEach(resetBarRestStyle)

describe('barRestStyle — which glyph a whole-bar rest draws (other-durations P4, decision c)', () => {
  it('⭐ convention (default): a whole rest below 8 quarters, a BREVE rest from 8 (4/2 = 8/4) up', () => {
    expect(barRestDuration(4)).toBe('w')
    expect(barRestDuration(7)).toBe('w') // 7/4
    expect(barRestDuration(6)).toBe('w') // 3/2
    expect(barRestDuration(8)).toBe('breve') // 4/2, 8/4
    expect(barRestDuration(fracCreate(16, 1))).toBe('breve') // 4/1 — no longa rest by convention
  })

  it('whole: today\'s before this row — a whole rest in every meter', () => {
    setBarRestStyle('whole')
    expect(barRestDuration(8)).toBe('w')
    expect(barRestDuration(16)).toBe('w')
  })

  it('lilypond: the convention, and a LONGA rest from 16 quarters', () => {
    setBarRestStyle('lilypond')
    expect(barRestDuration(8)).toBe('breve')
    expect(barRestDuration(16)).toBe('longa')
  })

  it('a re-arm moves the generation; ⛔ an unknown style is refused', () => {
    const before = barRestGeneration()
    expect(setBarRestStyle('whole')).toBe(true)
    expect(barRestGeneration()).toBeGreaterThan(before)
    expect(setBarRestStyle('sibelius' as never)).toBe(false)
  })
})
