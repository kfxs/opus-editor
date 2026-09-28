import { test, expect } from './fixtures'

/**
 * ⭐ **THE FLAG'S HIT BOX, CHECKED AGAINST THE PAGE** (his ask, 2026-09-28: the flag as its own selectable element).
 *
 * `engine/rendering/stemInk` files the flag's box from the point its draw wrote back
 * (`EngravedFlag.getBoundingBox`) — a MEASURED glyph, which is 0 wide in jsdom, so only a browser can say
 * whether the box sits on the ink. These assert the RELATION between the registry's box and the page's
 * `g.flag`, ⛔ not equality: `getBBox()` on a `<text>` is the font's LINE box (`e2e/accidentalHitBox.e2e.ts`).
 */
async function eighth(score: import('@playwright/test').Page, octave: number) {
  return score.evaluate(async (octave) => {
    const h = window.__h
    const note = h.engine.addNoteAtBeat({ step: 'G', octave, duration: '8', measure: 1, beat: h.frac(0, 1) } as never)!
    await h.render()
    const registry = h.engine.getElementRegistry()
    const entry = registry.getByType('noteFlag').find(e => e.noteId === note.id)
    const stem = registry.getByType('stem').find(e => e.noteId === note.id)!
    const page = document.querySelector<SVGGElement>('svg g.flag')!.getBBox()
    return {
      box: entry?.bbox ?? null,
      stem: stem.bbox,
      page: { x: page.x, y: page.y, width: page.width, height: page.height },
    }
  }, octave)
}

for (const [label, octave] of [['stem UP', 4], ['stem DOWN', 5]] as const) {
  test(`⭐ ${label}: the flag is registered, and its box sits ON the drawn flag`, async ({ score }) => {
    const { box, page } = await eighth(score, octave)
    expect(box, 'an unbeamed eighth registers its flag').not.toBeNull()
    expect(box!.x).toBeGreaterThan(page.x - 1.5)
    expect(box!.x + box!.width).toBeLessThan(page.x + page.width + 1.5)
    expect(box!.y).toBeGreaterThan(page.y - 1.5)
    expect(box!.y + box!.height).toBeLessThan(page.y + page.height + 1.5)
    // 🚨 The break-test: a box of nothing would pass every containment above.
    expect(box!.width).toBeGreaterThan(5)
    expect(box!.height).toBeGreaterThan(15)
  })

  test(`${label}: the flag hangs from the stem's TIP — the two boxes meet there`, async ({ score }) => {
    const { box, stem } = await eighth(score, octave)
    const tipY = octave === 4 ? stem.y : stem.y + stem.height
    expect(tipY).toBeGreaterThanOrEqual(box!.y - 1.5)
    expect(tipY).toBeLessThanOrEqual(box!.y + box!.height + 1.5)
    expect(Math.abs(box!.x - stem.x)).toBeLessThan(2)
  })
}

test('a BEAMED eighth draws no flag and registers none', async ({ score }) => {
  const count = await score.evaluate(async () => {
    const h = window.__h
    for (let i = 0; i < 2; i++) h.engine.addNoteAtBeat({ step: 'G', octave: 4, duration: '8', measure: 1, beat: h.frac(i, 2) } as never)
    await h.render()
    return h.engine.getElementRegistry().getByType('noteFlag').length
  })
  expect(count).toBe(0)
})
