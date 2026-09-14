import { test, expect } from './fixtures'

/**
 * ⭐⭐ **P6b — THE ACCIDENTAL'S HIT BOX, CHECKED AGAINST THE PAGE** (`docs/own-engraving-engine.md`
 * §5 P6).
 *
 * `drawnHitBox.test.ts` proves the box is the glyph's own outline, in jsdom — which is the whole
 * point of computing it. ⚠️ **But jsdom cannot check the half that matters most for a CLICK**: the
 * sign's PLACE still comes from `accidentalOriginX(start.x, getWidth())`, and `getWidth()` is a
 * runtime `measureText` that answers **0** without a font. So a page-less test draws the sharp with
 * its left edge on the note's modifier-start point, and only a browser knows where it really goes.
 *
 * ⇒ these assert the RELATION between the box the registry files and the ink the page actually
 * carries. ⛔ Not equality: `getBBox()` on a `<text>` is the FONT'S LINE BOX, over three times the
 * glyph (`e2e/sceneBox.e2e.ts` row 3, and the reason `noteInkBox` exists).
 */

/** One bar with an F♯, rendered; the registry's box for the sign and the page's box for its group. */
async function sharp(score: import('@playwright/test').Page) {
  return score.evaluate(async () => {
    const h = window.__h
    const note = h.engine.addNoteAtBeat({
      step: 'F', octave: 4, alter: 1, duration: 'q', measure: 1, beat: h.frac(0, 1),
    } as never)!
    await h.render()

    const entry = h.engine.getElementRegistry().getByType('accidental')
      .find(e => e.noteId === note.id)!
    // ⭐ The group the ink opens is named for the REGISTRY's kind and carries the sign's own id —
    //   the seam this whole step is built on (`engrave/notes/accidental`).
    const group = document.querySelector<SVGGElement>('svg .vf-accidental')!
    const page = group.getBBox()
    return {
      box: entry.bbox,
      page: { x: page.x, y: page.y, width: page.width, height: page.height },
    }
  })
}

test('⭐⭐ the hit box sits ON the sign’s drawn ink — the page agrees about WHERE', async ({ score }) => {
  const { box, page } = await sharp(score)
  // ⚠️ ±1 px each side: the browser's reader reports whole device pixels. (It also used to inflate
  // a glyph by about a pixel per side — that was VexFlow's embedded Bravura build, gone since S1.)
  expect(box.x).toBeGreaterThan(page.x - 1.5)
  expect(box.x + box.width).toBeLessThan(page.x + page.width + 1.5)
  expect(box.y, 'and the ink sits inside the line box vertically').toBeGreaterThan(page.y - 1.5)
  expect(box.y + box.height).toBeLessThan(page.y + page.height + 1.5)
})

test('⭐⭐ …and it is TIGHTER than the page’s — a line box is not a hit target', async ({ score }) => {
  const { box, page } = await sharp(score)
  // The sharp's own outline is 2.79 staff-spaces; Bravura's line box at that size is far taller.
  expect(box.height).toBeLessThan(page.height * 0.6)
  // 🚨 The break-test: a box of nothing would pass every containment assertion above.
  expect(box.height).toBeGreaterThan(20)
  expect(box.width).toBeGreaterThan(5)
})

/**
 * 🚨🚨 **THE HIGHLIGHT READS THIS BOX'S CENTRE**, and that is a coupling nothing asserted until the
 * box changed hands. `HighlightController.applyAccidentalHighlight` finds the glyph to recolour by
 * walking every `<text>` in the SVG and matching centres — `|Δx| < 1.0` and `|Δy| < height/2 + 1`.
 *
 * ⚠️ The y tolerance is **derived from the box itself**, so a tighter box is also a stricter match:
 * it went from ±80 px (the font's line box) to ±15 (the sign's ink). ⭐ That is the right direction —
 * the method's own comment says *"an X-only match paints every glyph in the accidental column"* — but
 * it means the two rulers have to agree about the CENTRE, which is what this pins.
 */
test('🚨🚨 its CENTRE still finds the glyph — what the accidental highlight matches on', async ({ score }) => {
  const { box, page } = await sharp(score)
  expect(Math.abs((box.x + box.width / 2) - (page.x + page.width / 2)), 'x, within the 1 px the highlight allows')
    .toBeLessThan(1)
  expect(Math.abs((box.y + box.height / 2) - (page.y + page.height / 2)), 'y, within its own half-height')
    .toBeLessThan(box.height / 2 + 1)
})

test('🚨 the sign is placed LEFT of its note here — what jsdom cannot see', async ({ score }) => {
  const left = await score.evaluate(async () => {
    const h = window.__h
    const note = h.engine.addNoteAtBeat({
      step: 'F', octave: 4, alter: 1, duration: 'q', measure: 1, beat: h.frac(0, 1),
    } as never)!
    await h.render()
    const reg = h.engine.getElementRegistry()
    const acc = reg.getByType('accidental').find(e => e.noteId === note.id)!
    const head = reg.getAll().find(e => e.type === 'note' && e.id === note.id)!
    return { accRight: acc.bbox.x + acc.bbox.width, headX: head.headX ?? head.bbox.x }
  })
  // ⭐ In jsdom `getWidth()` is 0 and the sign collapses onto the note's modifier-start point; in a
  //   browser it hangs clear to the left of the head. That difference is exactly why this file is
  //   in the browser suite and the size assertions are not.
  expect(left.accRight).toBeLessThan(left.headX)
})
