import { describe, it, expect } from 'vitest'
import { articulationEffect } from './articulations'

describe('articulationEffect', () => {
  it('is identity for no articulations', () => {
    expect(articulationEffect(undefined)).toEqual({ durationFactor: 1, velocityScale: 1 })
    expect(articulationEffect([])).toEqual({ durationFactor: 1, velocityScale: 1 })
  })

  it('staccato shortens duration, leaves velocity', () => {
    expect(articulationEffect(['staccato'])).toEqual({ durationFactor: 0.5, velocityScale: 1 })
  })

  it('accent boosts velocity, leaves duration', () => {
    const e = articulationEffect(['accent'])
    expect(e.durationFactor).toBe(1)
    expect(e.velocityScale).toBeCloseTo(1.3)
  })

  it('tenuto is a no-op against nominal duration (holds full value)', () => {
    expect(articulationEffect(['tenuto'])).toEqual({ durationFactor: 1, velocityScale: 1 })
  })

  it('composes multiple marks multiplicatively', () => {
    const e = articulationEffect(['staccato', 'accent'])
    expect(e.durationFactor).toBeCloseTo(0.5)
    expect(e.velocityScale).toBeCloseTo(1.3)
  })
})
