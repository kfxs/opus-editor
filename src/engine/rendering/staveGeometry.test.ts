// @vitest-environment jsdom
/**
 * **The assumption the two-tier split stands on** (docs/history/render-performance-plan.md §7).
 *
 * Tier 1 — where every measure *is* — must be derivable from a stave that was **never drawn**.
 * That is what lets P6 cull a measure's draw without losing its position, and it is why
 * `buildStave` never touches the drawing context.
 *
 * It is load-bearing, and it was first a property of VexFlow's `Stave`; since S12h the stave is ours
 * (`EngravedStave`), so it is asserted here rather than assumed. If a change ever makes its
 * geometry depend on `draw()`, culling
 * would start returning stale or zeroed boxes for everything off-screen, and hit-testing,
 * scroll-into-view and playback-follow would break **silently, only off-screen**. This test is what
 * turns that into a red build instead.
 */
import { describe, it, expect } from 'vitest'
import { EngravedStave } from './EngravedStave'
import { SvgPainter } from './SvgPainter'

function ctx() {
  const div = document.createElement('div')
  document.body.appendChild(div)
  return new SvgPainter(div).resize(1200, 400)
}

function geometryOf(stave: EngravedStave) {
  return {
    noteStartX: stave.getNoteStartX(),
    noteEndX: stave.getNoteEndX(),
    lineYs: [0, 1, 2, 3, 4].map(l => stave.getYForLine(l)),
    bbox: stave.getBoundingBox(),
  }
}

function build(): EngravedStave {
  return new EngravedStave(30, 40, 320)
    .addClefSign('treble', 'default')
    .addMeter({ numerator: 3, denominator: 4 })
    .addClefSign('bass', 'small', 'closing')
}

describe('P5 tier-1: Stave geometry without drawing', () => {
  it('an undrawn stave reports the same geometry as a drawn one', () => {
    const undrawn = geometryOf(build())

    const drawn = build()
    drawn.setContext(ctx()).draw()

    expect(undrawn).toEqual(geometryOf(drawn))
  })

  it('the geometry is real, not zeroed placeholders', () => {
    const g = geometryOf(build())
    // A clef + 3/4 must push the first note well right of the stave origin.
    expect(g.noteStartX).toBeGreaterThan(30)
    expect(g.noteEndX).toBeGreaterThan(g.noteStartX)
    // Five distinct, evenly spaced staff lines.
    expect(new Set(g.lineYs).size).toBe(5)
    expect(g.bbox.w).toBeGreaterThan(0)
  })
})
