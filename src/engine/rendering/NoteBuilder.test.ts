import { describe, it, expect } from 'vitest'
import {
  resolveTupletLocation,
  innerFlipTupletYOffset,
  TUPLET_LOCATION_ABOVE,
  TUPLET_LOCATION_BELOW,
  type TupletNoteStem,
} from './NoteBuilder'

describe('resolveTupletLocation', () => {
  // A stem-derived fallback distinct from both voice defaults, so we can tell
  // when the single-voice branch is (and isn't) used.
  const FALLBACK = TUPLET_LOCATION_BELOW

  it('honours an explicit "above" override regardless of voice/multiVoice', () => {
    expect(resolveTupletLocation('above', false, 0, FALLBACK)).toBe(TUPLET_LOCATION_ABOVE)
    expect(resolveTupletLocation('above', true, 1, FALLBACK)).toBe(TUPLET_LOCATION_ABOVE)
  })

  it('honours an explicit "below" override regardless of voice/multiVoice', () => {
    expect(resolveTupletLocation('below', false, 0, TUPLET_LOCATION_ABOVE)).toBe(TUPLET_LOCATION_BELOW)
    expect(resolveTupletLocation('below', true, 0, TUPLET_LOCATION_ABOVE)).toBe(TUPLET_LOCATION_BELOW)
  })

  it('multi-voice: primary voice (0) bracket goes above', () => {
    expect(resolveTupletLocation(undefined, true, 0, FALLBACK)).toBe(TUPLET_LOCATION_ABOVE)
  })

  it('multi-voice: lower voices bracket goes below', () => {
    expect(resolveTupletLocation(undefined, true, 1, TUPLET_LOCATION_ABOVE)).toBe(TUPLET_LOCATION_BELOW)
    expect(resolveTupletLocation(undefined, true, 2, TUPLET_LOCATION_ABOVE)).toBe(TUPLET_LOCATION_BELOW)
  })

  it('single voice: uses the stem-derived fallback', () => {
    expect(resolveTupletLocation(undefined, false, 0, TUPLET_LOCATION_ABOVE)).toBe(TUPLET_LOCATION_ABOVE)
    expect(resolveTupletLocation(undefined, false, 0, TUPLET_LOCATION_BELOW)).toBe(TUPLET_LOCATION_BELOW)
  })
})

describe('innerFlipTupletYOffset', () => {
  // A lower voice (voice 1) with stems down; noteheads (baseY) low on the page.
  const downStems: TupletNoteStem[] = [
    { stemUp: false, topY: 220, baseY: 160 },
    { stemUp: false, topY: 225, baseY: 165 },
  ]
  // The primary voice (voice 0) with stems up; noteheads (baseY) around the staff.
  const upStems: TupletNoteStem[] = [
    { stemUp: true, topY: 40, baseY: 110 },
    { stemUp: true, topY: 45, baseY: 115 },
  ]

  it('is a no-op for a single voice', () => {
    expect(innerFlipTupletYOffset(downStems, TUPLET_LOCATION_ABOVE, 1, false, 5)).toBe(0)
  })

  it('is a no-op for an OUTER bracket (voice 0 above, lower voice below)', () => {
    expect(innerFlipTupletYOffset(upStems, TUPLET_LOCATION_ABOVE, 0, true, 5)).toBe(0)
    expect(innerFlipTupletYOffset(downStems, TUPLET_LOCATION_BELOW, 1, true, 300)).toBe(0)
  })

  it('lower voice flipped ABOVE: nudges DOWN toward its own notes (positive offset)', () => {
    // clampedY = 5 (VexFlow shoved it above the system); desired = min(baseY-20) = 140.
    const off = innerFlipTupletYOffset(downStems, TUPLET_LOCATION_ABOVE, 1, true, 5)
    expect(off).toBe(140 - 5)
    expect(off).toBeGreaterThan(0)
  })

  it('voice 0 flipped BELOW: nudges UP toward its own notes (negative offset)', () => {
    // clampedY = 300 (shoved below the system); desired = max(baseY+20) = 135.
    const off = innerFlipTupletYOffset(upStems, TUPLET_LOCATION_BELOW, 0, true, 300)
    expect(off).toBe(135 - 300)
    expect(off).toBeLessThan(0)
  })

  it('never nudges further toward the edge (clamped to 0)', () => {
    // Above-flip where desired is already higher than clamped → would push up; clamp to 0.
    expect(innerFlipTupletYOffset(downStems, TUPLET_LOCATION_ABOVE, 1, true, 999)).toBe(140 - 999 < 0 ? 0 : 140 - 999)
    expect(innerFlipTupletYOffset(downStems, TUPLET_LOCATION_ABOVE, 1, true, 999)).toBe(0)
  })

  it('is a no-op with no notes', () => {
    expect(innerFlipTupletYOffset([], TUPLET_LOCATION_ABOVE, 1, true, 5)).toBe(0)
  })
})
