import { test, expect } from './fixtures'

/**
 * ⭐ **TWO VOICES ON THE BENT STAFF SHARE ONE COLUMN** — `docs/plans/bent-staff-plan.md` §5 row 11,
 * `rendering/eye/spineScore`'s shared pass. A column's accidentals are stacked over EVERY voice at that beat,
 * as on the page; formatted note by note, two voices' sharps a second apart stood on top of each other.
 * Geometry, so the browser: jsdom measures every glyph 0 wide.
 */
test('two voices a second apart, both sharp: their accidentals do not overlap on the spine', async ({ score }) => {
  const out = await score.evaluate(async () => {
    const h = window.__h
    h.engine.addNoteAtBeat({ step: 'A', alter: 1, octave: 4, duration: 'q', measure: 1, beat: h.frac(0, 1) })
    h.engine.addNoteAtBeat({ step: 'G', alter: 1, octave: 4, duration: 'q', measure: 1, beat: h.frac(0, 1), voice: 1 })
    await h.render()
    const boxes = (root: Element) => [...root.querySelectorAll('g.accidental')].map(g => {
      const r = g.getBoundingClientRect()
      return { left: r.left, right: r.right }
    }).sort((a, b) => a.left - b.left)
    const page = boxes(document.querySelector('svg')!)
    h.drawSpine(0)
    return { page, spine: boxes(document.querySelector('#spine svg')!) }
  })
  expect(out.page, 'the page draws both sharps').toHaveLength(2)
  expect(out.spine, 'the spine draws both sharps').toHaveLength(2)
  expect(out.page[0].right, 'the page stacks them side by side').toBeLessThanOrEqual(out.page[1].left + 0.5)
  expect(out.spine[0].right, 'so does the spine — one column over both voices').toBeLessThanOrEqual(out.spine[1].left + 0.5)
})
