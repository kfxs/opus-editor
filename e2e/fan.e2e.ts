import { test, expect } from './fixtures'

/**
 * Fanned (feathered) beams (docs/fanned-beams-plan.md), measured for real.
 *
 * `VexFlowRenderer.fan.test.ts` says at its head that it is *"deliberately not a geometry suite —
 * jsdom stubs glyph measurement, so an assertion about where the ink landed would pass vacuously"*.
 * This is that missing half. The fan is the feature most exposed to a renderer refactor: it draws
 * its own noteheads, its own stems and its own beam lines, none of it VexFlow's.
 *
 * The two facts a fan must keep are the two it is FOR: the heads crowd together (accel) or spread
 * apart (rit), and the beam lines converge at the slow end and feather out at the fast one.
 */

/** How close two y values must be to count as the same beam line. */
const SAME_LINE = 0.01

/** The distinct heights the ramp lines sit at on one side — the number of lines you SEE there. */
function linesAt(ys: number[]): number {
  return new Set(ys.map(y => Math.round(y / SAME_LINE))).size
}

test('an accelerando fan: heads crowd together, beams feather OUT to the right', async ({ score }) => {
  const drawn = await score.evaluate(async () => {
    const h = window.__h
    const note = h.engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'h', measure: 1, beat: h.frac(0, 1) })
    h.engine.setFan(note!.id, { direction: 'accel', count: 6, beams: 3 })
    await h.render()
    return {
      heads: h.noteheads(),
      ramps: h.quads('g.vf-fan path'),
      slots: h.engine.getScore().measures[0].slots.filter(s => s.type === 'chord').length,
    }
  })

  // The assertion is one note; the six are a projection of it and are never written back
  // (docs/fanned-beams-plan.md §0). Both halves are visible here at once.
  expect(drawn.slots, 'the model still holds ONE event').toBe(1)
  expect(drawn.heads, 'and six are drawn').toHaveLength(6)

  const gaps = drawn.heads.slice(1).map((head, i) => head.x - drawn.heads[i].x)
  for (const [i, gap] of gaps.slice(1).entries()) {
    expect(gap, 'each gap is no wider than the one before — the music speeds up').toBeLessThanOrEqual(gaps[i] + 0.01)
  }
  expect(gaps[gaps.length - 1], 'and the last is clearly tighter than the first').toBeLessThan(gaps[0] - 1)

  expect(drawn.ramps, 'three beams asked for, three lines drawn').toHaveLength(3)
  expect(linesAt(drawn.ramps.map(r => r.yLeft)), 'converged at the slow end').toBe(1)
  expect(linesAt(drawn.ramps.map(r => r.yRight)), 'feathered at the fast end').toBe(3)
})

test('a ritardando fan is its mirror', async ({ score }) => {
  const drawn = await score.evaluate(async () => {
    const h = window.__h
    const note = h.engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'h', measure: 1, beat: h.frac(0, 1) })
    h.engine.setFan(note!.id, { direction: 'rit', count: 6, beams: 3 })
    await h.render()
    return { heads: h.noteheads(), ramps: h.quads('g.vf-fan path') }
  })

  const gaps = drawn.heads.slice(1).map((head, i) => head.x - drawn.heads[i].x)
  for (const [i, gap] of gaps.slice(1).entries()) {
    expect(gap, 'each gap is at least as wide as the one before — the music slows').toBeGreaterThanOrEqual(gaps[i] - 0.01)
  }
  expect(gaps[gaps.length - 1], 'and the last is clearly wider than the first').toBeGreaterThan(gaps[0] + 1)

  expect(linesAt(drawn.ramps.map(r => r.yLeft)), 'feathered at the fast end — which is now the left').toBe(3)
  expect(linesAt(drawn.ramps.map(r => r.yRight)), 'converged at the slow end').toBe(1)
})

test('every drawn member gets its own stem up to the beam', async ({ score }) => {
  const drawn = await score.evaluate(async () => {
    const h = window.__h
    const note = h.engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'h', measure: 1, beat: h.frac(0, 1) })
    h.engine.setFan(note!.id, { direction: 'accel', count: 6, beams: 3 })
    await h.render()
    // Vertical lines inside the fan group: the prefix stems the fan draws for the members it
    // invents (the first member is the REAL StaveNote and keeps its own stem, outside the group).
    const vertical = h.segments('g.vf-fan path').filter(s => Math.abs(s.x1 - s.x2) < 0.01)
    return { vertical, ownStem: h.stems(), heads: h.noteheads(), ramps: h.quads('g.vf-fan path') }
  })

  expect(drawn.ownStem, 'the real note keeps its own stem').toHaveLength(1)
  expect(drawn.vertical, 'and the five invented members get theirs').toHaveLength(5)
  const beamTop = Math.min(...drawn.ramps.flatMap(r => [r.yLeft, r.yRight]))
  for (const stem of drawn.vertical) {
    expect(stem.y1, 'each stem starts at its notehead').toBeCloseTo(drawn.heads[0].y, 1)
    expect(Math.min(stem.y1, stem.y2), 'and reaches the beam').toBeLessThanOrEqual(beamTop + 2)
  }
})

test('the number of beam lines is the number asked for', async ({ score }) => {
  const drawn = await score.evaluate(async () => {
    const h = window.__h
    const note = h.engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'h', measure: 1, beat: h.frac(0, 1) })
    h.engine.setFan(note!.id, { direction: 'accel', count: 4, beams: 2 })
    await h.render()
    return { ramps: h.quads('g.vf-fan path'), heads: h.noteheads() }
  })

  expect(drawn.heads).toHaveLength(4)
  expect(drawn.ramps).toHaveLength(2)
  expect(linesAt(drawn.ramps.map(r => r.yRight)), 'two lines at the fast end').toBe(2)
})
