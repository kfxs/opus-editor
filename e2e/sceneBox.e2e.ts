import { test, expect } from './fixtures'

/**
 * ⭐⭐ **P6a — OUR RULER, CHECKED AGAINST THE PAGE.**
 *
 * `engine/scene/sceneBox` computes a box from what was DRAWN — arithmetic over the scene, no DOM,
 * no reflow, and it answers in jsdom. `sceneBox.test.ts` proves the arithmetic; **this file proves
 * the arithmetic is about the real page**, by rendering in a browser and asking the SVG itself.
 *
 * ## ⭐⭐ THE THREE COMPARISONS ARE NOT THE SAME KIND, and running them found all three
 *
 * ⛔ *"Our box equals `getBBox()`"* is FALSE, and each way it is false is a fact worth owning:
 *
 * | family | what `getBBox()` gives | what ours gives | the relation |
 * |---|---|---|---|
 * | a FILLED rect (barline) | the rect **as the DOM now holds it** | the rect **as it was drawn** | ⚠️ they differ by the PIXEL HINT |
 * | a STROKED path (stem, tie) | the GEOMETRY — ⛔ a zero-width line for a stem | the INK, half a pen wider on every side | ours = theirs + `lineWidth` |
 * | a glyph (`<text>`) | the FONT'S LINE BOX — ~160 px tall for a notehead | the glyph's own outline | ours ⊂ theirs, by a lot |
 *
 * 🚨 **Row 1 is a finding.** `rendering/barlineInk.hintBarlines` is a POST-PASS that snaps a
 * barline's rect onto whole device pixels for crispness: we DRAW 1.6 px and the page CARRIES 2.
 * Both are true — of different moments — and the scene records the first. ⭐ It is the same shape as
 * the `inkBarlines` repair P5b deleted, except this one is deliberate and still there, so the ruler
 * is asserted against the drawn number ±1 device pixel rather than against the page's exactly.
 *
 * 🚨 **Row 2 is the one that would have been asserted wrong.** A stem is a STROKED line, so the
 * page's own box for it is **0 px wide** — and a ruler that agreed with that would report a stem as
 * having no width at all. ⭐ Ours reports the pen, which is the ink you can see.
 *
 * ⚠️ **Row 3 is the instrument**, not us: `getBBox()` on a `<text>` is the text layout box, which is
 * why this repo's readers parse the drawing's own numbers instead (`e2e/harness.ts`'s header) and
 * why `e2e/headerGap.e2e.ts` had to be rewritten around the same error. A glyph is asserted as
 * CONTAINED, ⛔ never equal.
 */

/** Render, keep the drawing, and hand back both rulers' answers for one group class. */
async function compare(score: import('@playwright/test').Page, cls: string) {
  return score.evaluate(async (cls) => {
    const h = window.__h
    // Four bars of notes, plus a tie so the curve family has something to measure.
    const beat = (n: number) => h.frac(n, 1)
    let first: { id: string } | null = null
    for (const bar of [1, 2]) {
      if (h.engine.getScore().measures.length < bar) h.engine.addMeasure()
      const added = h.engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'q', measure: bar, beat: beat(0) } as never)
      first ??= added
      h.engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'q', measure: bar, beat: beat(1) } as never)
      h.engine.addNoteAtBeat({ step: 'E', octave: 4, duration: '8', measure: bar, beat: beat(2) } as never)
      h.engine.addNoteAtBeat({ step: 'G', octave: 4, duration: '8', measure: bar, beat: beat(5 / 2) } as never)
    }
    if (first) h.engine.toggleTie(first.id)
    await h.render()

    // ⚠️ `recordFullScene`, ⛔ not `recordScene(() => renderScore())`: an unchanged score REUSES its
    // measures, and a reused bar draws nothing — so the plain form records a nearly empty scene.
    const scene = h.engine.recordFullScene()
    const svg = document.querySelector('svg')!

    const rows: { id: string; ours: DOMRectLike; page: DOMRectLike; strokePx: number }[] = []
    for (const node of h.walkScene(scene)) {
      if (node.kind !== 'group' || node.cls !== cls || !node.id) continue
      const ours = h.drawnInkBox({ ...node, placement: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 } })
      const el = svg.querySelector(`[id="${node.id}"]`) as SVGGraphicsElement | null
      if (!ours || !el) continue
      const page = el.getBBox()
      // The widest pen any child of this group was stroked with — what `getBBox()` leaves out.
      let strokePx = 0
      for (const child of node.children) {
        if (child.kind === 'path' && child.painted !== 'fill') {
          strokePx = Math.max(strokePx, child.style.lineWidth ?? 1)
        }
      }
      rows.push({
        id: node.id, strokePx,
        ours: { x: ours.x, y: ours.y, width: ours.width, height: ours.height },
        page: { x: page.x, y: page.y, width: page.width, height: page.height },
      })
    }
    return rows
  }, cls)
}

interface DOMRectLike { x: number; y: number; width: number; height: number }

test('⭐⭐ a BARLINE: our box is where the page has it — the y and the height EXACTLY', async ({ score }) => {
  const rows = await compare(score, 'stavebarline')
  expect(rows.length, 'barlines were drawn and matched to their groups').toBeGreaterThan(1)
  for (const { id, ours, page } of rows) {
    // ⭐ The vertical is untouched by hinting, so it must land on the page's own number to the
    // decimal. This is the assertion that says the ruler is real rather than self-consistent.
    expect(ours.y, `${id} y`).toBeCloseTo(page.y, 3)
    expect(ours.height, `${id} height`).toBeCloseTo(page.height, 3)
    expect(ours.x, `${id} x`).toBeCloseTo(page.x, 3)
    // ⚠️ …and the WIDTH is the drawn 1.6 against the page's hinted 2 — see the header. ⛔ Asserting
    // equality here would be asserting that the hint does not happen.
    expect(Math.abs(ours.width - page.width), `${id} width, within the pixel hint`).toBeLessThanOrEqual(1)
  }
})

test('⭐⭐ a STEM: the page says a stroked line is 0 px WIDE — ours says it is a stem', async ({ score }) => {
  const rows = await compare(score, 'stem')
  expect(rows.length, 'stems were drawn').toBeGreaterThan(0)
  for (const { id, ours, page, strokePx } of rows) {
    expect(strokePx, `${id} is a stroked path`).toBeGreaterThan(0)
    expect(page.width, `${id} — the page's own box for a line has NO width`).toBeCloseTo(0, 6)
    // ⭐ Ours is the geometry grown by half the pen on every side: the ink a reader can see.
    // ⚠️ Three decimals, ⛔ not six: `getBBox()` answers in float32 (40.95 comes back as
    // 40.95000076…), so a tighter tolerance would be asserting the browser's mantissa.
    expect(ours.width, `${id} width = the pen`).toBeCloseTo(strokePx, 3)
    expect(ours.x, `${id} left`).toBeCloseTo(page.x - strokePx / 2, 3)
    expect(ours.height, `${id} height`).toBeCloseTo(page.height + strokePx, 3)
  }
})

test('⭐⭐ a TIE: ours is the page’s geometry grown by HALF THE PEN — ⛔ `getBBox()` omits the stroke', async ({ score }) => {
  const rows = await compare(score, 'tie')
  expect(rows.length, 'a tie was drawn').toBeGreaterThan(0)
  for (const { id, ours, page, strokePx } of rows) {
    expect(strokePx, `${id} was stroked`).toBeGreaterThan(0)
    const pen = strokePx / 2
    // ⭐ The cubic's true extrema AND the pen, both, checked against the browser's own curve maths.
    expect(ours.x, `${id} left`).toBeCloseTo(page.x - pen, 2)
    expect(ours.y, `${id} top`).toBeCloseTo(page.y - pen, 2)
    expect(ours.width, `${id} width`).toBeCloseTo(page.width + strokePx, 2)
    expect(ours.height, `${id} height`).toBeCloseTo(page.height + strokePx, 2)
  }
})

test('⭐⭐ a NOTEHEAD: the font’s outline sits INSIDE the page’s text box — ⛔ and is nothing like it', async ({ score }) => {
  const rows = await compare(score, 'notehead')
  expect(rows.length, 'noteheads were drawn').toBeGreaterThan(1)
  for (const { id, ours, page } of rows) {
    // ⭐ Containment on the axis that means anything: the ink starts at or after the text box's
    // left edge and ends at or before its right.
    expect(ours.x, `${id} starts inside`).toBeGreaterThanOrEqual(page.x - 0.01)
    expect(ours.x + ours.width, `${id} ends inside`).toBeLessThanOrEqual(page.x + page.width + 0.01)
    expect(ours.width, `${id} is about a notehead wide`).toBeGreaterThan(0)
    // 🚨 The point of the row, as an assertion: the page's box is the FONT'S LINE, several times the
    // glyph. ⛔ This is why a hit box built from it was never the ink, and why `noteInkBox` exists.
    expect(page.height, `${id} — the page reports a whole line box`).toBeGreaterThan(ours.height * 3)
  }
})

// 🚨 The break-test for all four: a helper that matched nothing would make every `for` loop above
// pass without asserting anything at all.
test('🚨 the break-test — the comparison really did find groups on both sides', async ({ score }) => {
  const barlines = await compare(score, 'stavebarline')
  const noteheads = await compare(score, 'notehead')
  const nothing = await compare(score, 'no-such-class')
  expect(barlines.length).toBeGreaterThan(1)
  expect(noteheads.length).toBeGreaterThan(1)
  expect(nothing, 'and it answers empty for a class nobody draws').toHaveLength(0)
})
