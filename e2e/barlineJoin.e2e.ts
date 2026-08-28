import { test, expect } from './fixtures'
import type { Page } from '@playwright/test'

/**
 * **CONTINUOUS BARLINES** — the line that runs unbroken through the gap between two staves
 * (docs/barline-join-plan.md P1).
 *
 * ⚠️ **This cannot be a unit test, even in principle.** The whole claim is about where ink lands
 * between two staves, and jsdom has no layout: every stave measures from arithmetic that agrees
 * with itself, and the one thing most likely to go wrong — a segment drawn inside a per-staff
 * `scale(k)` group, so it lands at 0.7 of where it belongs — is invisible until a real browser
 * composes the transform. The readers here go through each element's CTM (`inkSizes`), so what they
 * report is where the ink actually is, at whatever scale its group carries.
 *
 * ⭐ **The join is asked for in every test, because nothing is joined by default** — his call:
 * *"default should be not joined"*. What joins "all barlines" is the reach of the GESTURE (P3),
 * not the state a score starts in.
 */

/** A grand staff with a bar of quarters on each staff, its one gap JOINED. */
async function joinedGrandStaff(score: Page): Promise<void> {
  await score.evaluate(async () => {
    const h = window.__h
    h.engine.addStaffBelow(0)
    for (const staff of [0, 1]) {
      for (const beat of [0, 1, 2, 3]) {
        h.engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: h.frac(beat, 1), staff })
      }
    }
    h.engine.setBarlineJoinBelow(0, true)
    await h.render()
  })
}

/** The staves' own bands, and every piece of gap ink, in score coordinates. */
async function drawn(score: Page) {
  return score.evaluate(() => {
    const h = window.__h
    return {
      staves: h.staves().map(s => ({ measure: s.measure, staff: s.staff, x2: s.x2, top: s.top, bottom: s.bottom })),
      gap: h.inkSizes('g[id^="vf-barline-gap-"] rect'),
      gapDots: h.glyphs('g[id^="vf-barline-gap-"] text').length,
      // The two staves' OWN signs at that boundary — what the gap segment has to be continuous with.
      upperSign: h.inkSizes('g[id="vf-barline-1-0-end"] rect'),
      lowerSign: h.inkSizes('g[id="vf-barline-1-1-end"] rect'),
    }
  })
}

/**
 * ⭐⭐ **ONE LINE, IN THREE PIECES — the pieces MEET.**
 *
 * ⚠️ Asserted against the staves' own barline STROKES, ⛔ not against `staves()`' line positions:
 * those report a stave line's CENTRE, while a barline runs to the line's ink (VexFlow's
 * `getBottomLineBottomY`, which is `drawSystemConnector`'s *"`+ 1` for the bottom line's own
 * thickness"*). The difference is half a line — and it is SCALED, so on a 0.7 staff it is 0.35 and
 * on a full one 0.5. Testing continuity directly says what the feature actually claims and needs no
 * such correction.
 */
function expectContinuous(
  gap: { y: number; height: number }, above: { y: number; height: number }, below: { y: number },
  label: string,
): void {
  expect(gap.y, `${label}: the gap starts where the upper staff’s stroke ends`)
    .toBeCloseTo(above.y + above.height, 1)
  expect(gap.y + gap.height, `${label}: and ends where the lower staff’s stroke begins`)
    .toBeCloseTo(below.y, 1)
}

test('⛔ nothing is joined by default — a fresh grand staff draws no ink in the gap', async ({ score }) => {
  await score.evaluate(async () => {
    const h = window.__h
    h.engine.addStaffBelow(0)
    for (const staff of [0, 1]) {
      h.engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'w', measure: 1, beat: h.frac(0, 1), staff })
    }
    await h.render()
  })
  const { gap } = await drawn(score)
  expect(gap.length, 'each staff keeps its own barlines until someone asks otherwise').toBe(0)
})

test('⭐⭐ a JOINED barline runs THROUGH the gap: from the upper staff to the lower', async ({ score }) => {
  await joinedGrandStaff(score)
  const { staves, gap, upperSign, lowerSign } = await drawn(score)

  const upper = staves.find(s => s.measure === 1 && s.staff === 0)!
  const lower = staves.find(s => s.measure === 1 && s.staff === 1)!
  expect(gap.length, 'one stroke through the gap at the bar-1 boundary').toBe(1)

  // It fills the gap and nothing more — the three strokes are one line.
  expectContinuous(gap[0], upperSign[0], lowerSign[0], 'a plain line')
  // …and it stands on the boundary, where the two staves' own lines are.
  expect(gap[0].x, 'on the bar boundary').toBeCloseTo(upper.x2, 0)
  expect(lower.x2, 'the two staves share that boundary').toBeCloseTo(upper.x2, 0)
  // It really does cross the empty space, rather than being a hair on one staff's edge. ⚠️ Less the
  // two half staff-lines it stops short of: `staves()` reports a line's CENTRE and the strokes meet
  // at its INK, at each end (both staves are full size here, so that is 0.5 + 0.5).
  expect(gap[0].height, 'the gap it fills is the space between the staves')
    .toBeCloseTo(lower.top - upper.bottom - 1, 0)
})

test('⭐⭐ a REPEAT’s dots stay per staff — only the strokes cross the gap', async ({ score }) => {
  await joinedGrandStaff(score)
  await score.evaluate(async () => {
    window.__h.engine.setRepeatEnd(1, true)
    await window.__h.render()
  })
  const { gap, gapDots } = await drawn(score)

  // The sign is thin + gap + THICK: two strokes, both continued.
  expect(gap.length, 'both of the repeat’s strokes cross').toBe(2)
  expect(gapDots, '⛔ and NONE of its dots — they are drawn on each staff, by the font').toBe(0)
})

test('⭐ a SMALL staff’s join is not distorted — the gap is drawn in SCORE space', async ({ score }) => {
  await joinedGrandStaff(score)
  const before = await drawn(score)
  await score.evaluate(async () => {
    window.__h.engine.setStaffSize(0, 0.7)
    await window.__h.render()
  })
  const after = await drawn(score)

  const upper = after.staves.find(s => s.measure === 1 && s.staff === 0)!
  expect(upper.bottom - upper.top, 'the top staff really is drawn small').toBeCloseTo(28, 0)

  // ⭐ The join still MEETS both staves. Drawn inside the small staff's scale group it would land
  // at 0.7 of these numbers — which is the failure this test exists for.
  expectContinuous(after.gap[0], after.upperSign[0], after.lowerSign[0], 'across a 0.7 staff')
  expect(after.gap[0].x, 'still on the boundary').toBeCloseTo(upper.x2, 0)

  // ⭐ And its WEIGHT is the score's, not the small staff's — `barlineGap.GAP_SPACE`'s decision,
  // the same one `drawSystemConnector` made for the line joining these same two staves.
  expect(after.gap[0].width, 'the gap ink does not shrink with the staff').toBeCloseTo(before.gap[0].width, 1)
})

test('⭐ an INVISIBLE barline is invisible in the gap too', async ({ score }) => {
  await joinedGrandStaff(score)
  const shown = await score.evaluate(async () => {
    const h = window.__h
    h.engine.setBarlineStyle(1, 'invisible')
    await h.render()
    const gap = [...document.querySelectorAll('g[id^="vf-barline-gap-"] rect')]
    return { count: gap.length, fills: gap.map(r => r.getAttribute('fill') ?? '') }
  })
  // Still DRAWN — hiding must never re-space the music, so the ink is taken away after the draw.
  expect(shown.count, 'the line still reserves its room').toBe(1)
  // …and TINTED, so the editor can still click it and un-hide it.
  expect(shown.fills[0], 'gray, not black').toBe('#9CA3AF')
})

test('⭐ a joined barline is SELECTED as one line — the gap ink lights with the staves’', async ({ score }) => {
  await joinedGrandStaff(score)
  const lit = await score.evaluate(() => {
    // The selection lives in the editor, not the engine; the harness runs the engine alone, so the
    // highlight is exercised through the DOM the way `HighlightController` finds it: by group id.
    const gap = document.querySelector('g[id^="vf-barline-gap-1-0-"]')
    const sign = document.querySelector('g[id="vf-barline-1-0-end"]')
    return {
      // Both pieces exist and are findable by the ids the highlight looks up.
      gapFound: gap !== null,
      signFound: sign !== null,
      // Every stroke says which half of the sign it is, so a `:||:` can light one half only.
      halves: [...(gap?.querySelectorAll('rect') ?? [])].map(r => r.getAttribute('data-half')),
    }
  })
  expect(lit.signFound, 'the staff’s own sign group').toBe(true)
  expect(lit.gapFound, 'and the gap segment, under the id the highlight looks up').toBe(true)
  expect(lit.halves, 'a plain line’s single stroke is shared between the bars it divides').toEqual(['shared'])
})

/**
 * ⭐⭐ **THE GAP INK IS CLICKABLE — and the box is where the ink is.** His ask, 2026-08-28: *"if the
 * barline is join and i click on in the empty space of the two staves i want to be able to select it
 * too and move and do the normal barline operations"*.
 *
 * ⚠️ **A browser test, not a unit one**, for the reason the whole file exists: the box's y comes from
 * the PLACEMENTS of two staves and its x from a boundary that a reused bar reports stale. Only a real
 * render can say whether the hit box and the ink ended up in the same place — which is the one thing
 * that must be true, or the press lands on paper (*a press may only reach ink*).
 */
test('⭐ a joined gap registers a hit box, exactly on its own ink', async ({ score }) => {
  await joinedGrandStaff(score)
  const { boxes, gap } = await score.evaluate(() => ({
    boxes: window.__h.engine.getElementRegistry().getByType('barline-gap')
      .map(el => ({ measure: el.measure, staff: el.staff, ...el.bbox })),
    gap: window.__h.inkSizes('g[id^="vf-barline-gap-"] rect'),
  }))
  expect(boxes.length, 'one box for the one joined gap').toBe(1)
  // The bar it ENDS, and the staff ABOVE the gap — `barlineJoinBelow`'s own key.
  expect([boxes[0].measure, boxes[0].staff]).toEqual([1, 0])
  expect(boxes[0].x, 'the box starts at the stroke').toBeCloseTo(gap[0].x, 1)
  // ⚠️ WITHIN A PIXEL on the width, ⛔ not exactly: `hintBarlines` runs AFTER this box is registered
  // and rounds a thin line onto whole device pixels (1.6 → 2 here), so the ink is a shade wider than
  // the box that named it. It costs nothing — `BARLINE_PRESS_PAD_PX` pads the box by 6 either way —
  // and chasing the hinted value would make the registry describe the device instead of the score.
  expect(Math.abs(boxes[0].width - gap[0].width), 'and as wide as it, to the pixel').toBeLessThan(1)
  expect(boxes[0].y, 'top of the gap').toBeCloseTo(gap[0].y, 1)
  expect(boxes[0].height, 'the whole space between the staves').toBeCloseTo(gap[0].height, 1)
})

test('⛔ …and an UNJOINED gap registers none — nothing is drawn there to press', async ({ score }) => {
  await score.evaluate(async () => {
    const h = window.__h
    h.engine.addStaffBelow(0)
    h.engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: h.frac(0, 1), staff: 0 })
    await h.render()
  })
  const boxes = await score.evaluate(() =>
    window.__h.engine.getElementRegistry().getByType('barline-gap').length)
  expect(boxes, 'the existence of a box IS the proof it was drawn').toBe(0)
})
