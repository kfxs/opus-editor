import { afterEach, describe, it, expect } from 'vitest'
import { longaStemGeneration, longaStemSide, resetLongaStemSide, setLongaStemSide } from './longaStem'

afterEach(resetLongaStemSide)

describe('longaStem — the side a longa\'s down stem stands on (other-durations P4, decision f)', () => {
  it('defaults to RIGHT (Verovio\'s, his call)', () => {
    expect(longaStemSide()).toBe('right')
  })

  it('arms normal; a re-arm moves the generation; ⛔ an unknown side is refused', () => {
    const before = longaStemGeneration()
    expect(setLongaStemSide('normal')).toBe(true)
    expect(longaStemSide()).toBe('normal')
    expect(longaStemGeneration()).toBeGreaterThan(before)
    expect(setLongaStemSide('left' as never)).toBe(false)
    expect(longaStemSide()).toBe('normal')
  })
})
