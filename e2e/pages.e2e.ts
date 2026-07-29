import { test, expect } from './fixtures'

/**
 * PAGES — the vertical casting-off (docs/layout-plan.md P1).
 *
 * Invisible to the unit suite for the same reason the horizontal one is: which system lands on
 * which page depends on how tall a drawn system actually is, and in jsdom every glyph measures 0×0.
 * `pageCastOff.test.ts` states the arithmetic; this states that the music lands on the paper.
 */

/**
 * Enough eighths to fill several systems.
 *
 * ⚠️ 45, not 30 — measured: bars this wide cast off ~3 to a system, and A4's text block holds
 * exactly 10 systems at the 150 px stride, so 30 bars land on ONE page and every claim about page
 * breaks passes vacuously.
 */
async function manyBars(score: import('@playwright/test').Page, bars = 45): Promise<void> {
  await score.evaluate(async (count: number) => {
    const h = window.__h
    while (h.engine.getScore().measures.length < count) h.engine.addMeasure()
    for (let measure = 1; measure <= count; measure++) {
      for (let eighth = 0; eighth < 8; eighth++) {
        h.engine.addNoteAtBeat({ step: 'C', octave: 4, duration: '8', measure, beat: h.frac(eighth, 2) })
      }
    }
    await h.render()
  }, bars)
}

test('the canvas draws no paper at all, and the page draws a sheet per page', async ({ score }) => {
  await manyBars(score)

  // The sketching surface is what the editor has always been: one endless strip, no sheet.
  expect(await score.evaluate(() => window.__h.pages()), 'no layout ⇒ no pages').toHaveLength(0)

  const pages = await score.evaluate(async () => {
    window.__h.useLayout(true)
    await window.__h.render()
    return window.__h.pages()
  })

  expect(pages.length, '45 bars of eighths take more than one A4 page').toBeGreaterThan(1)
  // A4 at 1 staff space = 1.75 mm: 210 × 297 mm.
  for (const page of pages) {
    expect(page.width).toBeCloseTo(1200, 0)
    expect(page.height).toBeCloseTo(1697, 0)
  }
  // ⭐ SIDE BY SIDE — Sibelius's spread, not a roll of paper: same top edge, each sheet clear of
  // the one before it with a gutter between.
  for (const page of pages) expect(page.y, 'every sheet shares one top edge').toBe(pages[0].y)
  for (const [i, page] of pages.slice(1).entries()) {
    expect(page.x, 'each sheet begins to the right of the one before it')
      .toBeGreaterThan(pages[i].x + pages[i].width)
  }
})

test('every system lands on a sheet, inside its margins', async ({ score }) => {
  await manyBars(score)
  const { pages, staves } = await score.evaluate(async () => {
    window.__h.useLayout(true)
    await window.__h.render()
    return { pages: window.__h.pages(), staves: window.__h.staves() }
  })

  const tops = [...new Set(staves.map(s => s.top))].sort((a, b) => a - b)
  expect(tops.length, 'several systems').toBeGreaterThan(1)

  // 15 mm margins at 5.714 px/mm ≈ 86 px.
  const MARGIN = 15 * (10 / 1.75)
  // Every bar sits on a sheet — horizontally too, which is the whole of the side-by-side change:
  // a system on the second page starts a page-and-a-gutter to the right, not under the first.
  for (const bar of staves) {
    const page = pages.find(p => bar.x1 >= p.x - 1 && bar.x2 <= p.x + p.width + 1)
    expect(page, `bar ${bar.measure} is on a sheet, not in the gutter between two`).toBeTruthy()
    expect(bar.x1 - page!.x, 'and inside that sheet’s own left margin').toBeGreaterThanOrEqual(MARGIN - 1)
    expect(bar.top - page!.y, 'and below its top margin').toBeGreaterThanOrEqual(MARGIN - 1)
  }

  // The first system of each page starts at that page's top margin — a page break is a fresh start,
  // not a running total carried over from the page before.
  const firstOnEachPage = pages.map(p => Math.min(
    ...staves.filter(b => b.x1 >= p.x - 1 && b.x2 <= p.x + p.width + 1).map(b => b.top),
  ))
  for (const top of firstOnEachPage) expect(top).toBeCloseTo(firstOnEachPage[0], 1)
})

test('the SVG grows to the stacked sheets, so the viewport can scroll through them', async ({ score }) => {
  await manyBars(score)
  const { size, pages } = await score.evaluate(async () => {
    window.__h.useLayout(true)
    await window.__h.render()
    return { size: window.__h.svgSize(), pages: window.__h.pages() }
  })

  const last = pages[pages.length - 1]
  expect(size.width, 'the SVG reaches the right edge of the last sheet').toBeCloseTo(last.x + last.width, 0)
  expect(size.height, 'and is exactly one sheet tall — the pages are beside each other')
    .toBeCloseTo(pages[0].height, 0)
})

test('linear view ignores the layout — it is a canvas, and a canvas has no pages', async ({ score }) => {
  await manyBars(score, 8)
  const linear = await score.evaluate(async () => {
    const h = window.__h
    h.useLayout(true)
    h.engine.setViewMode('linear')
    await h.render()
    return { pages: h.pages(), size: h.svgSize() }
  })

  expect(linear.pages, 'no sheets in linear view, however the layout is set').toHaveLength(0)
  // And the width floor is still the canvas's 1000, not A4's 1200 — the leak P1.5 exists to stop.
  expect(linear.size.width).toBeGreaterThanOrEqual(1000)
  expect(linear.size.width).not.toBeCloseTo(1200, 0)
})
