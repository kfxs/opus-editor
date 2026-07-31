import { test, expect } from './fixtures'

/**
 * The BARLINE GAP — how far a bar's last element stands off the line that ends it, authored on top
 * of the engraver's own `space-to-barline` (`BarlineSpaceOverride`, `Shift+←/→`).
 *
 * ⚠️ Everything here needs a REAL layout: the gap is bought from the line's justification, and
 * whether the neighbours can pay depends on measured widths that are all zero in jsdom.
 *
 * ⚠️ **`placed`/`staves`, never `noteheads`/`barlines`, for anything asserted after a NUDGE.** A bar
 * whose shape has not changed is reused and *translated* (`replaySnapshot`), so its glyphs keep the
 * coordinates they were drawn at: a raw `x` attribute reports where the bar USED to be. Reading
 * those had me believing the notes stood still while the whole line had moved under them.
 *
 * ⚠️ And an x is not an address on its own — **bar 1 of every system starts at the same x.** Every
 * reader here filters by the staff's vertical band too.
 */

/** Fourteen bars of four quarters — enough that the FIRST system is full, and so justified. */
async function justifiedLine(score: import('@playwright/test').Page) {
  await score.evaluate(async () => {
    const h = window.__h
    while (h.engine.getScore().measures.length < 14) h.engine.addMeasure()
    for (let m = 1; m <= 14; m++) {
      for (const b of [0, 1, 2, 3]) {
        h.engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'q', measure: m, beat: h.frac(b, 1) })
      }
    }
    await h.render()
  })
}

/**
 * The first system as drawn: its bars, and bar 1's noteheads with the gaps between them.
 *
 * Source TEXT, not a function: a `page.evaluate` callback is serialised and sent to the browser, so
 * a helper closed over in Node simply is not there when it runs.
 */
const READ = `() => {
  const h = window.__h
  const line = h.staves().filter(s => s.top === h.staves()[0].top).sort((a, b) => a.measure - b.measure)
  const bar = line[0]
  const heads = h.placed('g.vf-notehead text')
    .filter(g => {
      const n = parseInt((g.code || '').toLowerCase(), 16)
      return n >= 0xe0a0 && n <= 0xe0ff
        && g.x > bar.x1 && g.x < bar.x2 && g.y > bar.top - 40 && g.y < bar.bottom + 40
    })
    .map(g => g.x).sort((a, b) => a - b)
  return {
    bars: line.map(s => ({ bar: s.measure, x1: s.x1, x2: s.x2 })),
    heads,
    noteGap: heads.length > 1 ? heads[1] - heads[0] : 0,
    toBarline: bar.x2 - heads[heads.length - 1],
  }
}`

type Line = {
  bars: { bar: number; x1: number; x2: number }[]
  heads: number[]
  noteGap: number
  toBarline: number
}

test('⭐ the gap opens at the BARLINE, and the bar keeps its own spacing', async ({ score }) => {
  await justifiedLine(score)
  const out = await score.evaluate(async (src) => {
    const read = eval(src) as () => Line
    const before = read()
    const stored = window.__h.engine.nudgeBarlineSpace(1, 4) // four staff spaces = 40px
    await window.__h.render()
    return { before, after: read(), stored }
  }, READ) as { before: Line; after: Line; stored: number }

  expect(out.stored, 'the ask was stored').toBe(4)

  // 1. ⭐ The room lands where it was asked for: at the END of the bar. Not quite the full 40px —
  //    a justified bar pays for part of its own growth (the bar-width inversion again) — but most
  //    of it, and never MORE than was asked, which is the property that keeps the gesture honest.
  const opened = out.after.toBarline - out.before.toBarline
  expect(opened, 'most of the 4-space ask arrived at the barline').toBeGreaterThan(30)
  expect(opened, 'and never more than was asked for').toBeLessThanOrEqual(41)

  // 2. ⭐ …and NOT in the music. This is what makes it a gap rather than a bar width: the notes keep
  //    their spacing. They tighten by a hair, because a justified bar cannot take 40px from the line
  //    for nothing — the same inversion the bar-width gesture documents — but by a fraction of it.
  expect(out.after.heads[0], 'the first note has not moved at all').toBeCloseTo(out.before.heads[0], 1)
  const musicMoved = Math.abs(out.after.noteGap - out.before.noteGap)
  expect(musicMoved, 'the note-to-note spacing barely changes').toBeLessThan(3)
  expect(musicMoved * 5, 'the barline gap changes by far more than the music does')
    .toBeLessThan(out.after.toBarline - out.before.toBarline)

  // 3. The line still ends exactly where it did: the room was TRANSFERRED, not added.
  const right = (l: Line) => l.bars[l.bars.length - 1].x2
  expect(right(out.after), 'the system is justified to the same width').toBeCloseTo(right(out.before), 1)

  // 4. …and every later bar on the line gave a little of itself up.
  for (let i = 1; i < out.before.bars.length; i++) {
    const was = out.before.bars[i].x2 - out.before.bars[i].x1
    const now = out.after.bars[i].x2 - out.after.bars[i].x1
    expect(now, `bar ${out.after.bars[i].bar} paid its share`).toBeLessThan(was)
  }
})

test('tightening stops at the measured floor — the barline never reaches the last glyph', async ({ score }) => {
  await justifiedLine(score)
  const out = await score.evaluate(async (src) => {
    const read = eval(src) as () => Line
    const h = window.__h
    const start = { gap: read().toBarline, room: h.engine.barlineGapRoom(1) }
    // Ask for far more than there is.
    for (let i = 0; i < 12; i++) { h.engine.nudgeBarlineSpace(1, -1); await h.render() }
    const floored = { gap: read().toBarline, room: h.engine.barlineGapRoom(1), stored: h.engine.getBarlineSpace(1) }
    // One more press changes nothing at all.
    h.engine.nudgeBarlineSpace(1, -1)
    await h.render()
    return { start, floored, after: { gap: read().toBarline, stored: h.engine.getBarlineSpace(1) } }
  }, READ) as {
    start: { gap: number; room: number | null }
    floored: { gap: number; room: number | null; stored: number }
    after: { gap: number; stored: number }
  }

  expect(out.start.room, 'there was room to give').toBeGreaterThan(0)
  expect(out.floored.gap, 'the last glyph still stands clear of the line').toBeGreaterThan(0)
  expect(out.floored.gap, 'and it tightened to do it').toBeLessThan(out.start.gap)
  expect(out.floored.room ?? -1, 'with nothing left to give').toBeCloseTo(0, 1)
  expect(out.after.stored, 'pressing again is a no-op').toBeCloseTo(out.floored.stored, 6)
  expect(out.after.gap, 'so the picture holds still').toBeCloseTo(out.floored.gap, 1)
})

test('reset puts the line back exactly where the engraver had it', async ({ score }) => {
  await justifiedLine(score)
  const out = await score.evaluate(async (src) => {
    const read = eval(src) as () => Line
    const h = window.__h
    const before = read()
    h.engine.nudgeBarlineSpace(1, 3)
    await h.render()
    const widened = read()
    const reset = h.engine.resetBarlineSpace(1)
    await h.render()
    return { before, widened, after: read(), reset, stored: h.engine.getBarlineSpace(1) }
  }, READ) as { before: Line; widened: Line; after: Line; reset: boolean; stored: number }

  expect(out.reset, 'there was something to reset').toBe(true)
  expect(out.stored).toBe(0)
  expect(out.widened.toBarline, 'it really had opened').toBeGreaterThan(out.before.toBarline + 10)
  expect(out.after.toBarline, 'and closed again exactly').toBeCloseTo(out.before.toBarline, 1)
  for (let i = 0; i < out.before.bars.length; i++) {
    expect(out.after.bars[i].x1, `bar ${out.before.bars[i].bar} is back`).toBeCloseTo(out.before.bars[i].x1, 1)
    expect(out.after.bars[i].x2).toBeCloseTo(out.before.bars[i].x2, 1)
  }
})
