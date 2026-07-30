import { test, expect } from './fixtures'
import type { BarSpacing } from './harness'

/**
 * The spacing model, measured on the page (docs/spacing-model-plan.md).
 *
 * These fixtures started life as P0 — *"measure the present"*, the before nothing could be called an
 * improvement without (docs/spacing-model-research.md §6). **P2 inverted them**, which was always the
 * plan, and **P3 added the ink**: every assertion below now has Gould's answer where it used to have
 * a constant's.
 *
 * | fixture | room, before | room, after | the rule wants |
 * |---|---|---|---|
 * | 16 × 𝅘𝅥𝅯 | 32.2 (`MAX_MEASURE_WIDTH`, to the pixel) | 30.0 | 2× the quarters |
 * | 8 × ♪ | 26.1 (ink, counting flags never drawn) | 19.2 | 4/3 × the quarters |
 * | 4 × ♩ | 8.3 (`MIN_MEASURE_WIDTH`, to the pixel) | 14.4 | — |
 *
 * ⚠️ The rule is **LilyPond's**, his call by eye — a log law, so each doubling adds 1.2 staff spaces
 * rather than multiplying by √2. See `engine/layout/spacing.ts` for the two curves side by side.
 *
 * The last three tests are P3's: the ink is a MINIMUM under the rule (so a sharpened quarter is
 * spaced exactly like a bare one, and a sharpened 16th is not), the BARLINE is a column with a pair
 * of its own, and the table of measured extents still matches what the browser draws.
 *
 * ⚠️ **What none of it changes yet: the gaps INSIDE a bar.** The rule decides how much room a bar
 * asks for; VexFlow's softmax still shares that room out among its columns, and will until P4 takes
 * over x. So a claim about one bar's internal gaps is still partly a claim about VexFlow — which is
 * why the assertions here are about a bar's ROOM and about RATIOS BETWEEN bars.
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

/**
 * ⚠️ Every fixture below is on **B4, the middle line** — never C4, which these tests used until
 * P3.1 put LEDGER LINES in the ink model. C4 in treble sits on a ledger, which is 0.67 staff spaces
 * wider than a bare notehead, so a "sixteen 16ths" fixture on C4 measures sixteen ledger lines and
 * not the duration rule these tests are about. The ledger case has its own test at the bottom.
 */

/** The room the MUSIC got: the bar less its header, which only the first bar of a system pays. */
const room = (drawn: BarSpacing): number => Math.round((drawn.width - drawn.lead) * 100) / 100

test('a DENSE bar: sixteen 16ths, and the CEILING no longer decides it', async ({ score }) => {
  const census = await score.evaluate(async () => {
    const h = window.__h
    for (let i = 0; i < 16; i++) {
      h.engine.addNoteAtBeat({ step: 'B', octave: 4, duration: '16', measure: 1, beat: h.frac(i, 4) })
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

  // Sixteen 16ths of one duration: the curve gives each 1.8 spaces and the ink asks for 1.43, so
  // here the RULE is the wider of the two and the ink is a floor under the water. Under LilyPond's
  // curve it stays under: a 32nd earns 1.5 and only a 64th (1.35) lets the notehead show through.
  for (const gap of noteGaps(dense)) {
    expect(gap, 'a 16th sits near the short end of the table').toBeGreaterThan(1.7)
    expect(gap).toBeLessThan(2.2)
  }
})

test('⭐ a SPARSE bar: four quarters, and a quarter is now Gould\'s 3½ spaces', async ({ score }) => {
  const census = await score.evaluate(async () => {
    const h = window.__h
    for (const beat of [0, 1, 2, 3]) {
      h.engine.addNoteAtBeat({ step: 'B', octave: 4, duration: 'q', measure: 1, beat: h.frac(beat, 1) })
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
    expect(gap, 'a quarter is drawn at about 3½ spaces').toBeGreaterThan(GOULD_QUARTER * 0.9)
    expect(gap).toBeLessThan(GOULD_QUARTER * 1.3)
  }
})

test('⭐⭐ the DEFECT UNDONE: the longer note gets the wider gap, in the RULE\'s ratios', async ({ score }) => {
  const census = await score.evaluate(async () => {
    const h = window.__h
    h.engine.addMeasure()
    h.engine.addMeasure()
    for (let i = 0; i < 16; i++) {
      h.engine.addNoteAtBeat({ step: 'B', octave: 4, duration: '16', measure: 1, beat: h.frac(i, 4) })
    }
    for (let i = 0; i < 8; i++) {
      h.engine.addNoteAtBeat({ step: 'B', octave: 4, duration: '8', measure: 2, beat: h.frac(i, 2) })
    }
    for (const beat of [0, 1, 2, 3]) {
      h.engine.addNoteAtBeat({ step: 'B', octave: 4, duration: 'q', measure: 3, beat: h.frac(beat, 1) })
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
  // ⭐⭐ The drawn ratio is the RULE's now, not an approximation of it. It measured 0.58 before the
  //     model — the shorter note drawn WIDER, on the strength of a flag that is never emitted.
  //     ⚠️ 1.5, not √2: the rule that ships is LilyPond's log law, where each doubling ADDS 1.2
  //     staff spaces rather than multiplying, so 3.6 ÷ 2.4 = 1.5 here and 2.4 ÷ 1.8 = 1.33 one
  //     step down. A power law would give the same number at every step; a log law does not, and
  //     that is precisely what keeps dense music from being squeezed (`spacing.ts`).
  expect(noteGaps(quarters)[0], 'LilyPond\'s quarter').toBeCloseTo(3.6, 1)
  expect(noteGaps(eighths)[0], '…and its eighth').toBeCloseTo(2.4, 1)
  // ⚠️ Within 4% rather than to the hundredth: this bar OPENS the system, so it carries the clef
  //    and meter and takes a slightly larger justified share than the two mid-line bars do.
  expect(noteGaps(sixteenths)[0] / 1.8, '…and its 16th').toBeCloseTo(1, 1)

  // ⭐ And the bar's ROOM says the same thing, which is the half P2 actually owns. Four times the
  //   events is TWICE the room — Gould's answer — where it measured 3.9× before, i.e. ∝ event count.
  expect(room(sixteenths) / room(quarters), 'sixteen 16ths take twice four quarters').toBeCloseTo(2, 0)
  expect(room(eighths) / room(quarters), 'and eight eighths take 4/3 of them').toBeCloseTo(4 / 3, 1)

  // Neither end is decided by a constant any more.
  expect(sixteenths.width, 'no longer pinned at MAX_MEASURE_WIDTH').toBeLessThan(MAX_BAR)
  expect(quarters.width, 'no longer pinned at MIN_MEASURE_WIDTH').toBeGreaterThan(MIN_BAR * 1.4)
})

test('⭐ a bar of ACCIDENTALS: the ink is a MINIMUM under the rule, not a replacement for it', async ({ score }) => {
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
      h.engine.addNoteAtBeat({ step: 'B', octave: 4, duration: 'q', measure: 2, beat: h.frac(beat, 1) })
    }
    await h.render()
    return { census: h.columnGaps(), sharps: h.glyphs('g.vf-notehead text').filter(g => g.code === 'e262').length }
  })

  expect(drawn.sharps, 'four sharps really are drawn').toBe(4)
  const accidental = bar(drawn.census, 1, 'accidentals (4×quarter, all sharp)')
  const plain = bar(drawn.census, 2, 'plain (4×quarter)')
  expect(accidental.columns).toHaveLength(4)

  // ⭐⭐ The `max` at the heart of the model, seen from the side nobody expects: at a QUARTER the two
  //     bars still come out the SAME, because a sharp plus a notehead plus their padding is 2.88
  //     spaces and the rule already gives 3.5. The ink is a floor, and this floor is under the water.
  //     ⚠️ That is the opposite of what the old ink path did — it spaced the sharpened bar at 3.75
  //     and the bare one at 1.94, i.e. the ink REPLACED the rule wherever it appeared.
  // ⚠️ Within 10%, not to the pixel: the sharpened bar is a little wider because its FIRST note's
  //    sign lands in the bar's LEAD-IN, which is pure ink with no duration rule over it, so that one
  //    is paid for in full (P3.2). The three MID-BAR signs cost nothing, which is the claim.
  expect(noteGaps(accidental)[0] / noteGaps(plain)[0], 'the same duration gets the same room, sharp or not')
    .toBeLessThan(1.1)
  expect(noteGaps(plain)[0]).toBeGreaterThan(GOULD_QUARTER * 0.9)
})

test('⭐ …and the ink WINS where the rule runs out: sharpened 16ths buy their own room', async ({ score }) => {
  const drawn = await score.evaluate(async () => {
    const h = window.__h
    h.engine.addMeasure()
    // Sixteen 16ths climbing chromatically, so nearly every one draws its own accidental — at a 16th
    // the rule gives 1.75 spaces and a sharp needs 2.88, so here the ink is what decides.
    const steps = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const
    for (let i = 0; i < 16; i++) {
      h.engine.addNoteAtBeat({ step: steps[i % 7], alter: i % 2 === 0 ? 1 : -1, octave: 4 + Math.floor(i / 7), duration: '16', measure: 1, beat: h.frac(i, 4) })
    }
    for (let i = 0; i < 16; i++) {
      h.engine.addNoteAtBeat({ step: 'B', octave: 4, duration: '16', measure: 2, beat: h.frac(i, 4) })
    }
    await h.render()
    return { census: h.columnGaps(), signs: h.glyphs('g.vf-notehead text').filter(g => g.code === 'e262' || g.code === 'e260').length }
  })

  expect(drawn.signs, 'the bar really is full of accidentals').toBeGreaterThan(8)
  const chromatic = bar(drawn.census, 1, 'chromatic 16ths')
  const plain = bar(drawn.census, 2, 'plain 16ths')
  expect(room(chromatic) / room(plain), 'the accidentals bought room the duration rule would not have')
    .toBeGreaterThan(1.3)
})

test('⭐ the BARLINE is a column: the last note of a dense bar stands off the line', async ({ score }) => {
  const census = await score.evaluate(async () => {
    const h = window.__h
    for (let i = 0; i < 16; i++) {
      h.engine.addNoteAtBeat({ step: 'B', octave: 4, duration: '16', measure: 1, beat: h.frac(i, 4) })
    }
    await h.render()
    return h.columnGaps()
  })

  // A 16th earns 1.75 spaces from the rule; a notehead plus note↔barline needs 2.13, so the run-out
  // is the ink's answer and not the rule's. It used to be `BARLINE_PADDING`, a constant that knew
  // nothing about what was in front of it.
  const dense = bar(census, 1, 'dense, at the barline')
  const gaps = dense.columns.map(column => column.gap)
  const toBarline = gaps[gaps.length - 1]
  expect(toBarline, 'the last 16th is not jammed against the line').toBeGreaterThan(2.1)
  expect(toBarline, '…and it is wider than the gaps between the notes').toBeGreaterThan(gaps[0])
})

test('⭐⭐ the INK TABLE still matches the drawing — the anti-drift gate', async ({ score }) => {
  // `engine/layout/spacingPadding.ts` is a table of numbers measured off this drawing and then
  // written down, which makes every one of them a PREDICTION from that moment on. This re-measures
  // them. ⛔ If it fails, the table is wrong and the width path is spacing for ink that is not there.
  const drawn = await score.evaluate(async () => {
    const h = window.__h
    const table = h.ink()
    const space = () => { const s = h.staves()[0]; return (s.bottom - s.top) / 4 }
    const clear = () => {
      for (const slot of [...h.engine.getScore().measures[0].slots]) {
        for (const note of (slot as { notes?: { id: string }[] }).notes ?? []) h.engine.deleteNote(note.id)
      }
    }

    // A SECOND: the displaced head sits exactly one notehead to the right of the other.
    h.engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: h.frac(0, 1) })
    h.engine.addChordNote({ step: 'D', octave: 4, duration: 'q', measure: 1, beat: h.frac(0, 1) })
    await h.render()
    const heads = h.noteheads()
    const notehead = (heads[1].x - heads[0].x) / space()
    clear()

    // One sharp, then two a third apart: how far left of the head does the ink reach?
    const sharpsAt = async (steps: ('C' | 'E')[]): Promise<number> => {
      h.engine.addNoteAtBeat({ step: steps[0], octave: 4, duration: 'q', measure: 1, beat: h.frac(0, 1), alter: 1, forceAccidental: true })
      for (const step of steps.slice(1)) {
        h.engine.addChordNote({ step, octave: 4, duration: 'q', measure: 1, beat: h.frac(0, 1), alter: 1, forceAccidental: true })
      }
      await h.render()
      const head = h.noteheads()[0].x
      const leftmost = Math.min(...h.glyphs('g.vf-notehead text').filter(g => g.code === 'e262').map(g => g.x))
      const reach = (head - leftmost) / space()
      clear()
      return reach
    }
    const one = await sharpsAt(['C'])
    const two = await sharpsAt(['C', 'E'])

    // One dot and two: where does each land, past the head?
    h.engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: h.frac(0, 1), dots: 2 })
    await h.render()
    const head = h.noteheads()[0].x
    const dots = h.glyphs('g.vf-notehead text').filter(g => g.code === 'e1e7').map(g => (g.x - head) / space())

    return { table: { notehead: table.notehead, one: table.sharps(1), two: table.sharps(2), dot1: table.dots(1), dot2: table.dots(2) }, notehead, one, two, dots }
  })

  console.log('[census] ink table vs drawing:', JSON.stringify(drawn))
  expect(drawn.notehead, 'a notehead\'s own width').toBeCloseTo(drawn.table.notehead, 1)
  expect(drawn.one, 'one sharp reaches this far left').toBeCloseTo(drawn.table.one, 1)
  expect(drawn.two, 'two sharps a third apart stack into two columns').toBeCloseTo(drawn.table.two, 1)
  // The table counts to the FAR side of the last dot; the drawing anchors each dot at its near side.
  expect(drawn.dots[0] + 0.4, 'the first dot').toBeCloseTo(drawn.table.dot1, 1)
  expect(drawn.dots[1] + 0.4, 'and the second').toBeCloseTo(drawn.table.dot2, 1)
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

test('⭐⭐ P4: SILENCE gets the room its duration earns, not the room left over', async ({ score }) => {
  // His report, on a bar of sixteen 32nds followed by a half rest: *"the rest is too close, there is
  // no proportion with the written and the remaining space that is in silence — for the musician
  // this is not intuitive."* Measured, the silence had **9% of the bar's width for 50% of its time**.
  //
  // ⚠️ Gould's rule does NOT make space proportional to duration — a compressed curve deliberately
  //    gives a half rest less than four times a 32nd's. But it gives it `3.5 × √2` = 4.95 spaces,
  //    and VexFlow's softmax was giving it 2.68.
  const drawn = await score.evaluate(async () => {
    const h = window.__h
    const steps = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const
    for (let i = 0; i < 16; i++) {
      h.engine.addNoteAtBeat({ step: steps[i % 7], octave: 4 + Math.floor(i / 7), duration: '32', measure: 1, beat: h.frac(i, 8) })
    }
    await h.render()
    return h.columnGaps()[0]
  })

  const gaps = drawn.columns.map(column => column.gap)
  const silence = gaps[gaps.length - 1]
  console.log(`[census] 32nds then a half rest: ${gaps.map(g => g.toFixed(2)).join(' ')}`)

  // The rest fills beats 2–4, so the rule owes its column `followingSpace(2 quarters)` = 4.95.
  expect(silence, 'the half rest earns a half note\'s space').toBeGreaterThan(4.4)
  expect(silence, 'and the notes are still the bulk of the bar — the curve is compressed')
    .toBeLessThan(drawn.width / 3)
})

test('⭐⭐ LEDGER LINES no longer draw on top of each other (P3.1)', async ({ score }) => {
  // His report, reduced: sixteen 32nds climbing C4→D6, so the run starts and ends on ledger lines.
  // A ledger is 1.80 staff spaces wide; before P3.1 the model gave those notes a bare notehead's
  // 1.13, the gaps came out at 1.64, and consecutive ledgers overlapped by 0.16 — they read as one
  // long line drawn through the notes.
  const drawn = await score.evaluate(async () => {
    const h = window.__h
    const steps = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const
    for (let i = 0; i < 16; i++) {
      h.engine.addNoteAtBeat({ step: steps[i % 7], octave: 4 + Math.floor(i / 7), duration: '32', measure: 1, beat: h.frac(i, 8) })
    }
    await h.render()
    const stave = h.staves()[0]
    const space = (stave.bottom - stave.top) / 4
    const ledgers = h.segments('g.vf-notehead path, g.vf-stavenote path')
      .filter(line => Math.abs(line.y1 - line.y2) < 0.01)
      .map(line => ({ x1: line.x1 / space, x2: line.x2 / space, y: Math.round(line.y1) }))

    let worst = 0
    for (const a of ledgers) {
      for (const b of ledgers) {
        if (a === b || a.y !== b.y || b.x1 <= a.x1) continue
        worst = Math.max(worst, a.x2 - b.x1)
      }
    }
    const width = ledgers.length > 0 ? ledgers[0].x2 - ledgers[0].x1 : 0
    return { count: ledgers.length, width, worst, census: h.columnGaps()[0] }
  })

  expect(drawn.count, 'the run really does draw ledger lines').toBeGreaterThan(4)
  expect(drawn.width, 'and each is 1.8 staff spaces — wider than the notehead it carries')
    .toBeCloseTo(1.8, 1)
  // ⭐ It was **0.16 spaces of overlap** before P3.1 — the ledgers genuinely crossed. It is now
  //   0.03, i.e. they touch by a quarter of a pixel and no longer draw through each other.
  //   ⏭️ Not exactly zero because the BAR is now wide enough while the split INSIDE it is still
  //   VexFlow's even share: the model asks 2.15 spaces for a ledgered pair and 1.43 for a bare one,
  //   and VexFlow gives every 32nd the same gap. P4 takes that over and this becomes a hard 0.
  expect(drawn.worst, '⭐ ledger lines no longer draw through each other').toBeLessThan(0.05)

  console.log(`[census] ledgered 32nds: width ${drawn.census.width} gaps ${drawn.census.columns.map(c => c.gap.toFixed(2)).join(' ')}`)
})

test('⭐⭐ the SAME DURATION is drawn the same width across a system', async ({ score }) => {
  // The consistency rule MuseScore 4's whole rewrite existed to establish
  // (docs/spacing-model-research.md §4), and the bug he found by eye: *"bar 1 is not dense at all…
  // there is a lot of space in the line"*. Measured on his own fragment, one line, two bars of the
  // same music — a quarter came out **4.28** staff spaces in the opening bar and **3.96** two bars
  // later. 8% apart, for the same note.
  //
  // ⭐ The cause was in `distributeLineWidths`: a line's surplus was shared in proportion to each
  //   bar's TOTAL width, and then only its MUSIC could absorb it — a clef is 4.5 spaces whether the
  //   line is justified or not. So a bar's music actually stretched by `k + (k−1) × overhead/music`,
  //   and the more clef and meter a bar carried the more its notes were pulled apart. The surplus is
  //   shared by `natural − overhead` now, so every bar's music stretches by the same factor.
  const drawn = await score.evaluate(async () => {
    const h = window.__h
    while (h.engine.getScore().measures.length < 14) h.engine.addMeasure()
    for (let measure = 1; measure <= 14; measure++) {
      for (const beat of [0, 1, 2, 3]) {
        h.engine.addNoteAtBeat({ step: 'B', octave: 4, duration: 'q', measure, beat: h.frac(beat, 1) })
      }
    }
    await h.render()
    const staves = h.staves()
    const line = staves.filter(stave => stave.top === staves[0].top).map(stave => stave.measure)
    return h.columnGaps().filter(bar => line.includes(bar.measure))
      .map(bar => ({ measure: bar.measure, lead: bar.lead, quarter: bar.columns[0].gap }))
  })

  console.log(`[census] one quarter, bar by bar: ${drawn.map(b => `m${b.measure}=${b.quarter.toFixed(3)}`).join(' ')}`)
  expect(drawn.length, 'several bars share the line').toBeGreaterThan(3)

  // ⭐ Every bar that carries NO header draws the quarter identically — to three decimals.
  const midLine = drawn.filter(bar => bar.measure > 1)
  for (const bar of midLine) {
    expect(bar.quarter, `bar ${bar.measure} matches bar ${midLine[0].measure}`)
      .toBeCloseTo(midLine[0].quarter, 3)
  }

  // ⏭️ The system-OPENING bar is still a little wider, and by a known amount that is NOT this bug:
  //    we reserve `CLEF_WIDTH + TIME_SIG_WIDTH` for the header while VexFlow places the glyphs and
  //    needs about 0.9 staff spaces less, and the difference lands in that bar's music. That is the
  //    header-as-columns work (docs/vexflow-boundary.md, priority 2) — pinned here at 6% so it
  //    cannot quietly grow, and so that finishing it turns this line green at a tighter tolerance.
  expect(drawn[0].quarter / midLine[0].quarter, 'the opening bar, still carrying the header gap')
    .toBeLessThan(1.06)
})

test('⭐ a whole-bar REST is centred between its own barlines', async ({ score }) => {
  // His report, by eye: *"in empty bars the rest… seems to me slightly to the right"*. He was right,
  // and by 0.65 staff spaces — six and a half pixels, on a bar with a line at each end.
  //
  // ⭐ The cause was one word. `centerMeasureRests` centred on `noteStartOf(stave)`, which is where a
  //   NOTE's ink begins and therefore carries the `Stave.padding` VexFlow adds to every note; the
  //   bound a reader actually judges a whole-bar rest against is the barline. `getNoteStartX()` is
  //   that — `applyLeadIn` sets it to the bar's own x when there is no header to sit after.
  const drawn = await score.evaluate(async () => {
    const h = window.__h
    while (h.engine.getScore().measures.length < 6) h.engine.addMeasure()
    await h.render()
    const staves = h.staves()
    const space = (staves[0].bottom - staves[0].top) / 4
    const rests = h.rests()
    return staves.slice(0, 5).map(stave => {
      const rest = rests.find(glyph => glyph.x > stave.x1 && glyph.x < stave.x2)!
      // ⚠️ `inkSizes` is a text layout box, so its WIDTH is used as a size and never as a position —
      //    which is exactly what centring needs (half a glyph), and why it is safe here.
      const box = h.inkSizes('g.vf-notehead text').find(b => b.x > stave.x1 && b.x < stave.x2)!
      const centre = rest.x + box.width / 2
      return { measure: stave.measure, off: (centre - (stave.x1 + stave.x2) / 2) / space }
    })
  })

  console.log(`[census] measure rests, off the bar's centre: ${drawn.map(b => b.off.toFixed(2)).join(' ')}`)

  // ⭐ Every bar that draws no header: dead centre, to within a pixel.
  for (const bar of drawn.filter(b => b.measure > 1)) {
    expect(Math.abs(bar.off), `bar ${bar.measure} is centred`).toBeLessThan(0.1)
  }

  // ⏭️ And bar 1 is NOT, deliberately: it centres in the room left after its clef and meter, which is
  //    what Gould describes and what this pass has always done. Centring it between the barlines
  //    would put the rest under the clef.
  expect(drawn[0].off, 'the system-opening bar centres after its header').toBeGreaterThan(2)
})
