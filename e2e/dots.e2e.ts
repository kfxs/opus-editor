import { test, expect } from './fixtures'

/**
 * ⭐ **WHAT WE DRAW NOW, for dots** — docs/plans/multiple-dots-plan.md P3: today's drawing PINNED before any
 * preset table moves a pixel (P4), so each table's "now" row is MEASURED, not read off the code.
 *
 * ⚠️ In the BROWSER because every number here is a horizontal gap, and jsdom has no font: a head measures
 * 0 wide there, and the scene's dots land INSIDE it (measured 2026-09-25). The VERTICAL facts are here too,
 * beside the gaps they belong with.
 *
 * All in staff spaces (10 px), ink edge to ink edge — a glyph's width is `getComputedTextLength`.
 * ⚠️ When a P4 step changes a default, the assertion it moves is UPDATED in that step, and the old number
 * stays reachable as the table's `now` row.
 */

const SP = 10

interface Drawn {
  glyphs: { code: string; cls: string | null; x: number; w: number; y: number }[]
  ties: string[]
}

/** Build one bar with `build`, render, and read every head, rest, flag and dot glyph, left to right. */
async function draw(score: import('@playwright/test').Page, build: string): Promise<Drawn> {
  return score.evaluate(async (build: string) => {
    const h = window.__h
    // eslint-disable-next-line no-new-func
    await new Function('h', 'e', 'f', build)(h, h.engine, h.frac)
    await h.render()
    const glyphs = [...document.querySelectorAll<SVGTextElement>('svg text')].map(t => ({
      code: (t.textContent ?? '').codePointAt(0)!.toString(16), cls: t.closest('g')?.getAttribute('class') ?? null,
      x: t.getBBox().x, w: t.getComputedTextLength(), y: parseFloat(t.getAttribute('y') ?? '0'),
    })).filter(g => /^e(0a|24|4e|1e7)/.test(g.code)).sort((a, b) => a.x - b.x)
    const ties = [...document.querySelectorAll('g.tie path')].map(p => p.getAttribute('d') ?? '')
    return { glyphs, ties }
  }, build)
}

const dotsOf = (d: Drawn) => d.glyphs.filter(g => g.cls === 'dot')
const first = (d: Drawn, cls: string) => d.glyphs.find(g => g.cls === cls)!
/** White from `a`'s right edge to `b`'s left, in staff spaces. */
const gap = (a: { x: number; w: number }, b: { x: number }) => (b.x - (a.x + a.w)) / SP

test('NOW — a triple-dotted note: 0.5 sp from the head, 0.5 sp between dots (`dotGap` `house`)', async ({ score }) => {
  const d = await draw(score, `e.addNoteAtBeat({ step: 'A', octave: 4, duration: 'q', dots: 3, measure: 1, beat: f(0, 1) })`)
  const dots = dotsOf(d)
  expect(dots).toHaveLength(3)
  expect(gap(first(d, 'notehead'), dots[0])).toBeCloseTo(0.5, 1)
  expect(gap(dots[0], dots[1])).toBeCloseTo(0.5, 1)
  expect(gap(dots[1], dots[2]), 'the third steps exactly like the second').toBeCloseTo(0.5, 1)
  expect(new Set(dots.map(g => g.y)).size, 'every dot at one height').toBe(1)
})

test('NOW — a double-dotted REST keeps VexFlow’s gaps: 0.2 sp from the rest, 0.1 sp between dots (R4)', async ({ score }) => {
  const d = await draw(score, `const n = e.addNoteAtBeat({ step: 'A', octave: 4, duration: 'h', dots: 2, measure: 1, beat: f(0, 1) }); e.convertToRest(n.id)`)
  const [rest] = d.glyphs
  const dots = dotsOf(d)
  expect(rest.code, 'a half rest').toBe('e4e4')
  expect(dots).toHaveLength(2)
  expect(gap(rest, dots[0])).toBeCloseTo(0.2, 1)
  expect(gap(dots[0], dots[1])).toBeCloseTo(0.1, 1)
})

test('NOW — a stem-up FLAGGED eighth: its dot stands past the flag, ≈0.35 sp off it (R2)', async ({ score }) => {
  const d = await draw(score, `e.addNoteAtBeat({ step: 'G', octave: 4, duration: '8', dots: 1, measure: 1, beat: f(0, 1) }); e.addNoteAtBeat({ step: 'G', octave: 4, duration: 'q', measure: 1, beat: f(1, 1) })`)
  const flag = first(d, 'flag')
  const [dot] = dotsOf(d)
  expect(dot.x, 'right of the flag').toBeGreaterThan(flag.x + flag.w)
  expect(gap(flag, dot)).toBeCloseTo(0.35, 1)
})

test('NOW — a BEAMED dotted eighth is NOT pushed: 0.5 sp off its head, like an unflagged note (R2)', async ({ score }) => {
  // ⚠️ `docs/research/dot-placement.md` (2026-07-28) said a beamed eighth's dot was pushed as if flagged;
  //    the browser says it is not — the quirk is gone. Pinned, so the `vexflow` row cannot claim it.
  const d = await draw(score, `e.addNoteAtBeat({ step: 'G', octave: 4, duration: '8', dots: 1, measure: 1, beat: f(0, 1) }); e.addNoteAtBeat({ step: 'G', octave: 4, duration: '16', measure: 1, beat: f(3, 4) })`)
  expect(gap(first(d, 'notehead'), dotsOf(d)[0])).toBeCloseTo(0.5, 1)
})

test('NOW — TWO VOICES on lines: both dots go UP, and at ONE x (R3)', async ({ score }) => {
  // G4 (voice 1, stem up) and E4 (voice 2, stem DOWN), both on a line, both dotted.
  const d = await draw(score, `e.addNoteAtBeat({ step: 'G', octave: 4, duration: 'q', dots: 1, measure: 1, beat: f(0, 1) }); e.addNoteAtBeat({ step: 'E', octave: 4, duration: 'q', dots: 1, measure: 1, beat: f(0, 1), voice: 1 })`)
  const heads = d.glyphs.filter(g => g.cls === 'notehead' && g.code === 'e0a4')
  const dots = dotsOf(d)
  expect(dots).toHaveLength(2)
  const lower = heads.reduce((a, b) => (b.y > a.y ? b : a))
  const lowerDot = dots.reduce((a, b) => (b.y > a.y ? b : a))
  expect(lowerDot.y, '⛔ the stem-down voice’s dot rides in the space ABOVE its line (Gould: below)').toBeCloseTo(lower.y - SP / 2, 1)
  expect(dots[0].x, 'the two voices’ dots already share one x here').toBeCloseTo(dots[1].x, 1)
})

test('NOW — a CLUSTER keeps every dot, and two land in ONE space (R5)', async ({ score }) => {
  // C5 D5 E5 F5 — seconds all the way up. 🚨 D5's dot drops into C5's space: two dots drawn on top of
  //    each other, which reads as one. Gould p. 55: *"Each dot should always have a stave-space to itself"*.
  const d = await draw(score, `e.addNoteAtBeat({ step: 'C', octave: 5, duration: 'q', dots: 1, measure: 1, beat: f(0, 1) }); for (const s of ['D', 'E', 'F']) e.addChordNote({ step: s, octave: 5, duration: 'q', dots: 1, measure: 1, beat: f(0, 1) })`)
  const dots = dotsOf(d)
  expect(dots, 'one dot per head — none dropped').toHaveLength(4)
  expect(new Set(dots.map(g => g.x)).size, 'one column').toBe(1)
  expect(dots.map(g => g.y).sort((a, b) => a - b), 'two share a space').toEqual([55, 65, 75, 75])
})

test('NOW — a dotted note TIED: the tie starts under the head, and the dot sits inside its arc (R7)', async ({ score }) => {
  const d = await draw(score, `const a = e.addNoteAtBeat({ step: 'A', octave: 4, duration: 'q', dots: 1, measure: 1, beat: f(0, 1) }); e.addNoteAtBeat({ step: 'A', octave: 4, duration: '8', measure: 1, beat: f(3, 2) }); e.toggleTie(a.id)`)
  const [dot] = dotsOf(d)
  const start = /^M(-?[\d.]+) (-?[\d.]+)/.exec(d.ties[0])!
  expect(parseFloat(start[1]), 'the tie starts LEFT of the dot — Gould p. 63, not after it').toBeLessThan(dot.x)
  expect(parseFloat(start[2]), 'and below it, bowing away from the stem').toBeGreaterThan(dot.y)
})
