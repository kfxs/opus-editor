import { describe, it, expect } from 'vitest'
import {
  resolveTupletLocation,
  TUPLET_LOCATION_ABOVE,
  TUPLET_LOCATION_BELOW,
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
