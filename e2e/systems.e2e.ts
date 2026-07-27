import { test, expect } from './fixtures'

/**
 * Casting off — where the music breaks into systems, and what a beam does when a break lands in
 * the middle of it (docs/cross-barline-beaming-plan.md, docs/ragged-last-system.md).
 *
 * VexFlow does no line breaking at all; every one of these decisions is ours, and every one is made
 * from MEASURED widths. In jsdom those widths are zeros, so the whole of this file is invisible to
 * the unit suite — including the fact that a break happens at all.
 */

/** Ten bars of eight eighths: wide bars, so the music takes several systems. */
async function tenBarsOfEighths(score: import('@playwright/test').Page): Promise<void> {
  await score.evaluate(async () => {
    const h = window.__h
    while (h.engine.getScore().measures.length < 10) h.engine.addMeasure()
    for (let measure = 1; measure <= 10; measure++) {
      for (let eighth = 0; eighth < 8; eighth++) {
        h.engine.addNoteAtBeat({ step: 'C', octave: 4, duration: '8', measure, beat: h.frac(eighth, 2) })
      }
    }
    await h.render()
  })
}

test('the music casts off into systems: each full one justified, the last one ragged', async ({ score }) => {
  await tenBarsOfEighths(score)
  const staves = await score.evaluate(() => window.__h.staves())

  const tops = [...new Set(staves.map(s => s.top))].sort((a, b) => a - b)
  expect(tops.length, 'more than one system').toBeGreaterThan(1)

  // Bars are numbered along, and a system is a contiguous run of them.
  const systems = tops.map(top => staves.filter(s => s.top === top).sort((a, b) => a.x1 - b.x1))
  let expected = 1
  for (const system of systems) {
    for (const bar of system) expect(bar.measure, 'bars run in order across the systems').toBe(expected++)
  }

  // Every bar starts where the one before it ended — no gaps, no overlaps.
  for (const system of systems) {
    for (const [i, bar] of system.slice(1).entries()) {
      expect(bar.x1, `bar ${bar.measure} starts at the end of bar ${bar.measure - 1}`).toBeCloseTo(system[i].x2, 1)
    }
  }

  const rightEdge = systems.map(system => system[system.length - 1].x2)
  const full = rightEdge.slice(0, -1)
  for (const edge of full) expect(edge, 'a full system is justified to the margin').toBeCloseTo(full[0], 1)
  expect(rightEdge[rightEdge.length - 1], 'and the last line is left RAGGED — LilyPond’s default, and ours')
    .toBeLessThan(full[0] - 10)
})

test('a beam marked across the system break draws on BOTH sides of it', async ({ score }) => {
  await tenBarsOfEighths(score)

  const drawn = await score.evaluate(async () => {
    const h = window.__h
    const before = h.crossBarBeams().length
    const staves = h.staves()
    const firstTop = Math.min(...staves.map(s => s.top))
    const secondTop = Math.min(...staves.filter(s => s.top > firstTop).map(s => s.top))
    // The last bar of the first system — so the note we mark has its partner on the next line.
    const lastOnFirst = Math.max(...staves.filter(s => s.top === firstTop).map(s => s.measure))
    const chords = h.engine.getScore().measures[lastOnFirst - 1].slots.filter(s => s.type === 'chord')
    const lastNote = chords[chords.length - 1]
    h.engine.updateNote(lastNote.notes[0].id, { beam: 'continue' })
    await h.render()

    const groups = h.crossBarBeams().map(([beam]) => ({ top: beam.yLeft, left: beam.left, right: beam.right }))
    // The layout AFTER the mark: losing its flags re-engraves both bars, so the bar boxes the
    // fragments must be judged against are these, not the ones the mark was chosen from.
    return { before, groups, firstTop, secondTop, lastOnFirst, staves: h.staves() }
  })

  expect(drawn.before, 'nothing crosses a barline until something says so').toBe(0)
  expect(drawn.groups, 'the join is drawn as two fragments — one per system').toHaveLength(2)

  const [first, second] = [...drawn.groups].sort((a, b) => a.top - b.top)
  const systemGap = drawn.secondTop - drawn.firstTop
  expect(second.top - first.top, 'one on each system').toBeCloseTo(systemGap, 0)

  // The fragment above hangs at the END of its line; the one below opens the next.
  const endOfFirst = drawn.staves.find(s => s.measure === drawn.lastOnFirst)!
  const startOfSecond = drawn.staves.find(s => s.measure === drawn.lastOnFirst + 1)!
  expect(startOfSecond.top, 'the break is still between those two bars').toBeGreaterThan(endOfFirst.top)
  expect(first.right, 'the upper fragment ends with its line').toBeLessThanOrEqual(endOfFirst.x2 + 1)
  expect(first.left).toBeGreaterThan(endOfFirst.x1)
  expect(second.left, 'the lower one opens the next').toBeGreaterThanOrEqual(startOfSecond.x1)
  expect(second.right).toBeLessThan(startOfSecond.x2)
})
