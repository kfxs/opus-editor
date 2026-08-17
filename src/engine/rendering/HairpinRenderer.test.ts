import { describe, it, expect } from 'vitest'
import type { Stave } from 'vexflow'
import type { HairpinEndpointOffsetOverride } from '@/types/music'
import { hairpinEndpointOffsetPx } from './HairpinRenderer'

/**
 * The wedge's RESHAPE, resolved to pixels.
 *
 * Subject: {@link HairpinRenderer}, sitting beside this file — its pure half. ⚠️ Nothing here asserts
 * where ink landed: jsdom measures no glyphs, so a drawn position would measure zeros and agree with
 * itself (`reference_jsdom_cannot_measure_glyphs`). What is asked is the CONVERSION, which is
 * arithmetic on two numbers the model holds and one the stave reports — and the two guards that keep
 * a half-laid-out score from throwing inside it.
 */
describe('hairpinEndpointOffsetPx', () => {
  // staffSpacesToPixels only reads getSpacingBetweenLines() — stub just that.
  const stave = (spacing: number) => ({ getSpacingBetweenLines: () => spacing } as unknown as Stave)
  const offset = (o: Partial<HairpinEndpointOffsetOverride>): HairpinEndpointOffsetOverride =>
    ({ kind: 'hairpinEndpointOffset', ...o })

  it('no offset → all-zero deltas, so the caller adds them unconditionally', () => {
    expect(hairpinEndpointOffsetPx(undefined, stave(10), stave(10)))
      .toEqual({ startX: 0, startY: 0, endX: 0, endY: 0 })
  })

  it('⭐ converts each end against ITS OWN stave — a split wedge can span two staff sizes', () => {
    const o = offset({ start: { x: 0.5, y: -1 }, end: { x: 2, y: 1 } })
    expect(hairpinEndpointOffsetPx(o, stave(10), stave(8)))
      .toEqual({ startX: 5, startY: -10, endX: 16, endY: 8 })
  })

  it('a missing end contributes 0 for that end only — one end may be nudged alone', () => {
    expect(hairpinEndpointOffsetPx(offset({ end: { x: 1, y: 1 } }), stave(10), stave(10)))
      .toEqual({ startX: 0, startY: 0, endX: 10, endY: 10 })
  })

  it('an undefined stave yields 0 for that end rather than throwing', () => {
    const o = offset({ start: { x: 3, y: 3 }, end: { x: 3, y: 3 } })
    expect(hairpinEndpointOffsetPx(o, undefined, stave(10)))
      .toEqual({ startX: 0, startY: 0, endX: 30, endY: 30 })
  })
})
