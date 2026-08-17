import { test, expect } from './fixtures'

/**
 * THE ATTACHMENT GUIDE'S TWO ENDS — measured in a real browser, for every kind that draws one.
 *
 * The line itself is drawn by `HighlightController.applyAnchorGuideLine` (an `interactions` module
 * the harness does not load); what lives in the ENGINE, and therefore here, is the pair of points
 * each render captures onto the element's registry entry — `anchor`, the place the element hangs
 * off, and `guideFrom`, the point on the element's own ink. Everything that can be wrong about the
 * line is wrong in those two numbers.
 *
 * ⚠️ **It has to be a browser test.** Both points are read off drawn text: in jsdom every mark
 * measures 0×0 and sits at the origin, so each assertion below would agree with itself. That is not
 * hypothetical — the defect in §"travels with the element" shipped, and passed the unit suite.
 *
 * ⭐ A new kind adds a case here and two edits in `src/` (its pass captures the points, its
 * `ELEMENT_SPECS` row calls the guide) — see `docs/dynamic-offset-plan.md`.
 */

/** The first staff as drawn: its outer lines. */
const staffOf = (score: import('@playwright/test').Page) =>
  score.evaluate(() => {
    const first = window.__h.staves()[0]
    return { top: first.top, bottom: first.bottom }
  })

test('⭐⭐ a TEMPO mark points at its PLACE IN TIME — the bar opening, at the staff’s top line', async ({ score }) => {
  const seen = await score.evaluate(async () => {
    const h = window.__h
    h.engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: h.frac(0, 1) })
    const mark = h.engine.addTempoMark(1, { beat: h.frac(0, 1), text: 'Allegro', bpm: 120 })!
    await h.render()

    const e = h.engine.getElementRegistry().getById(mark.id)!
    return {
      box: { x: e.bbox.x, y: e.bbox.y, bottom: e.bbox.y + e.bbox.height },
      anchor: e.anchor!,
      guideFrom: e.guideFrom!,
    }
  })
  const staff = await staffOf(score)

  // ⭐ The far end is a PLACE, not a note: the staff's top line at the mark's own anchor x. A tempo
  // does not belong to a pitch, so — deliberately unlike the dynamic's — it must not follow one.
  // ⚠️ Within a pixel, not exact: a staff LINE has thickness, so what the harness reads off the
  // drawn line and what `Stave.getYForLine(0)` computes differ by half a hairline.
  expect(Math.abs(seen.anchor.y - staff.top), 'the staff’s top line').toBeLessThanOrEqual(1)
  expect(seen.anchor.x, 'left of the mark or under it, never off in the next bar')
    .toBeLessThan(seen.box.x + 60)

  // ⭐ The near end is the mark's own ink, at the corner NEAREST the staff — its BOTTOM, since a
  // tempo is engraved above (the mirror of a below-staff dynamic's top).
  expect(seen.guideFrom.x, 'the mark’s left edge').toBeCloseTo(seen.box.x, 0)
  expect(seen.guideFrom.y, 'below the box’s top').toBeGreaterThan(seen.box.y)
  expect(seen.guideFrom.y, 'and at its foot, not its head')
    .toBeGreaterThan((seen.box.y + seen.box.bottom) / 2)

  // …and it points DOWNWARD to the staff: the mark is above the music it governs.
  expect(seen.anchor.y, 'the staff is below the mark').toBeGreaterThan(seen.guideFrom.y)
})

test('⭐⭐ the near end TRAVELS with the element — the defect that shipped', async ({ score }) => {
  // 🚨 `ElementRegistry.shiftById` moved only `bbox`, so `guideFrom` stayed where the mark was first
  // drawn while the mark itself was translated onto its row — the dynamics line for a dynamic, the
  // ladder for a tempo. His report: *"at this point the anchor line is completely broken."*
  //
  // The invariant that catches it without pinning a pixel: the point is ON the element, so it must
  // stay INSIDE the element's box however far the pass moved it. Both passes move by tens of pixels,
  // so a missed shift lands far outside.
  const seen = await score.evaluate(async () => {
    const h = window.__h
    // A high passage, so the dynamics line and the tempo row both have to move their marks a long
    // way from where VexFlow first dropped them.
    for (let i = 0; i < 4; i++) {
      h.engine.addNoteAtBeat({ step: 'A', octave: 5, duration: 'q', measure: 1, beat: h.frac(i, 1) })
    }
    const tempo = h.engine.addTempoMark(1, { beat: h.frac(0, 1), text: 'Allegro', bpm: 120 })!
    const dyn = h.engine.addDynamic(1, { beat: h.frac(0, 1), text: '', placement: 'below' })!
    await h.render()

    const reg = h.engine.getElementRegistry()
    const read = (id: string) => {
      const e = reg.getById(id)!
      return { top: e.bbox.y, bottom: e.bbox.y + e.bbox.height, guideY: e.guideFrom!.y }
    }
    return { tempo: read(tempo.id), dynamic: read(dyn.id) }
  })

  for (const [name, el] of Object.entries(seen)) {
    expect(el.guideY, `${name}: the guide point is not above its own box`).toBeGreaterThanOrEqual(el.top - 0.5)
    expect(el.guideY, `${name}: nor below it`).toBeLessThanOrEqual(el.bottom + 0.5)
  }
})
