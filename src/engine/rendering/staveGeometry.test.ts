// @vitest-environment jsdom
/**
 * **The assumption the two-tier split stands on** (docs/render-performance-plan.md §7).
 *
 * Tier 1 — where every measure *is* — must be derivable from a `Stave` that was **never drawn**.
 * That is what lets P6 cull a measure's draw without losing its position, and it is why
 * `buildStave` never touches the drawing context.
 *
 * It is load-bearing and it is a property of *VexFlow*, not of our code — so it is asserted here
 * rather than assumed. If a VexFlow upgrade ever makes `Stave` geometry depend on `draw()`, culling
 * would start returning stale or zeroed boxes for everything off-screen, and hit-testing,
 * scroll-into-view and playback-follow would break **silently, only off-screen**. This test is what
 * turns that into a red build instead.
 */
import { describe, it, expect } from 'vitest'
import { Renderer, Stave } from 'vexflow'

function ctx() {
  const div = document.createElement('div')
  document.body.appendChild(div)
  const renderer = new Renderer(div, Renderer.Backends.SVG)
  renderer.resize(1200, 400)
  return renderer.getContext()
}

function geometryOf(stave: Stave) {
  const box = stave.getBoundingBox()
  return {
    noteStartX: stave.getNoteStartX(),
    noteEndX: stave.getNoteEndX(),
    lineYs: [0, 1, 2, 3, 4].map(l => stave.getYForLine(l)),
    bbox: box ? { x: box.getX(), y: box.getY(), w: box.getW(), h: box.getH() } : null,
  }
}

function build(): Stave {
  const stave = new Stave(30, 40, 320)
  stave.addClef('treble')
  stave.addTimeSignature('3/4')
  stave.addEndClef('bass', 'small')
  return stave
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
    expect(g.bbox).not.toBeNull()
    expect(g.bbox!.w).toBeGreaterThan(0)
  })
})
