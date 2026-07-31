import { test, expect } from './fixtures'

/**
 * ⭐ **A press may only reach ink** — `ElementRegistry.painted`.
 *
 * Here rather than in the unit suite because the whole defect lives in the gap between two things
 * only a real render has: tier 1 registers hit-boxes for **every bar in the score**, and tier 2
 * paints only the ones inside the cull window. In jsdom nothing is culled because nothing is drawn,
 * so this cannot even be set up there.
 *
 * Reported from use: *"the selection is in a hidden barline and is not possible to move it"* — a
 * culled bar's barline box answered the press, the bar-width drag then found no drawn columns to
 * measure its room from, and declined in silence.
 */

/** Sixty-four empty bars, then a window over the middle of them — a scrolled editor, in one call. */
async function scrolledScore(score: import('@playwright/test').Page) {
  return score.evaluate(async () => {
    const h = window.__h
    while (h.engine.getScore().measures.length < 64) h.engine.addMeasure()
    await h.render()

    const svg = document.querySelector('svg')!
    const height = parseFloat(svg.getAttribute('height')!)
    h.engine.setVisibleRect({ x: 0, y: height * 0.35, width: 1200, height: 400 })
    await h.render()

    const registry = h.engine.getElementRegistry()
    const bars = []
    for (let bar = 1; bar <= 64; bar++) {
      bars.push({
        bar,
        painted: registry.isPainted(bar, 0),
        hasBox: registry.getByType('barline').some(el => el.measure === bar),
        canDrag: h.engine.barWidthRoom(bar) !== null,
        drawn: !!document.querySelector(`g#vf-m${bar}-s0`),
      })
    }
    return bars
  })
}

test('a bar outside the window keeps its hit-box and loses its ink — the two must not be confused', async ({ score }) => {
  const bars = await scrolledScore(score)

  const culled = bars.filter(b => !b.drawn)
  const painted = bars.filter(b => b.drawn)
  expect(culled.length, 'the window really did cull some bars').toBeGreaterThan(0)
  expect(painted.length, 'and really did paint others').toBeGreaterThan(0)

  // The asymmetry itself, stated: box yes, ink no. This is not a bug to fix — off-screen boxes are
  // what keep pixel↔position honest — it is the fact every hit-test has to know about.
  for (const bar of culled) {
    expect(bar.hasBox, `bar ${bar.bar} is culled but still registers a barline box`).toBe(true)
    expect(bar.painted, `bar ${bar.bar} is culled, so it is not painted`).toBe(false)
  }
  for (const bar of painted) {
    expect(bar.painted, `bar ${bar.bar} is drawn, so it is painted`).toBe(true)
  }
})

test('the drag refuses exactly the bars that are not painted — never a visible one', async ({ score }) => {
  const bars = await scrolledScore(score)
  // The silent refusal he hit: `barWidthRoom` measures room from DRAWN columns, and a culled bar has
  // none. Pinning it against `painted` is what makes "selectable but immovable" impossible: if a bar
  // can be reached, its room can be measured.
  for (const bar of bars) {
    expect(bar.canDrag, `bar ${bar.bar}: draggable iff painted`).toBe(bar.painted)
  }
})
