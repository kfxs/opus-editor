import { describe, it, expect } from 'vitest'
import { overhangFor } from './GutterController'
import { GUTTER_WIDTH, GUTTER_METER_AIR } from '../engine/rendering/layoutConfig'

/**
 * How far left linear view may be panned — the gutter's half of the answer (the viewport turns the
 * overhang into a scroll range; see `ViewportModel.setPinnedGutter`).
 *
 * The rule is stated against the MUSIC, not against the paper: the gutter repeats the clef, so the
 * engraved clef may pass under it, while the opening meter — which it does not repeat — must stay
 * in the clear. Every case here is that one sentence read at a different header width.
 */
describe('GutterController — the far-left pan limit', () => {
  /** The gutter's right edge, measured from the paper's left edge, at the limit. */
  const gutterRightEdge = (openingMeterX: number | null) => GUTTER_WIDTH - overhangFor(openingMeterX)

  it('stops the gutter one air-gap short of the opening meter', () => {
    // A plain treble opening: margin + clef, and the meter after it.
    expect(gutterRightEdge(65)).toBe(65 - GUTTER_METER_AIR)
  })

  it('follows the meter when the header grows — the limit is not a fixed distance', () => {
    expect(gutterRightEdge(90)).toBe(90 - GUTTER_METER_AIR)
    expect(gutterRightEdge(65)).toBeLessThan(gutterRightEdge(90))
  })

  it('never lets the gutter leave the paper, however far right the meter is engraved', () => {
    // A header wider than the gutter itself: the meter cannot be cleared, so the gutter sits flush
    // on the paper rather than drifting off it into the pasteboard — the failure being prevented.
    expect(overhangFor(GUTTER_WIDTH * 3)).toBe(0)
    expect(gutterRightEdge(GUTTER_WIDTH * 3)).toBe(GUTTER_WIDTH)
  })

  it('never hangs further off than its own width, however far left the meter is', () => {
    expect(overhangFor(0)).toBe(GUTTER_WIDTH)
  })

  it('sits flush when the opening bar draws no meter at all — nothing to protect', () => {
    expect(overhangFor(null)).toBe(0)
  })
})
