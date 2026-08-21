import { test, expect } from './fixtures'

/**
 * THE DYNAMICS LINE — every dynamic-family mark of one (system, staff, placement) on one baseline
 * (docs/dynamics-line-and-hairpins-plan.md P1).
 *
 * ⚠️ **This suite has to be here and cannot be a unit test.** Every claim below is about where ink
 * landed, and the marks are text: in jsdom a glyph measures 0×0 and a `<text>` has no metrics, so
 * the same assertions would agree with themselves. The line's arithmetic is unit-tested separately
 * (`engine/layout/dynamicsLine.test.ts`); what is checked here is that the DRAWING obeys it.
 *
 * ⚠️ Read through `placed`, never a raw `y` attribute: the pass writes a `translate` on the mark's
 * own group, and a reused bar carries another on its measure group — the composed CTM is the only
 * honest reading (docs/e2e-geometry-net, "COMPOSE THE CTM").
 */

/** Every dynamic mark as drawn, left to right — its baseline point, composed through the CTM. */
const marksOf = (score: import('@playwright/test').Page) =>
  score.evaluate(() => window.__h.placed('g.vf-annotation text'))

/** The first staff as drawn: its two outer lines, and what one staff space measures. */
const staffOf = (score: import('@playwright/test').Page) =>
  score.evaluate(() => {
    const first = window.__h.staves()[0]
    return { top: first.top, bottom: first.bottom, spacing: (first.bottom - first.top) / 4 }
  })

test('⭐⭐ two marks under notes an octave apart share ONE baseline', async ({ score }) => {
  await score.evaluate(async () => {
    const h = window.__h
    // Bar 1: a high note and a low note, a `p` under each. VexFlow hangs an annotation off its own
    // note's lowest point, so before the line these came out at two different heights.
    h.engine.addNoteAtBeat({ step: 'G', octave: 5, duration: 'h', measure: 1, beat: h.frac(0, 1) })
    h.engine.addNoteAtBeat({ step: 'D', octave: 4, duration: 'h', measure: 1, beat: h.frac(2, 1) })
    h.engine.addDynamic(1, { beat: h.frac(0, 1), text: 'p' })
    h.engine.addDynamic(1, { beat: h.frac(2, 1), text: 'f' })
    await h.render()
  })

  const marks = await marksOf(score)
  expect(marks.length, 'both marks drawn').toBe(2)
  expect(marks[1].y).toBeCloseTo(marks[0].y, 1)
})

test('⭐ a high passage puts its mark OUTSIDE the staff — the defect the line fixes', async ({ score }) => {
  await score.evaluate(async () => {
    const h = window.__h
    // Every note above the staff. VexFlow would hang the mark a fixed distance under the notehead,
    // which for these lands INSIDE the five lines.
    for (const beat of [0, 1, 2, 3]) {
      h.engine.addNoteAtBeat({ step: 'A', octave: 5, duration: 'q', measure: 1, beat: h.frac(beat, 1) })
    }
    h.engine.addDynamic(1, { beat: h.frac(0, 1), text: 'mf' })
    await h.render()
  })

  const [mark] = await marksOf(score)
  const staff = await staffOf(score)
  // ⚠️ Not merely "below the staff" — VexFlow's own placement clears the bottom line here too, via
  // the down-stem branch, so a loose bound passes without the feature. The claim is the RULE: with
  // nothing hanging below an ordinary stem, the line sits at the floor (2.1 spaces, one stem's
  // worth) and the baseline a glyph's ink-above (2.72) under that — `engine/layout/dynamicsLine.ts`.
  // 🚨 It was 4.14 until 2026-08-21: the ink table read the glyph size as PIXELS where VexFlow draws
  // it in POINTS, so every mark's ink was modelled a quarter too small (`rendering/drawnFontSize`).
  // ⚠️ Within a pixel, not to the pixel: the drawn stave line sits half a pixel off the model's own
  // (`reference_thin_lines_need_half_pixel_offset`), so `staff.bottom` is that much lower than the
  // `getYForLine(4)` the line is measured from.
  expect(Math.abs(mark.y - staff.bottom - 4.77 * staff.spacing)).toBeLessThan(1)
})

test('⭐⭐ a low note in a LATER bar leaves the earlier bar\'s mark where it was', async ({ score }) => {
  const before = await score.evaluate(async () => {
    const h = window.__h
    h.engine.addMeasure()
    h.engine.addNoteAtBeat({ step: 'B', octave: 4, duration: 'w', measure: 1, beat: h.frac(0, 1) })
    h.engine.addNoteAtBeat({ step: 'B', octave: 4, duration: 'w', measure: 2, beat: h.frac(0, 1) })
    h.engine.addDynamic(1, { beat: h.frac(0, 1), text: 'p' })
    await h.render()
    return window.__h.placed('g.vf-annotation text')[0].y
  })

  const after = await score.evaluate(async () => {
    const h = window.__h
    // Bar 2 dives three ledger lines below the staff. Bar 1 is untouched, and so is its `p`: a mark
    // clears the ink UNDER IT, not the system's lowest, so the dip moves nothing but its own bar's
    // marks (of which there are none here).
    h.engine.updateNote(h.engine.getScore().measures[1].slots[0].notes[0].id, { step: 'A', octave: 2 })
    await h.render()
    return window.__h.placed('g.vf-annotation text')[0].y
  })

  expect(after).toBeCloseTo(before, 3)
})

test('⭐ …but a mark standing OVER the dip deviates, alone', async ({ score }) => {
  const marks = await score.evaluate(async () => {
    const h = window.__h
    // One bar: an ordinary note on beat 0, three ledger lines down on beat 2, a mark on each.
    h.engine.addNoteAtBeat({ step: 'B', octave: 4, duration: 'h', measure: 1, beat: h.frac(0, 1) })
    h.engine.addNoteAtBeat({ step: 'A', octave: 2, duration: 'h', measure: 1, beat: h.frac(2, 1) })
    h.engine.addDynamic(1, { beat: h.frac(0, 1), text: 'p' })
    h.engine.addDynamic(1, { beat: h.frac(2, 1), text: 'f' })
    await h.render()
    return window.__h.placed('g.vf-annotation text')
  })
  const staff = await staffOf(score)

  // The first is on the shared line; the second has dropped to clear its own note.
  expect(Math.abs(marks[0].y - staff.bottom - 4.77 * staff.spacing)).toBeLessThan(1)
  expect(marks[1].y).toBeGreaterThan(marks[0].y + staff.spacing)
})

test('a second render moves nothing — the pass is idempotent on a reused bar', async ({ score }) => {
  const [first, second] = await score.evaluate(async () => {
    const h = window.__h
    h.engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'w', measure: 1, beat: h.frac(0, 1) })
    h.engine.addDynamic(1, { beat: h.frac(0, 1), text: 'ff' })
    await h.render()
    const one = window.__h.placed('g.vf-annotation text')[0].y
    await h.render()
    return [one, window.__h.placed('g.vf-annotation text')[0].y]
  })
  const staff = await staffOf(score)

  // ⚠️ That it landed on the line at all, first — otherwise "it did not move" is a claim two
  // renders of nothing would also satisfy. C4 hangs a ledger line below the staff, so here the ink
  // decides rather than the minimum: notehead bottom 5.6 + padding 0.6 + the glyph's 2.72, which is
  // 4.87 spaces under the bottom line (2.04 and 4.24 before the pt→px correction of 2026-08-21,
  // `rendering/drawnFontSize`).
  expect(Math.abs(first - staff.bottom - 4.87 * staff.spacing)).toBeLessThan(1)
  // The trap this pins: translating a mark that already carries last render's transform. Prepend
  // instead of recomposing and the mark walks down the page, one line's worth per render.
  expect(second).toBeCloseTo(first, 3)
})

test('⭐ a LEVEL straddles its notehead; a WORD is anchored to it', async ({ score }) => {
  const out = await score.evaluate(async () => {
    const h = window.__h
    h.engine.addNoteAtBeat({ step: 'B', octave: 4, duration: 'h', measure: 1, beat: h.frac(0, 1) })
    h.engine.addNoteAtBeat({ step: 'B', octave: 4, duration: 'h', measure: 1, beat: h.frac(2, 1) })
    // ⚠️ The REAL glyph, not the ASCII letter: a level is stored as its SMuFL codepoint (U+E522 =
    // dynamicForte), and a typed ASCII `f` is deliberately NOT a level (`utils/dynamics`). Pass
    // 'ff' here and the mark is expression TEXT, which is anchored rather than centred — the test
    // would then be checking the other branch while claiming to check this one.
    h.engine.addDynamic(1, { beat: h.frac(0, 1), text: String.fromCharCode(0xe522).repeat(2) })
    h.engine.addDynamic(1, { beat: h.frac(2, 1), text: 'dolce' })
    await h.render()
    // Each mark's drawn ink box, and the notehead it belongs to.
    const marks = [...document.querySelectorAll('g.vf-annotation text')].map(t => {
      const box = (t as SVGGraphicsElement).getBoundingClientRect()
      return { left: box.left, centre: box.left + box.width / 2 }
    })
    const heads = h.noteheads().map(head => head.x)
    const svg = document.querySelector('svg')!.getBoundingClientRect()
    return { marks: marks.map(m => ({ left: m.left - svg.left, centre: m.centre - svg.left })), heads }
  })

  // A notehead's own x is its LEFT edge; VexFlow hands a below-annotation the head's CENTRE, half a
  // notehead (~0.6 spaces at this size) to the right of it. The level's INK centre must land there.
  const [ff, dolce] = out.marks
  const [head1, head2] = out.heads
  expect(Math.abs(ff.centre - (head1 + 6))).toBeLessThan(2)
  expect(dolce.left).toBeGreaterThan(head2) // the word starts at the head and runs right
})

test('⭐ `p dolce` shares a baseline — the co-located pair is no longer centred', async ({ score }) => {
  const marks = await score.evaluate(async () => {
    const h = window.__h
    h.engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'w', measure: 1, beat: h.frac(0, 1) })
    h.engine.addDynamic(1, { beat: h.frac(0, 1), text: 'p' })
    h.engine.addDynamic(1, { beat: h.frac(0, 1), text: 'dolce' })
    await h.render()
    return window.__h.placed('g.vf-annotation text')
  })

  expect(marks.length, 'the glyph and the word').toBe(2)
  // A 30px Bravura `p` and a 14px italic word look aligned only on a shared BASELINE; the old
  // co-location layout aligned their boxes' centres instead, which reads as a step.
  expect(marks[1].y).toBeCloseTo(marks[0].y, 1)
  expect(marks[1].x).toBeGreaterThan(marks[0].x) // still a left-to-right row
})

test('⭐⭐ the GUIDE POINT sits on the ink, not on the box — and it differs per letter', async ({ score }) => {
  // The attachment line a selected mark draws (`HighlightController.applyAnchorGuideLine`) leaves
  // its `from` end, captured here at render. Its whole reason is his report of 2026-08-17: the box's
  // top is `0.68 × the glyph size` for EVERY letter, so over a `p` the guide began nine pixels above
  // anything drawn — *"too much air, so it is an empty space… should be measuring ink and not bbox."*
  //
  // ⚠️ Browser-only, and this is the half jsdom cannot state: the box's top comes from the DRAWN
  // text's baseline, which has no meaning without fonts. What a unit test pins is the font table
  // (`dynamicMarkInk.test.ts`); what this pins is that the render used it.
  const seen = await score.evaluate(async () => {
    const h = window.__h
    h.engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: h.frac(0, 1) })
    h.engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: h.frac(1, 1) })
    const p = h.engine.addDynamic(1, { beat: h.frac(0, 1), text: '', placement: 'below' })!
    const f = h.engine.addDynamic(1, { beat: h.frac(1, 1), text: '', placement: 'below' })!
    await h.render()

    const reg = h.engine.getElementRegistry()
    const read = (id: string) => {
      const e = reg.getById(id)!
      return { boxTop: e.bbox.y, guideY: e.guides![0].from.y, guideX: e.guides![0].from.x, boxLeft: e.bbox.x }
    }
    return { p: read(p.id), f: read(f.id) }
  })

  for (const [name, mark] of Object.entries(seen)) {
    // Below the box's top means INSIDE the box — the air has been given back.
    expect(mark.guideY, `${name}: the guide starts below the box top`).toBeGreaterThan(mark.boxTop)
    // Horizontally the box already IS ink (the browser measures a <text>'s outline), so this end
    // is unchanged — the fix was vertical only.
    expect(mark.guideX, `${name}: x is still the box's left`).toBeCloseTo(mark.boxLeft, 5)
  }

  // ⭐⭐ THE POINT OF DOING IT PER LETTER: `f` is much taller than `p` (1.776 sp against 1.096), so a
  // constant cannot fit both. The `p` must give back MORE air than the `f`.
  const pAir = seen.p.guideY - seen.p.boxTop
  const fAir = seen.f.guideY - seen.f.boxTop
  expect(pAir, 'the p reclaims several pixels').toBeGreaterThan(5)
  expect(pAir, '…and more than the f, which nearly filled its box').toBeGreaterThan(fAir + 3)
})
