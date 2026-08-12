import { test, expect } from './fixtures'

/**
 * HAIRPINS — the crescendo / diminuendo wedge, drawn on the dynamics line
 * (docs/dynamics-line-and-hairpins-plan.md P3).
 *
 * ⚠️ **This suite has to be here and cannot be a unit test.** Every claim below is about where ink
 * landed, and the wedge's y comes from the dynamics line, which is stated relative to a MARK's ink
 * — a font measurement that answers 0 in jsdom. The shape arithmetic is unit-tested without a
 * browser (`engine/rendering/hairpinShape.test.ts`, `engine/models/hairpinOps.span.test.ts`); what
 * is checked here is that the DRAWING obeys it.
 */

/** The wedge's two arms, as drawn. Each is a straight `<path>` inside the hairpin's own group. */
const armsOf = (score: import('@playwright/test').Page) =>
  score.evaluate(() => window.__h.segments('g.vf-hairpin path'))

/**
 * The AXIS of each drawn wedge — the horizontal line its two arms are mirrored about.
 *
 * ⚠️ Not the midpoint of one arm: an arm runs from the axis to `axis ± aperture/2`, so its own
 * midpoint sits a QUARTER of the aperture off. Averaging both endpoints of BOTH arms cancels that,
 * for a crescendo and a diminuendo alike. Arms of one wedge share their x range, which is how they
 * are paired.
 */
function wedgeAxes(arms: Array<{ x1: number; y1: number; x2: number; y2: number }>): number[] {
  const byStart = new Map<number, Array<{ y1: number; y2: number }>>()
  for (const a of arms) {
    const key = Math.round(a.x1)
    const bucket = byStart.get(key)
    if (bucket) bucket.push(a)
    else byStart.set(key, [a])
  }
  return [...byStart.values()].map(pair =>
    pair.reduce((sum, a) => sum + a.y1 + a.y2, 0) / (pair.length * 2))
}

/** The first staff as drawn: its outer lines, and what one staff space measures. */
const staffOf = (score: import('@playwright/test').Page) =>
  score.evaluate(() => {
    const first = window.__h.staves()[0]
    return { top: first.top, bottom: first.bottom, spacing: (first.bottom - first.top) / 4 }
  })

test('⭐ a crescendo draws two arms that OPEN to the right', async ({ score }) => {
  await score.evaluate(async () => {
    const h = window.__h
    for (const beat of [0, 1, 2, 3]) {
      h.engine.addNoteAtBeat({ step: 'B', octave: 4, duration: 'q', measure: 1, beat: h.frac(beat, 1) })
    }
    h.engine.addHairpin(1, { type: 'cresc', beat: h.frac(0, 1), length: h.frac(4, 1) })
    await h.render()
  })

  const arms = await armsOf(score)
  expect(arms.length, 'two arms').toBe(2)
  // Both start at the same point (the closed tip) and end apart (the open mouth).
  expect(arms[0].x1).toBeCloseTo(arms[1].x1, 1)
  expect(arms[0].y1).toBeCloseTo(arms[1].y1, 1)
  expect(Math.abs(arms[0].y2 - arms[1].y2)).toBeGreaterThan(2)
  // …and it points RIGHT: the mouth is at the far end, not the near one.
  expect(arms[0].x2).toBeGreaterThan(arms[0].x1)
})

test('⭐ a diminuendo is its mirror — open at the left, closed at the right', async ({ score }) => {
  await score.evaluate(async () => {
    const h = window.__h
    for (const beat of [0, 1, 2, 3]) {
      h.engine.addNoteAtBeat({ step: 'B', octave: 4, duration: 'q', measure: 1, beat: h.frac(beat, 1) })
    }
    h.engine.addHairpin(1, { type: 'dim', beat: h.frac(0, 1), length: h.frac(4, 1) })
    await h.render()
  })

  const arms = await armsOf(score)
  expect(arms.length).toBe(2)
  expect(Math.abs(arms[0].y1 - arms[1].y1)).toBeGreaterThan(2) // open at the start
  expect(arms[0].y2).toBeCloseTo(arms[1].y2, 1)                // closed at the end
})

test('⭐⭐ the mouth opens to the aperture, in STAFF SPACES', async ({ score }) => {
  await score.evaluate(async () => {
    const h = window.__h
    for (const beat of [0, 1, 2, 3]) {
      h.engine.addNoteAtBeat({ step: 'B', octave: 4, duration: 'q', measure: 1, beat: h.frac(beat, 1) })
    }
    h.engine.addHairpin(1, { type: 'cresc', beat: h.frac(0, 1), length: h.frac(4, 1) })
    await h.render()
  })

  const arms = await armsOf(score)
  const staff = await staffOf(score)
  // 1.33 spaces total (LilyPond's `Hairpin.height` 0.6666 per side) — the default in
  // `rendering/hairpinShape.ts`, which is where this number is allowed to change.
  expect(Math.abs(arms[0].y2 - arms[1].y2) / staff.spacing).toBeCloseTo(1.33, 1)
})

test('⭐⭐ the wedge sits on the DYNAMICS LINE — level with the letters beside it', async ({ score }) => {
  await score.evaluate(async () => {
    const h = window.__h
    for (const beat of [0, 1, 2, 3]) {
      h.engine.addNoteAtBeat({ step: 'B', octave: 4, duration: 'q', measure: 1, beat: h.frac(beat, 1) })
    }
    // A `p` on beat 0 and a wedge over beats 1–4: the mark and the wedge are one family, so the
    // wedge's axis must land on the letters' OPTICAL CENTRE, not merely somewhere below the staff.
    h.engine.addDynamic(1, { beat: h.frac(0, 1), text: 'p' })
    h.engine.addHairpin(1, { type: 'cresc', beat: h.frac(1, 1), length: h.frac(3, 1) })
    await h.render()
  })

  const arms = await armsOf(score)
  const staff = await staffOf(score)
  const mark = (await score.evaluate(() => window.__h.placed('g.vf-annotation text')))[0]

  // The wedge's axis: midway between its two arms at the open end.
  const axis = (arms[0].y2 + arms[1].y2) / 2
  // The glyph's optical centre is its ink's middle, which sits ABOVE its baseline (a dynamic is
  // mostly above the line it is set on). Same two constants the line itself is built from
  // (`dynamicStyle`: 2.04 above, 0.54 below), so the offset is (0.54 − 2.04)/2 = −0.75 spaces.
  expect(axis - mark.y).toBeCloseTo(-0.75 * staff.spacing, 0)
})

test('⭐ a wedge STOPS SHORT of a dynamic it runs into', async ({ score }) => {
  const withMark = await score.evaluate(async () => {
    const h = window.__h
    for (const beat of [0, 1, 2, 3]) {
      h.engine.addNoteAtBeat({ step: 'B', octave: 4, duration: 'q', measure: 1, beat: h.frac(beat, 1) })
    }
    // A crescendo running INTO an `f` on beat 3.
    h.engine.addHairpin(1, { type: 'cresc', beat: h.frac(0, 1), length: h.frac(3, 1) })
    h.engine.addDynamic(1, { beat: h.frac(3, 1), text: 'f' })
    await h.render()
    return window.__h.segments('g.vf-hairpin path')[0].x2
  })

  const withoutMark = await score.evaluate(async () => {
    const h = window.__h
    const score = h.engine.getScore()
    const mark = score.measures[0].dynamics![0]
    h.engine.removeDynamic(mark.id)
    await h.render()
    return window.__h.segments('g.vf-hairpin path')[0].x2
  })

  // Gould: about a space of clearance (LilyPond's `bound-padding`). With the mark gone the wedge
  // reaches further right — so the gap is the mark's doing, not an accident of the layout.
  expect(withMark).toBeLessThan(withoutMark)
})

test('⭐⭐ a wedge crossing a system break is SPLIT, and it STEPS at the break', async ({ score }) => {
  const drawn = await score.evaluate(async () => {
    const h = window.__h
    // Enough bars to force a second system, with a wedge running across the break.
    for (let m = 1; m <= 12; m++) {
      if (m > 1) h.engine.addMeasure()
      h.engine.addNoteAtBeat({ step: 'B', octave: 4, duration: 'w', measure: m, beat: h.frac(0, 1) })
    }
    h.engine.addHairpin(1, { type: 'cresc', beat: h.frac(0, 1), length: h.frac(48, 1) })
    await h.render()
    const first = window.__h.staves()[0]
    return {
      arms: window.__h.segments('g.vf-hairpin path'),
      spacing: (first.bottom - first.top) / 4,
    }
  })

  // Two arms per fragment, and the wedge crosses at least one break.
  expect(drawn.arms.length).toBeGreaterThanOrEqual(4)
  expect(drawn.arms.length % 2).toBe(0)

  // ⚠️ Pair the arms up by Y, never by X: each system restarts at the left margin, so two fragments
  // on different systems overlap in x and sorting by x interleaves them. Their y's cannot collide —
  // consecutive systems are a whole staff apart.
  const byY = [...drawn.arms].sort((p, q) => (p.y1 + p.y2) - (q.y1 + q.y2))
  const fragments: Array<{ open0: number; open1: number }> = []
  for (let i = 0; i + 1 < byY.length; i += 2) {
    fragments.push({
      open0: Math.abs(byY[i].y1 - byY[i + 1].y1),
      open1: Math.abs(byY[i].y2 - byY[i + 1].y2),
    })
  }

  // ⭐⭐ THE STEP. LilyPond (`lily/hairpin.cc`) and Verovio (`src/view_control.cpp`) both cut a
  // broken crescendo at hard-coded thirds — first fragment 0 → ⅔ of the aperture, continuation
  // ⅓ → full — so the continuation RESUMES NARROWER than the first fragment ended. The plan
  // originally claimed it resumed at the width it left off; three engines say otherwise, and the
  // step is what lets each fragment read as a wedge in its own right.
  const first = fragments[0]
  const last = fragments[fragments.length - 1]
  expect(first.open0 / drawn.spacing).toBeCloseTo(0, 1)             // the first fragment starts closed
  expect(first.open1 / drawn.spacing).toBeCloseTo(1.33 * 2 / 3, 1)  // …and reaches ⅔ at the break
  expect(last.open0 / drawn.spacing).toBeCloseTo(1.33 / 3, 1)       // the last RESUMES at ⅓ — the step
  expect(last.open1 / drawn.spacing).toBeCloseTo(1.33, 1)           // …and ends at the full aperture
  expect(last.open0).toBeLessThan(first.open1)
})

test('⭐ P4: a wedge registers its OUTLINE, so it is clickable on its own ink', async ({ score }) => {
  const arms = await score.evaluate(async () => {
    const h = window.__h
    for (const beat of [0, 1, 2, 3]) {
      h.engine.addNoteAtBeat({ step: 'B', octave: 4, duration: 'q', measure: 1, beat: h.frac(beat, 1) })
    }
    h.engine.addHairpin(1, { type: 'cresc', beat: h.frac(0, 1), length: h.frac(4, 1) })
    await h.render()
    return window.__h.segments('g.vf-hairpin path')
  })

  // ⚠️ What is checked is the REGISTRY, not a click: this harness drives the engine alone, so the
  // press path (`elements/hairpin.ts` → Delete in `shortcutWiring`) is unit-tested instead. What
  // only a browser can say is that the outline registered here is the outline that was drawn.
  // The registry must hold that outline and not just a box — a four-bar wedge's bounding rectangle
  // sits under every note in them, and selecting by it would steal all their presses.
  const hit = await score.evaluate(([x, y]: number[]) => {
    const found = window.__h.engine.getElementRegistry().getByType('hairpin')
    return { count: found.length, hasPoints: found.every(e => (e.points?.length ?? 0) >= 4), x, y }
  }, [arms[0].x2, arms[0].y2])
  expect(hit.count, 'one registry entry per drawn fragment').toBe(1)
  expect(hit.hasPoints, 'the outline is registered, not only a bbox').toBe(true)
})

test('⭐ P4: a SPLIT wedge registers one entry per fragment, both carrying the id', async ({ score }) => {
  const entries = await score.evaluate(async () => {
    const h = window.__h
    for (let m = 1; m <= 12; m++) {
      if (m > 1) h.engine.addMeasure()
      h.engine.addNoteAtBeat({ step: 'B', octave: 4, duration: 'w', measure: m, beat: h.frac(0, 1) })
    }
    const made = h.engine.addHairpin(1, { type: 'cresc', beat: h.frac(0, 1), length: h.frac(48, 1) })
    await h.render()
    const found = window.__h.engine.getElementRegistry().getByType('hairpin')
    return { count: found.length, allSameId: found.every(e => e.id === made!.id) }
  })

  // Both halves clickable, both resolving to the ONE hairpin — otherwise selecting the
  // continuation of a wedge would select nothing.
  expect(entries.count).toBeGreaterThanOrEqual(2)
  expect(entries.allSameId).toBe(true)
})

test('⭐⭐ CHAINING: a `< >` pair over a LOW note levels with itself, not per-wedge', async ({ score }) => {
  const drawn = await score.evaluate(async () => {
    const h = window.__h
    h.engine.addMeasure()
    // His case, 2026-08-12: bar 1 two whole notes at ordinary heights; bar 2 a LOW C then a D.
    // Each wedge's own answer differs (the C reaches a ledger line); they are one gesture and must
    // come out level.
    h.engine.addNoteAtBeat({ step: 'E', octave: 4, duration: 'h', measure: 1, beat: h.frac(0, 1) })
    h.engine.addNoteAtBeat({ step: 'F', octave: 4, duration: 'h', measure: 1, beat: h.frac(2, 1) })
    h.engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'h', measure: 2, beat: h.frac(0, 1) })
    h.engine.addNoteAtBeat({ step: 'D', octave: 4, duration: 'h', measure: 2, beat: h.frac(2, 1) })
    h.engine.addHairpin(2, { type: 'cresc', beat: h.frac(0, 1), length: h.frac(2, 1) })
    h.engine.addHairpin(2, { type: 'dim', beat: h.frac(2, 1), length: h.frac(2, 1) })
    await h.render()
    const first = window.__h.staves()[0]
    return { arms: window.__h.segments('g.vf-hairpin path'), spacing: (first.bottom - first.top) / 4 }
  })

  expect(drawn.arms.length, 'two wedges, two arms each').toBe(4)
  const axes = wedgeAxes(drawn.arms)
  expect(axes.length).toBe(2)
  // ⭐ Both wedges are in one levelled chain, so they share a line. Before chaining, the wedge over
  // the low C sat lower than its neighbour and the pair stepped mid-gesture.
  expect(Math.abs(axes[0] - axes[1])).toBeLessThan(0.5)
})

test('⭐ …and a wedge that touches NOTHING keeps the local rule', async ({ score }) => {
  const drawn = await score.evaluate(async () => {
    const h = window.__h
    h.engine.addMeasure()
    h.engine.addMeasure()
    // Bar 1 ordinary, bar 3 dives low. The two wedges have a whole empty bar between them, so
    // they are separate chains and the low one deviates ALONE — P1's rule, still intact.
    h.engine.addNoteAtBeat({ step: 'B', octave: 4, duration: 'w', measure: 1, beat: h.frac(0, 1) })
    h.engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'w', measure: 3, beat: h.frac(0, 1) })
    h.engine.addHairpin(1, { type: 'cresc', beat: h.frac(0, 1), length: h.frac(4, 1) })
    h.engine.addHairpin(3, { type: 'cresc', beat: h.frac(0, 1), length: h.frac(4, 1) })
    await h.render()
    const first = window.__h.staves()[0]
    return { arms: window.__h.segments('g.vf-hairpin path'), spacing: (first.bottom - first.top) / 4 }
  })

  expect(drawn.arms.length).toBe(4)
  const axes = wedgeAxes(drawn.arms)
  expect(axes.length).toBe(2)
  // The low bar's wedge sits lower than the ordinary one — they are NOT levelled together.
  expect(Math.abs(axes[0] - axes[1])).toBeGreaterThan(0.5)
})

test('⭐⭐ two wedges that MEET leave a gap — they must not touch at a point', async ({ score }) => {
  const gaps = await score.evaluate(async () => {
    const h = window.__h
    h.engine.addMeasure()
    h.engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'h', measure: 2, beat: h.frac(0, 1) })
    h.engine.addNoteAtBeat({ step: 'D', octave: 4, duration: 'h', measure: 2, beat: h.frac(2, 1) })
    // His case: `< >` back to back. Their addresses abut exactly, so without the end inset the two
    // tips meet at one point and the pair reads as a single diamond.
    h.engine.addHairpin(2, { type: 'cresc', beat: h.frac(0, 1), length: h.frac(2, 1) })
    h.engine.addHairpin(2, { type: 'dim', beat: h.frac(2, 1), length: h.frac(2, 1) })
    await h.render()
    const first = window.__h.staves()[0]
    const arms = window.__h.segments('g.vf-hairpin path')
    return { arms, spacing: (first.bottom - first.top) / 4 }
  })

  expect(gaps.arms.length, 'two wedges, two arms each').toBe(4)
  // Eight endpoint x's in four coincident pairs: the `<` starts, the two wedges nearly meet, the
  // `>` ends. Sorted, positions 3 and 4 straddle the meeting — and what matters is that they are
  // not the same number.
  const xs = gaps.arms.flatMap(a => [a.x1, a.x2]).sort((p, q) => p - q)
  const air = xs[4] - xs[3]
  expect(air, 'the two wedges leave air between them').toBeGreaterThan(1)
  // ⭐ Twice `HAIRPIN.END_INSET`, and neither wedge knows the other is there: each simply sits a
  // quarter-space inside its own span, always. That is what makes this need no rule about
  // neighbours (his call — see the constant).
  expect(air / gaps.spacing).toBeCloseTo(0.5, 1)
})
