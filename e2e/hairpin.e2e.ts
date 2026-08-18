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
  // 1.5 spaces total — Verovio's `hairpinSize` 3 MEI units and GUIDO's `deltaY` 3 half-spaces,
  // the majority of the four engines. The default lives in `rendering/hairpinShape.ts`, which is
  // where this number is allowed to change.
  expect(Math.abs(arms[0].y2 - arms[1].y2) / staff.spacing).toBeCloseTo(1.5, 1)
})

test('⭐⭐ the wedge is stroked at the shared THIN-LINE weight — a settled decision, not a default', async ({ score }) => {
  const drawn = await score.evaluate(async () => {
    const h = window.__h
    for (const beat of [0, 1, 2, 3]) {
      h.engine.addNoteAtBeat({ step: 'B', octave: 4, duration: 'q', measure: 1, beat: h.frac(beat, 1) })
    }
    h.engine.addHairpin(1, { type: 'cresc', beat: h.frac(0, 1), length: h.frac(4, 1) })
    await h.render()
    const arm = document.querySelector('g.vf-hairpin path') as SVGPathElement
    const first = window.__h.staves()[0]
    return {
      strokePx: parseFloat(getComputedStyle(arm).strokeWidth),
      spacing: (first.bottom - first.top) / 4,
    }
  })

  // ⭐ 0.16 spaces — `thinLineWeight`'s shared family weight, and SMuFL's own `hairpinThickness`.
  // ⚠️ This test exists because the hairpin nearly left that family on 2026-08-15: all four
  // reference engines draw it at roughly half a barline's weight (LilyPond 1.0 vs 1.9, MuseScore
  // 0.12 vs 0.18, Verovio 0.1, GUIDO 0.08), and a lighter stroke measurably shortens the stretch
  // near the closed end where the two converging arms read as one heavy line. Both 0.10 and 0.12
  // were drawn and rejected by eye. So the number is a settled taste decision, not an oversight,
  // and this pins it — `thinLineWeight.ts` carries the readings and the verdict.
  expect(drawn.strokePx / drawn.spacing).toBeCloseTo(0.16, 2)
})

test('⭐⭐ a LONG wedge opens wider than an ordinary one — measured in STAFF SPACES, not bars', async ({ score }) => {
  // ⚠️ The rule's input is drawn ink in staff spaces, which is why this fixture has to be a browser
  // one: how long nine bars of whole notes actually come out is the spacing model's answer, not
  // arithmetic anyone can do in jsdom. His correction, and the reason it is not a bar count —
  // four bars of sixteenths and four of whole notes are wedges of very different lengths.
  const drawn = await score.evaluate(async () => {
    const h = window.__h
    for (let m = 1; m <= 9; m++) {
      if (m > 1) h.engine.addMeasure()
      h.engine.addNoteAtBeat({ step: 'A', octave: 3, duration: 'w', measure: m, beat: h.frac(0, 1) })
    }
    h.engine.addHairpin(1, { type: 'cresc', beat: h.frac(0, 1), length: h.frac(36, 1) })
    await h.render()
    const first = window.__h.staves()[0]
    return {
      arms: window.__h.segments('g.vf-hairpin path'),
      spacing: (first.bottom - first.top) / 4,
    }
  })

  expect(drawn.arms.length, 'one wedge, on one system').toBe(2)
  const [a, b] = drawn.arms
  const lengthSpaces = (a.x2 - a.x1) / drawn.spacing
  const mouth = Math.abs(a.y2 - b.y2) / drawn.spacing

  // The premise: this really is a long wedge by the only measure the rule uses.
  expect(lengthSpaces).toBeGreaterThan(60)
  // ⭐ The growth ramp — flat 1.5 to 36 spaces, then +0.012 per space, clamped at Gould's 2.0
  // ("the open end should not be more than two stave-spaces wide", Behind Bars p.103). Without it
  // this wedge would carry the ordinary 1.5 mouth and its first 10.7% would be two strokes laid on
  // top of each other. Two clamps and a ramp is also Dorico's shape, found after ours was built —
  // `hairpinShape.ts` carries the readings and the seven cases he judged by eye.
  const expected = Math.min(2.0, 1.5 + 0.012 * Math.max(0, lengthSpaces - 36))
  expect(mouth).toBeCloseTo(expected, 1)
  expect(mouth, 'wider than an ordinary wedge').toBeGreaterThan(1.5)
  expect(mouth, "and never past Gould's two spaces").toBeLessThanOrEqual(2.0 + 0.01)
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
  // ⚠️ The thirds are measured against the wedge's OWN full aperture, read off the last fragment's
  // open end — not against `HAIRPIN.APERTURE`. This test used to pin the literal 1.5 and broke the
  // day the min-angle rule made a long wedge open wider (2026-08-15): it was asserting the aperture
  // by accident while claiming to assert the step. The aperture has its own tests.
  const aperture = last.open1 / drawn.spacing
  expect(aperture, 'a full mouth at the far end').toBeGreaterThan(1)
  expect(first.open0 / drawn.spacing).toBeCloseTo(0, 1)                  // the first fragment starts closed
  expect(first.open1 / drawn.spacing).toBeCloseTo(aperture * 2 / 3, 1)   // …and reaches ⅔ at the break
  expect(last.open0 / drawn.spacing).toBeCloseTo(aperture / 3, 1)        // the last RESUMES at ⅓ — the step
  expect(last.open0).toBeLessThan(first.open1)
})

test('⭐⭐ a wedge starting LATE in a system does not drag its continuation across the next one', async ({ score }) => {
  // ⚠️ The sibling test above crosses a break too — and passed through this defect for weeks, by
  // LUCK OF GEOMETRY. Its wedge starts in bar 1, so its start x is the smaller of the two numbers
  // and the "never past each other" rescue never fired. THIS is the shape that breaks it: the last
  // bar of one system to the first bar of the next, where the end's x is numerically SMALLER than
  // the start's because every system restarts at the left margin.
  const layout = await score.evaluate(async () => {
    const h = window.__h
    for (let m = 1; m <= 12; m++) {
      if (m > 1) h.engine.addMeasure()
      h.engine.addNoteAtBeat({ step: 'A', octave: 3, duration: 'w', measure: m, beat: h.frac(0, 1) })
    }
    await h.render()
    const bars = window.__h.staves()
    const secondSystemTop = [...new Set(bars.map(b => b.top))].sort((p, q) => p - q)[1]
    const second = bars.filter(b => b.top === secondSystemTop).sort((p, q) => p.x1 - q.x1)
    return { firstOfSecondSystem: second[0].measure, rightEdge: second[0].x2 }
  })
  // A second system is the premise of the test, not a thing it tolerates missing.
  expect(layout.firstOfSecondSystem).toBeGreaterThan(1)

  const drawn = await score.evaluate(async (firstOfSecond: number) => {
    const h = window.__h
    // Two whole notes: the last bar of system one, then the first bar of system two.
    h.engine.addHairpin(firstOfSecond - 1, { type: 'cresc', beat: h.frac(0, 1), length: h.frac(8, 1) })
    await h.render()
    const first = window.__h.staves()[0]
    return {
      arms: window.__h.segments('g.vf-hairpin path'),
      spacing: (first.bottom - first.top) / 4,
    }
  }, layout.firstOfSecondSystem)

  expect(drawn.arms.length, 'two fragments, two arms each').toBe(4)

  // ⭐ THE BUG: the continuation ran from the left margin out to an x borrowed from the PREVIOUS
  // system — a fragment covering most of system two, when the music it covers is bar one of it.
  const continuation = [...drawn.arms].sort((p, q) => (p.y1 + p.y2) - (q.y1 + q.y2)).slice(2)
  const reach = Math.max(...continuation.map(a => a.x2))
  expect(reach, 'the continuation stops inside the bar it ends in').toBeLessThanOrEqual(layout.rightEdge + 1)

  // …and the second symptom of the same cause: with the two ends a space apart, the angle cap
  // crushed the aperture to nothing and BOTH fragments drew as flat lines.
  const mouth = Math.abs(continuation[0].y2 - continuation[1].y2)
  expect(mouth / drawn.spacing, 'the continuation still ends at the full aperture').toBeCloseTo(1.5, 1)
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

/**
 * ⭐⭐ BROKEN FOR AN INTERIM DYNAMIC — Gould, *Behind Bars* printed p. 107:
 *
 * > "A hairpin may be broken for an interim dynamic. **Maintain the same angle for the hairpin
 * > either side of the interim dynamic**, so that the hairpin is clearly one gradual dynamic
 * > change."
 *
 * ⚠️ **These cannot be unit tests, and not only for the usual reason.** The cut is made from the
 * mark's DRAWN ink (`markInkX` reads `getBBox()` on the letter's `<text>`), which measures 0×0 in
 * jsdom — so without a browser there are no gaps at all and the wedge draws whole. The arithmetic
 * that keeps the halves collinear is unit-tested on its own (`engine/rendering/hairpinBreaks.test.ts`);
 * what is checked here is that the picture obeys it.
 *
 * ⛔ No other engine draws this: LilyPond forbids the input, MuseScore lets them overlap, Verovio
 * pushes the wedge to a second line at full length — the picture Gould labels `incorrect`.
 * See `reference/README.md`, the dynamic-vs-hairpin table.
 */
test('⭐⭐ a dynamic INSIDE the span breaks the wedge in two', async ({ score }) => {
  await score.evaluate(async () => {
    const h = window.__h
    for (const beat of [0, 1, 2, 3]) {
      h.engine.addNoteAtBeat({ step: 'B', octave: 4, duration: 'q', measure: 1, beat: h.frac(beat, 1) })
    }
    h.engine.addHairpin(1, { type: 'cresc', beat: h.frac(0, 1), length: h.frac(4, 1) })
    // 🚨 A REAL dynamics glyph (`dynamicForte`, U+E522), ⛔ not the ASCII letter: an ASCII `f` is
    // prose in a serif face (`utils/dynamics`' text-as-truth rule), it carries no centring translate,
    // and it therefore misses the whole class of bug these tests exist for — his report of
    // 2026-08-18 was invisible to a prose fixture.
    h.engine.addDynamic(1, { beat: h.frac(2, 1), text: '\ue522' })
    await h.render()
  })

  const arms = await armsOf(score)
  // TWO fragments, so four arms — where an uninterrupted wedge draws two.
  expect(arms.length, 'two fragments × two arms').toBe(4)

  // …and there is a real hole between them: the second fragment starts right of where the first
  // stopped, by more than the letter is wide.
  const xs = [...new Set(arms.map(a => Math.round(a.x1)))].sort((a, b) => a - b)
  expect(xs.length, 'two distinct fragment starts').toBe(2)
  const firstEnd = Math.max(...arms.filter(a => Math.round(a.x1) === xs[0]).map(a => a.x2))
  expect(xs[1]).toBeGreaterThan(firstEnd)
})

test('⭐⭐ …and the two halves lie on ONE pair of straight lines — the angle is maintained', async ({ score }) => {
  await score.evaluate(async () => {
    const h = window.__h
    for (const beat of [0, 1, 2, 3]) {
      h.engine.addNoteAtBeat({ step: 'B', octave: 4, duration: 'q', measure: 1, beat: h.frac(beat, 1) })
    }
    h.engine.addHairpin(1, { type: 'cresc', beat: h.frac(0, 1), length: h.frac(4, 1) })
    // 🚨 A REAL dynamics glyph (`dynamicForte`, U+E522), ⛔ not the ASCII letter: an ASCII `f` is
    // prose in a serif face (`utils/dynamics`' text-as-truth rule), it carries no centring translate,
    // and it therefore misses the whole class of bug these tests exist for — his report of
    // 2026-08-18 was invisible to a prose fixture.
    h.engine.addDynamic(1, { beat: h.frac(2, 1), text: '\ue522' })
    await h.render()
  })

  const arms = await armsOf(score)
  const { spacing } = await staffOf(score)
  const starts = [...new Set(arms.map(a => Math.round(a.x1)))].sort((a, b) => a - b)
  const first = arms.filter(a => Math.round(a.x1) === starts[0]).sort((a, b) => a.y2 - b.y2)
  const second = arms.filter(a => Math.round(a.x1) === starts[1]).sort((a, b) => a.y2 - b.y2)
  expect(first.length).toBe(2)
  expect(second.length).toBe(2)

  // Extrapolate each arm of the FIRST fragment across the gap, and it must land on the matching arm
  // of the second. ⭐ Gould's own drawing agrees to 0.14 staff spaces; half a space is a generous
  // tolerance that still fails outright for a wedge whose ramp restarts.
  for (const [a, b] of [[first[0], second[0]], [first[1], second[1]]] as const) {
    const slope = (a.y2 - a.y1) / (a.x2 - a.x1)
    expect(a.y2 + slope * (b.x1 - a.x2)).toBeCloseTo(b.y1, -Math.log10(spacing * 0.5))
  }
})

test('⭐⭐ the hole is a WINDOW, not a gap — a small padding either side of the ink', async ({ score }) => {
  // His call, 2026-08-18: *"the white in this case is too much… it will be good that the white is
  // just a small padding near to the ink"*. ⛔ NOT `BOUND_PADDING` (1 space, which the wedge's two
  // ENDS use): inside a wedge the white is a window cut in something continuous, and a space either
  // side reads as two wedges that happen to line up — the very thing p. 107's rule prevents.
  await score.evaluate(async () => {
    const h = window.__h
    for (const beat of [0, 1, 2, 3]) {
      h.engine.addNoteAtBeat({ step: 'B', octave: 4, duration: 'q', measure: 1, beat: h.frac(beat, 1) })
    }
    h.engine.addHairpin(1, { type: 'cresc', beat: h.frac(0, 1), length: h.frac(4, 1) })
    // 🚨 A REAL dynamics glyph (`dynamicForte`, U+E522), ⛔ not the ASCII letter: an ASCII `f` is
    // prose in a serif face (`utils/dynamics`' text-as-truth rule), it carries no centring translate,
    // and it therefore misses the whole class of bug these tests exist for — his report of
    // 2026-08-18 was invisible to a prose fixture.
    h.engine.addDynamic(1, { beat: h.frac(2, 1), text: '\ue522' })
    await h.render()
  })

  const arms = await armsOf(score)
  const { spacing } = await staffOf(score)
  const mark = (await score.evaluate(() => window.__h.inkSizes('g.vf-annotation text')))[0]
  expect(mark, 'the mark was drawn').toBeTruthy()

  const starts = [...new Set(arms.map(a => Math.round(a.x1)))].sort((a, b) => a - b)
  const firstEnd = Math.max(...arms.filter(a => Math.round(a.x1) === starts[0]).map(a => a.x2))
  const secondStart = starts[1]

  // ⭐⭐ Half a space either side (`HAIRPIN.BREAK_PADDING`), measured off Gould's own p. 107 drawing
  // — where the ENDS of the same figure carry 0.75–1.0 sp. ⛔ A whole space here is what he saw as
  // *"too much white"*.
  const before = (mark.x - firstEnd) / spacing
  const after = (secondStart - (mark.x + mark.width)) / spacing
  // ⚠️ Tolerance is one half-pixel = 0.05 sp: the arms are snapped to half-pixels so a hairline
  // straddles one row of pixels rather than two (`reference_thin_lines_need_half_pixel_offset`).
  expect(Math.abs(before - 0.5)).toBeLessThan(0.1)
  expect(Math.abs(after - 0.5)).toBeLessThan(0.1)
  // 🚨🚨 …and EVEN, which is the bug he caught: the hole was cut around the mark's UNMOVED box, so a
  // level — pulled back half its width onto its notehead — had the whole hole displaced sideways.
  // Her drawing measures 10 px on both sides.
  expect(Math.abs(before - after)).toBeLessThan(0.1)
})

test('🚨🚨 a NUDGED wedge that is also broken stays straight — it does not zigzag', async ({ score }) => {
  // His report, 2026-08-18: *"if I offset the hairpin the drawing is completely crazy"*. A vertical
  // nudge belongs to the wedge's two TRUE ends, so between them it is a straight line like the slant
  // — applied per drawn segment instead, the first half got the start's delta on its LEFT and the
  // second the end's on its RIGHT, with nothing in between.
  const before = await score.evaluate(async () => {
    const h = window.__h
    for (const beat of [0, 1, 2, 3]) {
      h.engine.addNoteAtBeat({ step: 'B', octave: 4, duration: 'q', measure: 1, beat: h.frac(beat, 1) })
    }
    const hp = h.engine.addHairpin(1, { type: 'cresc', beat: h.frac(0, 1), length: h.frac(4, 1) })!
    h.engine.addDynamic(1, { beat: h.frac(2, 1), text: '\ue522' })
    await h.render()
    const was = h.segments('g.vf-hairpin path').map(a => a.y1)
    // ⚠️ Both ends lifted by the same SMALL amount — his JSON's shape (`{start: {y}, end: {y}}`) but
    // not its size: three spaces would lift the wedge clear of the letter and it would be drawn
    // whole (the test below), leaving nothing broken to check for a zigzag.
    h.engine.nudgeHairpin(hp.id, 0, -0.5)
    await h.render()
    return was
  })

  const arms = await armsOf(score)
  const { spacing } = await staffOf(score)
  expect(arms.length, 'still two fragments × two arms').toBe(4)

  // ⭐ Equal nudges move the WHOLE wedge and change nothing about its shape, so the halves are still
  // collinear — which is the assertion that fails outright on a zigzag.
  const starts = [...new Set(arms.map(a => Math.round(a.x1)))].sort((a, b) => a - b)
  const first = arms.filter(a => Math.round(a.x1) === starts[0]).sort((a, b) => a.y2 - b.y2)
  const second = arms.filter(a => Math.round(a.x1) === starts[1]).sort((a, b) => a.y2 - b.y2)
  for (const [a, b] of [[first[0], second[0]], [first[1], second[1]]] as const) {
    const slope = (a.y2 - a.y1) / (a.x2 - a.x1)
    expect(a.y2 + slope * (b.x1 - a.x2)).toBeCloseTo(b.y1, -Math.log10(spacing * 0.5))
  }
  // …and the WHOLE thing moved up by three spaces rather than one end of it: every arm's left y
  // shifted by the same amount. ⛔ On the zigzag the second fragment's left edge did not move at all.
  for (const [i, a] of arms.entries()) expect((before[i] - a.y1) / spacing).toBeCloseTo(0.5, 1)
})

test('⭐⭐ lift the WEDGE clear of the mark and it is drawn WHOLE — no hole cut for nothing', async ({ score }) => {
  // His rule, 2026-08-18: *"if the hairpin is offset vertical or the dynamic is offset vertical, so
  // none of them touch each other (if and only if) then we should draw the normal hairpin"*. The
  // break exists to let a letter THROUGH; a letter that is no longer in the way needs no window.
  await score.evaluate(async () => {
    const h = window.__h
    for (const beat of [0, 1, 2, 3]) {
      h.engine.addNoteAtBeat({ step: 'B', octave: 4, duration: 'q', measure: 1, beat: h.frac(beat, 1) })
    }
    const hp = h.engine.addHairpin(1, { type: 'cresc', beat: h.frac(0, 1), length: h.frac(4, 1) })!
    h.engine.addDynamic(1, { beat: h.frac(2, 1), text: '\ue522' })
    await h.render()
    h.engine.nudgeHairpin(hp.id, 0, -3)   // three spaces up: past the top of the `f`'s ink
    await h.render()
  })

  expect((await armsOf(score)).length, 'ONE fragment — two arms, not four').toBe(2)
})

test('⭐ …and lifting the MARK instead does it too — either one moving is enough', async ({ score }) => {
  await score.evaluate(async () => {
    const h = window.__h
    for (const beat of [0, 1, 2, 3]) {
      h.engine.addNoteAtBeat({ step: 'B', octave: 4, duration: 'q', measure: 1, beat: h.frac(beat, 1) })
    }
    h.engine.addHairpin(1, { type: 'cresc', beat: h.frac(0, 1), length: h.frac(4, 1) })
    const dyn = h.engine.addDynamic(1, { beat: h.frac(2, 1), text: '\ue522' })!
    await h.render()
    h.engine.nudgeDynamicOffset(dyn.id, 0, 3)   // the mark DOWN, away from the wedge
    await h.render()
  })

  expect((await armsOf(score)).length, 'ONE fragment again').toBe(2)
})

test('🚨 …but a mark still ON the wedge keeps its hole — the test is CLASH, not "was nudged"', async ({ score }) => {
  await score.evaluate(async () => {
    const h = window.__h
    for (const beat of [0, 1, 2, 3]) {
      h.engine.addNoteAtBeat({ step: 'B', octave: 4, duration: 'q', measure: 1, beat: h.frac(beat, 1) })
    }
    h.engine.addHairpin(1, { type: 'cresc', beat: h.frac(0, 1), length: h.frac(4, 1) })
    const dyn = h.engine.addDynamic(1, { beat: h.frac(2, 1), text: '\ue522' })!
    await h.render()
    h.engine.nudgeDynamicOffset(dyn.id, 0, 0.25)  // a quarter space: still through the arms
    await h.render()
  })

  expect((await armsOf(score)).length, 'still broken').toBe(4)
})

/**
 * ⭐⭐ THE HOLE SURVIVES THE TEXT EDITOR — his report, 2026-08-18: double-click a dynamic and *"the
 * hairpin draw completely so it is very messy to work here"*.
 *
 * A mark being edited is SUPPRESSED (the engraved glyph is not drawn, so the DOM input is not
 * sitting on a doubled letter) — and a suppressed mark measures nothing, so every reader concluded
 * the space was free and the wedge closed its hole straight through the editor.
 */
test('⭐⭐ a mark hidden behind its editor KEEPS its hole', async ({ score }) => {
  const arms = await score.evaluate(async () => {
    const h = window.__h
    for (const beat of [0, 1, 2, 3]) {
      h.engine.addNoteAtBeat({ step: 'B', octave: 4, duration: 'q', measure: 1, beat: h.frac(beat, 1) })
    }
    h.engine.addHairpin(1, { type: 'cresc', beat: h.frac(0, 1), length: h.frac(4, 1) })
    const dyn = h.engine.addDynamic(1, { beat: h.frac(2, 1), text: '\ue522' })!
    await h.render()
    // …and now the editor opens on it.
    h.engine.setSuppressedDynamicId(dyn.id)
    await h.render()
    return window.__h.segments('g.vf-hairpin path').length
  })

  expect(arms, 'still two fragments × two arms').toBe(4)
})

test('⭐⭐ …and the hole GROWS with what is being typed', async ({ score }) => {
  const holes = await score.evaluate(async () => {
    const h = window.__h
    for (const beat of [0, 1, 2, 3]) {
      h.engine.addNoteAtBeat({ step: 'B', octave: 4, duration: 'q', measure: 1, beat: h.frac(beat, 1) })
    }
    h.engine.addHairpin(1, { type: 'cresc', beat: h.frac(0, 1), length: h.frac(4, 1) })
    const dyn = h.engine.addDynamic(1, { beat: h.frac(2, 1), text: '\ue522' })!
    await h.render()

    /** The empty span between the two fragments, in px. */
    const hole = () => {
      const arms = window.__h.segments('g.vf-hairpin path')
      const starts = [...new Set(arms.map(a => Math.round(a.x1)))].sort((a, b) => a - b)
      const firstEnd = Math.max(...arms.filter(a => Math.round(a.x1) === starts[0]).map(a => a.x2))
      return starts[1] - firstEnd
    }

    h.engine.setSuppressedDynamicId(dyn.id)
    await h.render()
    const held = hole()
    // The editor now holds a longer word — 30 score px of it. ⚠️ Not much more: past a point the
    // hole eats a whole fragment, which is correct (the editor really is covering that much wedge)
    // but leaves nothing to compare.
    h.engine.setSuppressedDynamicId(dyn.id, 30)
    await h.render()
    return { held, typed: hole() }
  })

  // ⭐ The hole is the editor's width plus its two paddings, so a wider text is a wider hole. ⛔ The
  // wedge must not simply close, and must not stay at the size the mark had when the editor opened.
  expect(holes.typed).toBeGreaterThan(holes.held + 5)
})
