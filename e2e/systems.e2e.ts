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

test('⭐⭐ a GRAND STAFF agrees on x: the same beat lands at the same place on both staves', async ({ score }) => {
  // His report, on a two-staff fragment: *"look at the image, the space is wrong — vertically the
  // second stave doesn't match with the first, this is wrong notation."* He was right, and by a lot:
  // measured at **1.0, 1.7 and 2.4** staff spaces of drift across one bar, growing, because it was a
  // SHIFT plus a SCALE.
  //
  // ⭐ The cause was one destructuring line. `drawMeasureContent` opens with
  //   `const { view: measure } = placement` — the staff's own LANE — and then resolved both the
  //   column list and the lead-in from it, so each staff spaced itself as though it were alone on the
  //   page: the upper staff's eight eighths shared the bar with themselves, the lower staff's three
  //   notes shared it with themselves, and the two grids had nothing to do with each other. The
  //   spacing pass's own doc had said the opposite ("every staff is handed the same merged column
  //   list") since it was written — the merge existed in the WIDTH path only.
  //
  // ⚠️ For unmetred contemporary notation, horizontal independence between staves is a thing we will
  //    want on purpose. It is not the default, and the default is what this pins.
  const drawn = await score.evaluate(async () => {
    const h = window.__h
    h.engine.addStaffBelow(0)
    h.engine.addMeasure()
    // Upper: eight eighths. Lower: three notes at beats 0, 1 and 2, each with an accidental — so the
    // two staves have different rhythms AND different ink, which is what made the drift visible.
    const steps = ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'C'] as const
    steps.forEach((step, i) => {
      h.engine.addNoteAtBeat({ step, octave: i === 7 ? 5 : 4, duration: '8', measure: 2, beat: h.frac(i, 2), staff: 0 })
    })
    h.engine.addNoteAtBeat({ step: 'C', alter: -1, octave: 4, duration: 'q', measure: 2, beat: h.frac(0, 1), staff: 1 })
    h.engine.addNoteAtBeat({ step: 'A', alter: 1, octave: 4, duration: 'q', measure: 2, beat: h.frac(1, 1), staff: 1 })
    h.engine.addNoteAtBeat({ step: 'G', alter: 1, octave: 4, duration: 'h', measure: 2, beat: h.frac(2, 1), staff: 1 })
    await h.render()

    const staves = h.staves().filter(stave => stave.measure === 2)
    const upper = staves.find(stave => stave.staff === 0)!
    const lower = staves.find(stave => stave.staff === 1)!
    const space = (upper.bottom - upper.top) / 4
    const headsOf = (top: number) => h.noteheads()
      .filter(g => Math.abs(g.y - top) < 90 && g.x > upper.x1 && g.x < upper.x2)
      .map(g => (g.x - upper.x1) / space)
      .sort((a, b) => a - b)
    const noteStart = (staff: number) =>
      (h.engine.getElementRegistry().getStaffGeometry(2, staff)!.noteStartX - upper.x1) / space
    return { upper: headsOf(upper.top), lower: headsOf(lower.top), noteStart: [noteStart(0), noteStart(1)] }
  })

  console.log(`[census] grand staff, bar 2: upper ${drawn.upper.map(x => x.toFixed(2)).join(' ')} · ` +
    `lower ${drawn.lower.map(x => x.toFixed(2)).join(' ')} · note starts ${drawn.noteStart.map(x => x.toFixed(2)).join(' ')}`)
  expect(drawn.upper, 'eight eighths above').toHaveLength(8)
  expect(drawn.lower, 'three notes below').toHaveLength(3)

  // ⭐⭐ Beats 0, 1 and 2 of the lower staff sit on the upper staff's 1st, 3rd and 5th eighth — to
  //     three decimals, because they are literally the same number written by the same pass.
  expect(drawn.lower[0], 'beat 0').toBeCloseTo(drawn.upper[0], 3)
  expect(drawn.lower[1], 'beat 1').toBeCloseTo(drawn.upper[2], 3)
  expect(drawn.lower[2], 'beat 2').toBeCloseTo(drawn.upper[4], 3)
  // …and the music starts at one x for the whole system, which is the other half of the same rule.
  expect(drawn.noteStart[0], 'one note start for the system').toBeCloseTo(drawn.noteStart[1], 3)
})

test('⭐ …and a CLEF CHANGE on one staff alone does not move that staff\'s music out of line', async ({ score }) => {
  // The same rule, second half: a clef is per staff and a change may happen on one staff only, which
  // legitimately makes that staff's header wider. What must not follow is its music starting later
  // than its neighbour's — measured at 2.6 staff spaces apart at beat 1, converging to 0.65 by beat 4.
  // The width path always reserved the WIDEST header (`MeasureLayout`'s `widestOverhead`); the drawing
  // was placing each staff after its OWN.
  const drawn = await score.evaluate(async () => {
    const h = window.__h
    h.engine.addStaffBelow(0)
    h.engine.addMeasure()
    for (const beat of [0, 1, 2, 3]) {
      for (const staff of [0, 1]) {
        h.engine.addNoteAtBeat({ step: 'B', octave: 4, duration: 'q', measure: 2, beat: h.frac(beat, 1), staff })
      }
    }
    h.engine.setClef(2, 'bass', 1) // the LOWER staff changes clef at bar 2; the upper does not
    await h.render()
    const staves = h.staves().filter(stave => stave.measure === 2)
    const upper = staves.find(stave => stave.staff === 0)!
    const lower = staves.find(stave => stave.staff === 1)!
    const space = (upper.bottom - upper.top) / 4
    const headsOf = (top: number) => h.noteheads()
      .filter(g => Math.abs(g.y - top) < 90 && g.x > upper.x1 && g.x < upper.x2)
      .map(g => (g.x - upper.x1) / space)
      .sort((a, b) => a - b)
    return { upper: headsOf(upper.top), lower: headsOf(lower.top) }
  })

  console.log(`[census] one clef change: upper ${drawn.upper.map(x => x.toFixed(2)).join(' ')} · ` +
    `lower ${drawn.lower.map(x => x.toFixed(2)).join(' ')}`)
  expect(drawn.upper, 'four quarters above').toHaveLength(4)
  expect(drawn.lower, 'four quarters below').toHaveLength(4)
  for (const [i, x] of drawn.lower.entries()) {
    expect(x, `beat ${i} agrees across the staves`).toBeCloseTo(drawn.upper[i], 3)
  }
})

test('⭐ …and a staff drawn SMALL keeps the system’s columns — the full-size staff wins', async ({ score }) => {
  // The same rule, third half — and the one where "the same beat is the same x" and "this staff's
  // ink is 0.7 of that one's" pull against each other. A small staff is drawn inside a `scale(k)`
  // group, so every distance written into it is multiplied by k on the way to the page: write the
  // system's column x undivided and a 0.7 staff lays the bar out 30% narrow, starting 30% early.
  // Reported as *"issues with the column or the vertical alignment between small staff and normal
  // staff — in any case, normal staff should win always"*.
  //
  // ⚠️ Read with `placed`, NOT `noteheads()`: that one reports the `x` ATTRIBUTE, which for a scaled
  // staff is the number written INSIDE the group rather than where the ink landed — it reported
  // these two staves 43% apart while they were in fact drawn on top of each other.
  const drawn = await score.evaluate(async () => {
    const h = window.__h
    h.engine.addStaffBelow(0)
    h.engine.addMeasure()
    for (const beat of [0, 1, 2, 3]) {
      for (const staff of [0, 1]) {
        h.engine.addNoteAtBeat({ step: 'B', octave: 4, duration: 'q', measure: 2, beat: h.frac(beat, 1), staff })
      }
    }
    h.engine.setStaffSize(0, 0.7) // the UPPER staff is small; the lower stays full size
    await h.render()
    const staves = h.staves().filter(stave => stave.measure === 2)
    const upper = staves.find(stave => stave.staff === 0)!
    const lower = staves.find(stave => stave.staff === 1)!
    // ⚠️ ONE unit for both staves, and it is the FULL staff's space — a small staff's own space is
    // 0.7 of it, so measuring each staff in its own would make any two positions agree by
    // construction, which is the trap this whole test is about.
    const space = (lower.bottom - lower.top) / 4
    const headsOf = (staffIndex: number) =>
      h.placed(`g.vf-measure[id="vf-m2-s${staffIndex}"] .vf-notehead text`)
        .map(g => (g.x - upper.x1) / space)
        .sort((a, b) => a - b)
    const noteStart = (staff: number) =>
      (h.engine.getElementRegistry().getStaffGeometry(2, staff)!.noteStartX - upper.x1) / space
    return {
      upper: headsOf(0),
      lower: headsOf(1),
      lines: [upper.bottom - upper.top, lower.bottom - lower.top],
      noteStart: [noteStart(0), noteStart(1)],
    }
  })

  console.log(`[census] small staff: upper ${drawn.upper.map(x => x.toFixed(2)).join(' ')} · ` +
    `lower ${drawn.lower.map(x => x.toFixed(2)).join(' ')} · note starts ${drawn.noteStart.map(x => x.toFixed(2)).join(' ')}`)
  // The premise: the upper staff really is drawn small. Without it the rest passes vacuously.
  expect(drawn.lines[0], 'the upper staff is 0.7 of the lower').toBeCloseTo(drawn.lines[1] * 0.7, 1)
  expect(drawn.upper, 'four quarters above').toHaveLength(4)
  expect(drawn.lower, 'four quarters below').toHaveLength(4)
  // The music starts at one x for the SYSTEM — the small staff's own header is narrower, and the
  // slack sits after it rather than pulling its music left.
  expect(drawn.noteStart[0], 'one note start for the system').toBeCloseTo(drawn.noteStart[1], 1)
  for (const [i, x] of drawn.upper.entries()) {
    expect(x, `beat ${i} agrees across the staves`).toBeCloseTo(drawn.lower[i], 1)
  }
})
