import { describe, it, expect } from 'vitest'
import { rangeStep } from './rangeStep'

describe('rangeStep — Shift+←/→ moves the head, the far end stays', () => {
  it('from one note, → grows to the right and ← grows to the left', () => {
    expect(rangeStep([3], 3, 1, 10)).toEqual({ anchor: 3, head: 4 })
    expect(rangeStep([3], 3, -1, 10)).toEqual({ anchor: 3, head: 2 })
  })

  it('a head at the right end walks back toward the anchor — the range shrinks', () => {
    expect(rangeStep([3, 4, 5], 5, -1, 10)).toEqual({ anchor: 3, head: 4 })
  })

  it('a head at the left end keeps the RIGHT end fixed', () => {
    expect(rangeStep([1, 2, 3], 1, 1, 10)).toEqual({ anchor: 3, head: 2 })
    expect(rangeStep([1, 2, 3], 1, -1, 10)).toEqual({ anchor: 3, head: 0 })
  })

  it('stepping off the lane leaves the range alone', () => {
    expect(rangeStep([8, 9], 9, 1, 10)).toBeNull()
    expect(rangeStep([0], 0, -1, 10)).toBeNull()
  })

  it('ignores selected notes that are not on the lane', () => {
    expect(rangeStep([-1, 4], 4, 1, 10)).toEqual({ anchor: 4, head: 5 })
  })
})
