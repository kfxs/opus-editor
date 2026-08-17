import { test, expect } from './fixtures'

/**
 * THE ATTACHMENT GUIDE'S TWO ENDS — measured in a real browser, for every kind that draws one.
 *
 * The line itself is drawn by `HighlightController.applyAnchorGuideLine` (an `interactions` module
 * the harness does not load); what lives in the ENGINE, and therefore here, is the pair of points
 * each render captures onto the element's registry entry — `to`, the place the element hangs
 * off, and `from`, the point on the element's own ink. Everything that can be wrong about the
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
      guide: e.guides![0],
    }
  })
  const staff = await staffOf(score)

  // ⭐ The far end is a PLACE, not a note: the staff's top line at the mark's own anchor x. A tempo
  // does not belong to a pitch, so — deliberately unlike the dynamic's — it must not follow one.
  // ⚠️ Within a pixel, not exact: a staff LINE has thickness, so what the harness reads off the
  // drawn line and what `Stave.getYForLine(0)` computes differ by half a hairline.
  expect(Math.abs(seen.guide.to.y - staff.top), 'the staff’s top line').toBeLessThanOrEqual(1)
  expect(seen.guide.to.x, 'left of the mark or under it, never off in the next bar')
    .toBeLessThan(seen.box.x + 60)

  // ⭐ The near end is the mark's own ink, at the corner NEAREST the staff — its BOTTOM, since a
  // tempo is engraved above (the mirror of a below-staff dynamic's top).
  expect(seen.guide.from.x, 'the mark’s left edge').toBeCloseTo(seen.box.x, 0)
  expect(seen.guide.from.y, 'below the box’s top').toBeGreaterThan(seen.box.y)
  expect(seen.guide.from.y, 'and at its foot, not its head')
    .toBeGreaterThan((seen.box.y + seen.box.bottom) / 2)

  // …and it points DOWNWARD to the staff: the mark is above the music it governs.
  expect(seen.guide.to.y, 'the staff is below the mark').toBeGreaterThan(seen.guide.from.y)
})

test('⭐⭐ the near end TRAVELS with the element — the defect that shipped', async ({ score }) => {
  // 🚨 `ElementRegistry.shiftById` moved only `bbox`, so the guide's `from` end stayed where the mark was first
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
      return { top: e.bbox.y, bottom: e.bbox.y + e.bbox.height, guideY: e.guides![0].from.y }
    }
    return { tempo: read(tempo.id), dynamic: read(dyn.id) }
  })

  for (const [name, el] of Object.entries(seen)) {
    expect(el.guideY, `${name}: the guide point is not above its own box`).toBeGreaterThanOrEqual(el.top - 0.5)
    expect(el.guideY, `${name}: nor below it`).toBeLessThanOrEqual(el.bottom + 0.5)
  }
})

test('⭐⭐ a TRILL points at the NOTE it ornaments — the pitch its auxiliary is computed from', async ({ score }) => {
  const seen = await score.evaluate(async () => {
    const h = window.__h
    const note = h.engine.addNoteAtBeat({ step: 'C', octave: 5, duration: 'q', measure: 1, beat: h.frac(0, 1) })!
    h.engine.addNoteAtBeat({ step: 'C', octave: 5, duration: 'q', measure: 1, beat: h.frac(1, 1) })
    const trill = h.engine.createTrill([note.id])!
    await h.render()

    const e = h.engine.getElementRegistry().getById(trill.id)!
    const heads = h.noteheads()
    return {
      box: { x: e.bbox.x, y: e.bbox.y, bottom: e.bbox.y + e.bbox.height },
      guide: e.guides![0],
      firstHead: heads[0],
    }
  })

  // ⭐ The far end is the NOTEHEAD — this is where a trill parts company with a tempo mark, whose
  // anchor is a place in time. A trill's auxiliary is a step above THIS pitch, so pointing at a
  // staff line would point away from what the ornament is computed from.
  expect(Math.abs(seen.guide.to.y - seen.firstHead.y), 'the trilled notehead’s own y').toBeLessThan(6)
  expect(Math.abs(seen.guide.to.x - seen.firstHead.x), 'and its x').toBeLessThan(20)

  // ⭐ The near end is the sign's ink, at the corner nearest the staff — its BOTTOM, since the trill
  // is engraved above. And the guide points DOWN to the note.
  expect(seen.guide.from.y, 'the sign’s foot, not its head').toBeGreaterThan(seen.box.y)
  expect(seen.guide.to.y, 'the note is below the sign').toBeGreaterThan(seen.guide.from.y)
})

test('⭐⭐ a HAIRPIN draws ONE guide, at its BEGINNING — his call, where MuseScore draws two', async ({ score }) => {
  const seen = await score.evaluate(async () => {
    const h = window.__h
    const ids: string[] = []
    for (let i = 0; i < 4; i++) {
      ids.push(h.engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: h.frac(i, 1) })!.id)
    }
    const hairpin = h.engine.createHairpin([ids[1], ids[3]], 'cresc')!
    await h.render()

    const reg = h.engine.getElementRegistry()
    const entries = reg.getAll().filter(e => e.id === hairpin.id)
    const e = entries[0]
    return {
      guides: entries.flatMap(x => x.guides ?? []),
      box: { x: e.bbox.x, y: e.bbox.y, bottom: e.bbox.y + e.bbox.height },
      staffBottom: h.staves()[0].bottom,
      firstHeadX: h.noteheads()[0].x,
    }
  })

  // ⛔ ONE line, not two. A wedge's extent is already drawn; the guide says where it is ANCHORED.
  expect(seen.guides, 'the beginning only').toHaveLength(1)
  const [guide] = seen.guides

  // Its own end is the wedge's LEFT END, on the side facing the staff (the upper arm — a hairpin
  // lives below the staff). ⚠️ For a CRESCENDO that end is the closed tip, so it sits mid-box
  // vertically rather than at the box top: the box's height is the open end's aperture, which is at
  // the other end entirely. The honest assertion is that the point is ON the wedge.
  expect(guide.from.y, 'inside the wedge’s own box').toBeGreaterThanOrEqual(seen.box.y - 1)
  expect(guide.from.y, 'inside the wedge’s own box').toBeLessThanOrEqual(seen.box.bottom + 1)
  expect(Math.abs(guide.from.x - seen.box.x), 'at the wedge’s left end').toBeLessThan(2)

  // ⭐ The far end is a PLACE — the staff's bottom line at the start beat — not a notehead: a
  // hairpin is positional, like the tempo mark and unlike the trill.
  expect(Math.abs(guide.to.y - seen.staffBottom), 'the staff’s bottom line').toBeLessThanOrEqual(1)
  expect(guide.to.x, 'the beat the wedge starts on, not the bar’s first note')
    .toBeGreaterThan(seen.firstHeadX)
  // …and it points UP from the wedge to the staff.
  expect(guide.to.y).toBeLessThan(guide.from.y)
})
