import { test, expect } from './fixtures'
import type { BarSpacing } from './harness'

/**
 * The spacing model, measured on the page (docs/spacing-model-plan.md).
 *
 * These five fixtures started life as P0 — *"measure the present"*, the before nothing could be
 * called an improvement without (docs/spacing-model-research.md §6). **P2 inverted them**, which was
 * always the plan: the assertions below are the same four questions asked of a bar's ROOM, and every
 * one of them now has Gould's answer where it used to have a constant's.
 *
 * | fixture | room, before | room, after | Gould wants |
 * |---|---|---|---|
 * | 16 × 𝅘𝅥𝅯 | 32.2 (`MAX_MEASURE_WIDTH`, to the pixel) | 30.5 | 2× the quarters |
 * | 8 × ♪ | 26.1 (ink, phantom flags) | 20.1 | 1.41× the quarters |
 * | 4 × ♩ | 8.3 (`MIN_MEASURE_WIDTH`, to the pixel) | 14.3 | — |
 *
 * ⚠️ **What P2 did NOT change: the gaps INSIDE a bar.** The rule decides how much room a bar asks
 * for; VexFlow's softmax still shares that room out among the bar's columns, and will until P4 takes
 * over x. So a claim about one bar's internal gaps is still a claim about VexFlow — which is why the
 * assertions here are about a bar's ROOM and about RATIOS BETWEEN bars, and why the ratios are the
 * part that moved.
 */

/** `MIN_MEASURE_WIDTH` / `MAX_MEASURE_WIDTH` in the unit the census reports: 10 and 40 spaces. */
const MIN_BAR = 10
const MAX_BAR = 40

/** Gould's quarter — the number the whole model is anchored on (plan §1.1). */
const GOULD_QUARTER = 3.5

/** The census of one bar of one staff, with the numbers logged for the record. */
function bar(census: BarSpacing[], measure: number, label: string): BarSpacing {
  const found = census.find(entry => entry.measure === measure && entry.staff === 0)
  expect(found, `bar ${measure} was drawn`).toBeDefined()
  console.log(
    `[census] ${label}: width ${found!.width} lead ${found!.lead} ` +
      `gaps ${found!.columns.map(column => column.gap.toFixed(2)).join(' ')}`,
  )
  return found!
}

/** Every gap but the last — the last one is the run-out to the barline, a different question. */
const noteGaps = (drawn: BarSpacing): number[] => drawn.columns.slice(0, -1).map(column => column.gap)

/** The room the MUSIC got: the bar less its header, which only the first bar of a system pays. */
const room = (drawn: BarSpacing): number => Math.round((drawn.width - drawn.lead) * 100) / 100

test('a DENSE bar: sixteen 16ths, and the CEILING no longer decides it', async ({ score }) => {
  const census = await score.evaluate(async () => {
    const h = window.__h
    for (let i = 0; i < 16; i++) {
      h.engine.addNoteAtBeat({ step: 'C', octave: 4, duration: '16', measure: 1, beat: h.frac(i, 4) })
    }
    await h.render()
    return h.columnGaps()
  })

  const dense = bar(census, 1, 'dense (16×16th)')
  expect(dense.columns, 'sixteen columns, one per 16th').toHaveLength(16)

  // ⭐ It used to come out at `MAX_MEASURE_WIDTH` to the pixel — the bar's width was a taste about
  //   bars dominating a line, not an answer about music, and `MAX_MEASURE_WIDTH` then had to be
  //   overridden by an `incompressible` floor to stop dense bars spilling through their barlines.
  //   Under the compressed curve a dense bar asks for less than the cap on its own.
  expect(dense.width, 'the bar sits under the cap of its own accord').toBeLessThan(MAX_BAR)

  // Sixteen 16ths of one duration: the curve gives each 1.75 spaces, the provisional ink floor lifts
  // that to 1.8, and the floor binding at the short end is exactly where §1.1 says it should.
  for (const gap of noteGaps(dense)) {
    expect(gap, 'a 16th sits near the short end of the table').toBeGreaterThan(1.7)
    expect(gap).toBeLessThan(2.2)
  }
})

test('⭐ a SPARSE bar: four quarters, and a quarter is now Gould\'s 3½ spaces', async ({ score }) => {
  const census = await score.evaluate(async () => {
    const h = window.__h
    for (const beat of [0, 1, 2, 3]) {
      h.engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: h.frac(beat, 1) })
    }
    await h.render()
    return h.columnGaps()
  })

  const sparse = bar(census, 1, 'sparse (4×quarter)')
  expect(sparse.columns, 'four columns').toHaveLength(4)

  // ⭐ It used to come out pinned at `MIN_MEASURE_WIDTH`, to the pixel, with each quarter drawn 1.94
  //   spaces — barely half of Gould's. Now the bar asks for `4 × 3.5` and gets it.
  expect(sparse.width, 'the floor constant no longer decides it').toBeGreaterThan(MIN_BAR * 1.5)
  // ⚠️ Per-gap, not exactly 3.5: VexFlow's softmax still shares the bar's room among its columns
  //    until P4, and it hands the run-out to the barline less than it hands a note. The ROOM is the
  //    rule's; the split inside it is not yet.
  for (const gap of noteGaps(sparse)) {
    expect(gap, 'a quarter is drawn at about Gould\'s 3½ spaces').toBeGreaterThan(GOULD_QUARTER * 0.9)
    expect(gap).toBeLessThan(GOULD_QUARTER * 1.3)
  }
})

test('⭐⭐ the DEFECT UNDONE: the longer note gets the wider gap, in Gould\'s ratios', async ({ score }) => {
  const census = await score.evaluate(async () => {
    const h = window.__h
    h.engine.addMeasure()
    h.engine.addMeasure()
    for (let i = 0; i < 16; i++) {
      h.engine.addNoteAtBeat({ step: 'C', octave: 4, duration: '16', measure: 1, beat: h.frac(i, 4) })
    }
    for (let i = 0; i < 8; i++) {
      h.engine.addNoteAtBeat({ step: 'C', octave: 4, duration: '8', measure: 2, beat: h.frac(i, 2) })
    }
    for (const beat of [0, 1, 2, 3]) {
      h.engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'q', measure: 3, beat: h.frac(beat, 1) })
    }
    await h.render()
    return h.columnGaps()
  })

  // Three bars on one (ragged) system, so each is at its NATURAL width — no transfer between them.
  const sixteenths = bar(census, 1, '16×16th')
  const eighths = bar(census, 2, '8×8th')
  const quarters = bar(census, 3, '4×quarter')
  console.log(`[census] room (width − lead): ${room(sixteenths)} / ${room(eighths)} / ${room(quarters)}`)

  // ⭐⭐ THE headline. It measured 0.58 before — the shorter note was drawn WIDER, because an
  //     unbeamed eighth carries a flag at width time and ink was the only quantity that varied.
  //     Gould has the quarter 1.56× the eighth; the curve gives √2 = 1.41 and the drawing agrees.
  const ratio = noteGaps(quarters)[0] / noteGaps(eighths)[0]
  expect(ratio, 'the QUARTER is drawn wider than the EIGHTH').toBeGreaterThan(1.2)
  expect(ratio, '…by about the rule\'s √2, not by four').toBeLessThan(1.8)

  // ⭐ And the bar's ROOM says the same thing, which is the half P2 actually owns. Four times the
  //   events is TWICE the room — Gould's answer — where it measured 3.9× before, i.e. ∝ event count.
  expect(room(sixteenths) / room(quarters), 'sixteen 16ths take twice four quarters').toBeCloseTo(2, 0)
  expect(room(eighths) / room(quarters), 'and eight eighths take √2 of them').toBeCloseTo(Math.SQRT2, 1)

  // Neither end is decided by a constant any more.
  expect(sixteenths.width, 'no longer pinned at MAX_MEASURE_WIDTH').toBeLessThan(MAX_BAR)
  expect(quarters.width, 'no longer pinned at MIN_MEASURE_WIDTH').toBeGreaterThan(MIN_BAR * 1.4)
})

test('⏭️ a bar of ACCIDENTALS: the ink buys nothing yet — the gap P3 fills', async ({ score }) => {
  const drawn = await score.evaluate(async () => {
    const h = window.__h
    h.engine.addMeasure()
    // Four different altered pitches, so each really draws a sharp — a repeated C♯ in one bar is
    // spelled once and the rest inherit it.
    const sharps: { step: 'C' | 'D' | 'F' | 'G'; beat: number }[] = [
      { step: 'C', beat: 0 }, { step: 'D', beat: 1 }, { step: 'F', beat: 2 }, { step: 'G', beat: 3 },
    ]
    for (const { step, beat } of sharps) {
      h.engine.addNoteAtBeat({ step, alter: 1, octave: 4, duration: 'q', measure: 1, beat: h.frac(beat, 1) })
    }
    for (const beat of [0, 1, 2, 3]) {
      h.engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'q', measure: 2, beat: h.frac(beat, 1) })
    }
    await h.render()
    return { census: h.columnGaps(), sharps: h.glyphs('g.vf-notehead text').filter(g => g.code === 'e262').length }
  })

  expect(drawn.sharps, 'four sharps really are drawn').toBe(4)
  const accidental = bar(drawn.census, 1, 'accidentals (4×quarter, all sharp)')
  const plain = bar(drawn.census, 2, 'plain (4×quarter)')
  expect(accidental.columns).toHaveLength(4)

  // ⚠️ **This is the phase's known gap, pinned so P3 turns it red.** Both bars now ask for exactly
  //    the same room, because the rule is the whole answer and the rule cannot see a sharp: the ink
  //    half does not exist until extents arrive. It is a real change of behaviour and not obviously
  //    for the better — before P2 an accidental bought its room through `preCalculateMinTotalWidth`,
  //    and a quarter with a sharp came out at 3.75 spaces against a bare quarter's 1.94.
  //
  //    ⭐ What makes it safe to ship meanwhile is the direction of the trade: the bare quarter went
  //    UP to 3.5 while the sharpened one came DOWN to the same 3.5, so an accidental now sits inside
  //    a gap almost twice as wide as the one it used to have to fight for. It is under-served, not
  //    collided. P3 turns the pair-padding constant into a measured extent and this assertion flips.
  expect(noteGaps(accidental)[0], 'the ink cannot be seen at all yet').toBeCloseTo(noteGaps(plain)[0], 1)
  expect(noteGaps(accidental)[0], '…but the gap it sits in is a whole quarter\'s')
    .toBeGreaterThan(GOULD_QUARTER * 0.9)
})

test('a bar with a FAN: its members are columns, and the run-out after it closed up', async ({ score }) => {
  const drawn = await score.evaluate(async () => {
    const h = window.__h
    const note = h.engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'h', measure: 1, beat: h.frac(0, 1) })
    h.engine.setFan(note!.id, { direction: 'accel', count: 6, beams: 3 })
    await h.render()
    return { census: h.columnGaps(), slots: h.engine.getScore().measures[0].slots.length }
  })

  const fanned = bar(drawn.census, 1, 'fan (accel ×6, half note) + rest fill')
  const members = fanned.columns.slice(0, 6).map(column => column.gap)
  console.log(`[census] fan members: ${members.slice(0, -1).map(g => g.toFixed(2)).join(' ')} (${drawn.slots} slots in the model)`)
  for (const [i, gap] of members.slice(1, -1).entries()) {
    expect(gap, 'the heads crowd together — the fan draws its own spacing').toBeLessThanOrEqual(members[i] + 0.01)
  }

  // ⭐ The gap after the group. It measured **8.35** spaces of empty run-out to the barline, against
  //   the 1.80 the half rest was jammed into — the boundary nobody owned. The rest's own column now
  //   earns a half note's space from the rule, so the bar stops sprawling. P5 finishes the job by
  //   making the fan's own span the model's too (`fanRoom.ts` still buys it with `fanColumns`).
  const toBarline = fanned.columns[fanned.columns.length - 1].gap
  expect(toBarline, 'the run-out is no longer several times the whole ramp').toBeLessThan(6)
})
