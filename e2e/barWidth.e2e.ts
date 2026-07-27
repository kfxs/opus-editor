import { test, expect } from './fixtures'

/**
 * The bar-width gesture (docs/bar-width-plan.md §4–§6), measured for real.
 *
 * This is the one feature in the editor whose whole definition is a measured pixel: *the barline
 * lands where the gesture asked*. Widening a bar shrinks its own justified share and every bar's
 * before it on the line, so the barline moves by LESS than was added unless the renderer inverts
 * that transfer — and the room it may take is read off the last render. `MusicEngine
 * .barWidthNudge.test.ts` pins the arithmetic in jsdom; only a browser can say the ink agreed.
 */

/** Twelve bars of four quarters — enough to fill more than one system, which is what makes the
 *  first system JUSTIFIED and therefore a transfer at all (a ragged last line has nothing to
 *  give). */
async function twelveBars(score: import('@playwright/test').Page): Promise<void> {
  await score.evaluate(async () => {
    const h = window.__h
    while (h.engine.getScore().measures.length < 12) h.engine.addMeasure()
    for (let measure = 1; measure <= 12; measure++) {
      for (const beat of [0, 1, 2, 3]) {
        h.engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'q', measure, beat: h.frac(beat, 1) })
      }
    }
    await h.render()
  })
}

test('nudging a bar wider moves its barline by what was asked, and the line still justifies', async ({ score }) => {
  await twelveBars(score)

  const drawn = await score.evaluate(async () => {
    const h = window.__h
    const before = h.staves()
    const beforeBarlines = h.barlines().map(b => b.x)
    const room = h.engine.nudgeBarWidth(1, 30)
    await h.render()
    return { before, beforeBarlines, room, after: h.staves(), afterBarlines: h.barlines().map(b => b.x) }
  })

  const bar = (staves: typeof drawn.before, measure: number) => staves.find(s => s.measure === measure)!
  const firstSystem = drawn.before.filter(s => s.top === drawn.before[0].top)
  expect(firstSystem.length, 'the first system holds several bars').toBeGreaterThan(2)

  // 1. The gesture landed. Not "it moved" — it moved by THIRTY.
  const moved = bar(drawn.after, 1).x2 - bar(drawn.before, 1).x2
  expect(moved, 'the barline went where the drag asked').toBeCloseTo(30, 0)
  expect(drawn.afterBarlines, 'and a barline really is drawn there')
    .toContainEqual(expect.closeTo(bar(drawn.after, 1).x2, 1))
  expect(drawn.beforeBarlines).not.toContainEqual(expect.closeTo(bar(drawn.after, 1).x2, 1))

  // 2. Someone paid for it. The system still ends exactly where it did, so the width came out of
  //    the other bars on the line — that transfer IS the feature.
  const lastOfSystem = firstSystem[firstSystem.length - 1].measure
  expect(bar(drawn.after, lastOfSystem).x2, 'the line still ends at the right margin')
    .toBeCloseTo(bar(drawn.before, lastOfSystem).x2, 1)
  for (const stave of firstSystem.slice(1)) {
    const width = (staves: typeof drawn.before) => {
      const found = bar(staves, stave.measure)
      return found.x2 - found.x1
    }
    expect(width(drawn.after), `bar ${stave.measure} gave some width up`).toBeLessThan(width(drawn.before))
  }

  // 3. Nothing below the line moved: a bar's width is a decision about ITS system.
  for (const stave of drawn.before.filter(s => s.top !== drawn.before[0].top)) {
    expect(bar(drawn.after, stave.measure).x1, `bar ${stave.measure} sits where it did`).toBeCloseTo(stave.x1, 1)
    expect(bar(drawn.after, stave.measure).top).toBeCloseTo(stave.top, 1)
  }
})

test('the room a bar may shrink into is measured off the music, not invented', async ({ score }) => {
  await twelveBars(score)

  const drawn = await score.evaluate(async () => {
    const h = window.__h
    // Ask for far more than four quarter notes can give back.
    const room = h.engine.nudgeBarWidth(2, -500)
    await h.render()
    const bar2 = h.staves().find(s => s.measure === 2)!
    const heads = h.noteheads()
    return { room, width: bar2.x2 - bar2.x1, x1: bar2.x1, x2: bar2.x2, heads }
  })

  expect(drawn.width, 'the bar stopped at its own music').toBeGreaterThan(20)
  const inside = drawn.heads.filter(head => head.x > drawn.x1 && head.x < drawn.x2)
  expect(inside.length, 'and its notes are still inside it').toBe(4)
  for (const [i, head] of inside.slice(1).entries()) {
    expect(head.x, 'in order, none on top of another').toBeGreaterThan(inside[i].x + 1)
  }
})
