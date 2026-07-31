import { test, expect } from './fixtures'

/**
 * How a barline is inked, and where that ink lands (`src/engine/rendering/barlineInk.ts`).
 *
 * Here rather than in the unit suite because both answers depend on a real drawing: VexFlow writes
 * its 1px literal deep inside `Stave.draw`, and hinting reads `getScreenCTM()`, which in jsdom is
 * not implemented at all. A unit test can check the arithmetic in isolation (it does, beside the
 * module); only a render can say that every barline on a real page came out the same.
 */

/** The harness draws at 1:1 with `devicePixelRatio` 1, so a device pixel is an SVG unit. */
async function tenBars(score: import('@playwright/test').Page) {
  return score.evaluate(async () => {
    const h = window.__h
    while (h.engine.getScore().measures.length < 10) h.engine.addMeasure()
    await h.render()
    return h.barlines()
  })
}

test('every barline lands on a whole pixel, at one width — none of them straddle two', async ({ score }) => {
  const barlines = await tenBars(score)
  expect(barlines.length, 'the bars drew their barlines').toBeGreaterThan(1)

  // A final/repeat bar's THICK line is left at VexFlow's 3px (a layout change, not an ink one —
  // see the module). Everything else is the thin barline, and after hinting they are identical.
  const thin = barlines.filter(b => b.width < 3)
  expect(thin.length, 'most barlines are thin ones').toBeGreaterThan(1)
  const widths = new Set(thin.map(b => b.width))
  expect([...widths], 'every thin barline is the SAME width — this is the whole point').toHaveLength(1)
  for (const bar of thin) {
    expect(bar.inkX, `the ink at x=${bar.x} sits on a whole pixel`).toBe(Math.round(bar.inkX))
    expect(bar.width, 'a whole number of pixels wide').toBe(Math.round(bar.width))
    expect(bar.width, 'and at least one pixel — a barline may never round away').toBeGreaterThanOrEqual(1)
    // Hinting moves the INK, never the barline: it may not wander off its own boundary.
    expect(Math.abs(bar.inkX - bar.x), 'and it stays within half a pixel of the boundary').toBeLessThanOrEqual(0.5)
  }
})

test('a barline is heavier than the stems and staff lines it divides', async ({ score }) => {
  const ink = await score.evaluate(async () => {
    const h = window.__h
    h.engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: h.frac(0, 1) })
    await h.render()
    const stem = document.querySelector<SVGPathElement>('g.vf-stem path')
    return {
      barline: h.barlines()[0].width,
      stem: stem ? parseFloat(getComputedStyle(stem).strokeWidth) : NaN,
    }
  })

  // 0.16 staff spaces asked for, 2 device px once hinted at 1:1; a stem is 1.5 and a staff line 1.
  // That is the order engraving puts them in, and the order they were NOT in before this module.
  expect(ink.barline, 'a barline outweighs a stem').toBeGreaterThan(ink.stem)
  expect(ink.stem, 'and a stem outweighs a staff line').toBeGreaterThan(1)
})

test('one boundary is ONE line: no bar draws a barline its neighbour already drew', async ({ score }) => {
  const counts = await score.evaluate(async () => {
    const h = window.__h
    while (h.engine.getScore().measures.length < 6) h.engine.addMeasure()
    await h.render()
    const at = new Map<string, number>()
    for (const r of document.querySelectorAll<SVGRectElement>('g.vf-stavebarline rect')) {
      // Group by (x, y): two systems' opening barlines share an x at different heights, and those
      // are two different lines, not a duplicate.
      const key = `${r.getAttribute('x')}@${r.getAttribute('y')}`
      at.set(key, (at.get(key) ?? 0) + 1)
    }
    return [...at.values()]
  })

  expect(counts.length, 'barlines were drawn').toBeGreaterThan(1)
  // Before this rule every interior boundary was drawn twice — bar N's end and bar N+1's begin, on
  // top of each other — and the doubled anti-aliasing made those lines visibly heavier than the one
  // opening or closing a system.
  expect(Math.max(...counts), 'no boundary is drawn twice').toBe(1)
})
