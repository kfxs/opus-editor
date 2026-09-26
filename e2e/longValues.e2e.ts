/**
 * ⭐ docs/plans/other-durations-plan.md P4 — the BREVE and the LONGA in a real browser, with the font measured.
 *
 * - the breve: its round (or square) head, no stem;
 * - the longa: its square head and a stem — up or down by the normal rule, and a DOWN stem on the head's
 *   RIGHT edge by default (`'right'`, Verovio), on its LEFT under `'normal'`;
 * - a whole-bar rest in 4/2: the BREVE rest, standing on the middle line and filling the space above it.
 *
 * 🚨 A `<text>`'s client rect is its EM box — a glyph is located by its anchor plus the font's own box
 * (`fonts/fontMetrics.glyphBox`), as `shortValues.e2e.ts` does.
 */
import { test, expect } from './fixtures'
import { glyphBox } from '../src/engine/fonts/fontMetrics'

type Page = Parameters<Parameters<typeof test>[1]>[0]['score']

async function drawBar(
  score: Page, ts: [number, number], note: { duration: string; step: string; octave: number } | null,
  rows: { breveHead?: string; longaHead?: string; longaStem?: string; barRest?: string } = {},
) {
  return score.evaluate(async ({ ts, note, rows }) => {
    const h = window.__h
    h.longValues(rows)
    for (const slot of [...h.engine.getScore().measures[0].slots]) {
      for (const n of (slot as { notes?: { id: string }[] }).notes ?? []) h.engine.deleteNote(n.id)
    }
    h.engine.setTimeSignature(1, { numerator: ts[0], denominator: ts[1] })
    if (note) h.engine.addNoteAtBeat({ step: note.step, octave: note.octave, duration: note.duration as never, measure: 1, beat: h.frac(0, 1) })
    await h.render()
    const stave = h.staves().find(s => s.measure === 1)!
    const glyphs = h.glyphs('g.notehead text').map(g => ({ ...g, code: parseInt(g.code, 16) }))
    return {
      space: (stave.bottom - stave.top) / 4, top: stave.top, bottom: stave.bottom,
      stems: h.stems(),
      heads: glyphs.filter(g => g.code >= 0xe0a0 && g.code <= 0xe0ff),
      rests: glyphs.filter(g => g.code >= 0xe4e0 && g.code <= 0xe4ff),
    }
  }, { ts, note, rows })
}

test.afterEach(async ({ score }) => {
  await score.evaluate(() => window.__h.longValues({}))
})

test('⭐ the breve: its round head, then the square one — and never a stem', async ({ score }) => {
  for (const shape of ['round', 'square'] as const) {
    const bar = await drawBar(score, [4, 2], { duration: 'breve', step: 'G', octave: 4 }, { breveHead: shape })
    expect(bar.heads, `${shape}: one head`).toHaveLength(1)
    expect(bar.heads[0].code).toBe(shape === 'round' ? 0xe0a0 : 0xe0a1)
    expect(bar.stems, `${shape}: no stem`).toHaveLength(0)
    await score.screenshot({ path: `test-results/longValues-breve-${shape}.png`, clip: { x: 0, y: 0, width: 420, height: 180 } })
  }
})

test('⭐ the longa: a stem UP on the right for a low note; DOWN on the RIGHT by default, on the LEFT under `normal`', async ({ score }) => {
  const cases = [
    { name: 'up', step: 'E', octave: 4, rows: {} },
    { name: 'down-right', step: 'E', octave: 5, rows: {} },
    { name: 'down-normal', step: 'E', octave: 5, rows: { longaStem: 'normal' } },
  ]
  for (const c of cases) {
    const bar = await drawBar(score, [8, 2], { duration: 'longa', step: c.step, octave: c.octave }, c.rows)
    expect(bar.heads, `${c.name}: one head`).toHaveLength(1)
    expect(bar.stems, `${c.name}: one stem`).toHaveLength(1)
    const head = bar.heads[0]
    const box = glyphBox(head.code === 0xe0a1 ? 'noteheadDoubleWholeSquare' : 'noteheadDoubleWhole')
    const left = head.x - box.left * bar.space
    const right = head.x + box.right * bar.space
    const stem = bar.stems[0]
    const down = Math.max(stem.y1, stem.y2) > head.y + bar.space // the stem runs below the head
    const fromLeft = (stem.x1 - left) / bar.space
    const fromRight = (right - stem.x1) / bar.space
    const length = Math.abs(stem.y2 - stem.y1) / bar.space
    console.log(`longa ${c.name}: head ${left.toFixed(1)}–${right.toFixed(1)} · stem x ${stem.x1.toFixed(1)} (${fromLeft.toFixed(2)} sp from the left edge, ${fromRight.toFixed(2)} from the right) · ${length.toFixed(2)} sp long · ${down ? 'down' : 'up'}`)
    if (c.name === 'down-normal') expect(fromLeft, 'a normal down stem stands on the LEFT edge').toBeLessThan(0.2)
    else expect(fromRight, `${c.name}: the stem stands on the RIGHT edge`).toBeLessThan(0.2)
    await score.screenshot({ path: `test-results/longValues-longa-${c.name}.png`, clip: { x: 0, y: 0, width: 520, height: 200 } })
  }
})

test('⭐ an empty 4/2 bar: the BREVE rest, on the middle line, filling the space above it', async ({ score }) => {
  const bar = await drawBar(score, [4, 2], null)
  expect(bar.rests, 'one rest').toHaveLength(1)
  const rest = bar.rests[0]
  expect(rest.code, 'the breve rest (restDoubleWhole)').toBe(0xe4e2)
  const middle = (bar.top + bar.bottom) / 2
  const box = glyphBox('restDoubleWhole')
  const inkTop = (rest.y - box.up * bar.space - bar.top) / bar.space
  const inkBottom = (rest.y + box.down * bar.space - bar.top) / bar.space
  console.log(`breve bar rest: ink from ${inkTop.toFixed(2)} to ${inkBottom.toFixed(2)} sp below the top line (the space between lines 3 and 4 from the bottom is 1–2)`)
  expect(Math.abs(rest.y - middle) / bar.space, 'its foot stands on the middle line').toBeLessThan(0.05)
  expect(Math.abs(inkTop - 1), 'it fills up to the fourth line').toBeLessThan(0.05)
  await score.screenshot({ path: 'test-results/longValues-barRest-4-2.png', clip: { x: 0, y: 0, width: 420, height: 180 } })
})
