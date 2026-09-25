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

test('a triple-dotted note: 0.5 sp from the head, 0.26 sp between dots (`dotGap` `gould`, P4a — `house` drew 0.5)', async ({ score }) => {
  const d = await draw(score, `e.addNoteAtBeat({ step: 'A', octave: 4, duration: 'q', dots: 3, measure: 1, beat: f(0, 1) })`)
  const dots = dotsOf(d)
  expect(dots).toHaveLength(3)
  expect(gap(first(d, 'notehead'), dots[0])).toBeCloseTo(0.5, 1)
  expect(gap(dots[0], dots[1]), 'her plate, p. 54').toBeCloseTo(0.26, 1)
  expect(gap(dots[1], dots[2]), 'the third steps exactly like the second').toBeCloseTo(0.26, 1)
  expect(new Set(dots.map(g => g.y)).size, 'every dot at one height').toBe(1)
  expect(dots[0].w / SP, 'the dot’s size: Gould’s 0.49 sp (`dotSize`, P4f — Bravura’s own is 0.40)').toBeCloseTo(0.49, 1)
})

test('a double-dotted REST: 0.4 sp from the rest, 0.25 sp between dots (`restDotGap` `gould`, P4b — VexFlow drew 0.2 / 0.1)', async ({ score }) => {
  const d = await draw(score, `const n = e.addNoteAtBeat({ step: 'A', octave: 4, duration: 'h', dots: 2, measure: 1, beat: f(0, 1) }); e.convertToRest(n.id)`)
  const [rest] = d.glyphs
  const dots = dotsOf(d)
  expect(rest.code, 'a half rest').toBe('e4e4')
  expect(dots).toHaveLength(2)
  expect(gap(rest, dots[0]), 'Gould pp. 38 + 162').toBeCloseTo(0.4, 1)
  expect(gap(dots[0], dots[1])).toBeCloseTo(0.25, 1)
  // ⭐ …and the room is bought: what follows the rest stands clear of its last dot.
  const next = d.glyphs.find(g => g.x > dots[1].x && g.cls !== 'dot')!
  expect(gap(dots[1], next), 'the next glyph clears the dots').toBeGreaterThan(0.3)
})

test('a stem-up FLAGGED eighth ON A LINE: its dot is level with the flag, so it clears it by 0.3 sp (`dotFlag` `gould`, P4c — VexFlow 0.35)', async ({ score }) => {
  const d = await draw(score, `e.addNoteAtBeat({ step: 'G', octave: 4, duration: '8', dots: 1, measure: 1, beat: f(0, 1) }); e.addNoteAtBeat({ step: 'G', octave: 4, duration: 'q', measure: 1, beat: f(1, 1) })`)
  const flag = first(d, 'flag')
  const [dot] = dotsOf(d)
  expect(dot.x, 'right of the flag').toBeGreaterThan(flag.x + flag.w)
  expect(gap(flag, dot), 'Gould p. 55, her eighth measured').toBeCloseTo(0.3, 1)
})

test('a stem-up FLAGGED eighth IN A SPACE: its dot sits BELOW the flag, so `gould` does not push it (P4c)', async ({ score }) => {
  // A4: the dot stays in the head's own space, under the flag's tail — Gould p. 55 moves it only *"should
  // the end of a tail coincide with the position of the dot"*. VexFlow pushed it past the flag regardless.
  const d = await draw(score, `e.addNoteAtBeat({ step: 'A', octave: 4, duration: '8', dots: 1, measure: 1, beat: f(0, 1) }); e.addNoteAtBeat({ step: 'A', octave: 4, duration: 'q', measure: 1, beat: f(1, 1) })`)
  expect(gap(first(d, 'notehead'), dotsOf(d)[0]), 'the head gap, as an unflagged note').toBeCloseTo(0.5, 1)
})

test('NOW — a BEAMED dotted eighth is NOT pushed: 0.5 sp off its head, like an unflagged note (R2)', async ({ score }) => {
  // ⚠️ `docs/research/dot-placement.md` (2026-07-28) said a beamed eighth's dot was pushed as if flagged;
  //    the browser says it is not — the quirk is gone. Pinned, so the `vexflow` row cannot claim it.
  const d = await draw(score, `e.addNoteAtBeat({ step: 'G', octave: 4, duration: '8', dots: 1, measure: 1, beat: f(0, 1) }); e.addNoteAtBeat({ step: 'G', octave: 4, duration: '16', measure: 1, beat: f(3, 4) })`)
  expect(gap(first(d, 'notehead'), dotsOf(d)[0])).toBeCloseTo(0.5, 1)
})

test('TWO VOICES on lines: the stem-DOWN voice drops its dot BELOW, both at ONE x (`dotVoice` `gould`, P4d — VexFlow: up)', async ({ score }) => {
  // G4 (voice 1, stem up) and E4 (voice 2, stem DOWN), both on a line, both dotted. Gould p. 56: *"Drop the
  // dot into the space below the lower part"*.
  const d = await draw(score, `e.addNoteAtBeat({ step: 'G', octave: 4, duration: 'q', dots: 1, measure: 1, beat: f(0, 1) }); e.addNoteAtBeat({ step: 'E', octave: 4, duration: 'q', dots: 1, measure: 1, beat: f(0, 1), voice: 1 })`)
  const heads = d.glyphs.filter(g => g.cls === 'notehead' && g.code === 'e0a4')
  const dots = dotsOf(d)
  expect(dots).toHaveLength(2)
  const [upper, lower] = [heads.reduce((a, b) => (b.y < a.y ? b : a)), heads.reduce((a, b) => (b.y > a.y ? b : a))]
  const [upperDot, lowerDot] = [dots.reduce((a, b) => (b.y < a.y ? b : a)), dots.reduce((a, b) => (b.y > a.y ? b : a))]
  expect(upperDot.y, 'the stem-up voice keeps the space above').toBeCloseTo(upper.y - SP / 2, 1)
  expect(lowerDot.y, 'the stem-down voice takes the space BELOW').toBeCloseTo(lower.y + SP / 2, 1)
  expect(dots[0].x, 'one x — two voices’ heads stand together in this editor').toBeCloseTo(dots[1].x, 1)
})

test('TWO VOICES CROSSED: the stem-down head ABOVE the stem-up one keeps the space above (Gould p. 58, P4d)', async ({ score }) => {
  // Voice 1 (stem up) E4, voice 2 (stem down) G4 — the parts overlap, so the lower part's dot is forced up.
  const d = await draw(score, `e.addNoteAtBeat({ step: 'E', octave: 4, duration: 'q', dots: 1, measure: 1, beat: f(0, 1) }); e.addNoteAtBeat({ step: 'G', octave: 4, duration: 'q', dots: 1, measure: 1, beat: f(0, 1), voice: 1 })`)
  const heads = d.glyphs.filter(g => g.cls === 'notehead' && g.code === 'e0a4')
  const top = heads.reduce((a, b) => (b.y < a.y ? b : a))
  expect(dotsOf(d).some(g => Math.abs(g.y - (top.y - SP / 2)) < 0.5), 'G4’s dot in the space above its line').toBe(true)
})

test('a CLUSTER C5–F5: a space for every dot, centred on the chord (`chordDots` `gould`, P4e — VexFlow drew two in one space)', async ({ score }) => {
  // Gould p. 55: *"Each dot should always have a stave-space to itself"*; p. 56: *"Centre the dots on the chord"*.
  const d = await draw(score, `e.addNoteAtBeat({ step: 'C', octave: 5, duration: 'q', dots: 1, measure: 1, beat: f(0, 1) }); for (const s of ['D', 'E', 'F']) e.addChordNote({ step: s, octave: 5, duration: 'q', dots: 1, measure: 1, beat: f(0, 1) })`)
  const dots = dotsOf(d)
  expect(dots, 'one dot per head — none dropped').toHaveLength(4)
  expect(new Set(dots.map(g => g.x)).size, 'one column').toBe(1)
  // Staff top line at y 60 (F5); C5 is 75. Spaces 5.5 / 4.5 / 3.5 / 2.5 → y 55, 65, 75, 85.
  expect(dots.map(g => g.y).sort((a, b) => a - b), 'four spaces, one each').toEqual([55, 65, 75, 85])
})

test('a TALL cluster E4–E5: only the spaces the chord covers carry a dot — the rest are dropped (Gould p. 56’s rule, P4e)', async ({ score }) => {
  const d = await draw(score, `e.addNoteAtBeat({ step: 'E', octave: 4, duration: 'q', dots: 1, measure: 1, beat: f(0, 1) }); for (const [s, o] of [['F', 4], ['G', 4], ['A', 4], ['B', 4], ['C', 5], ['D', 5], ['E', 5]]) e.addChordNote({ step: s, octave: o, duration: 'q', dots: 1, measure: 1, beat: f(0, 1) })`)
  const dots = dotsOf(d)
  expect(dots, 'eight heads, four dots — the four spaces it covers').toHaveLength(4)
  expect(new Set(dots.map(g => g.y)).size, 'each in its own space').toBe(4)
})

test('NOW — a dotted note TIED: the tie starts under the head, and the dot sits inside its arc (R7)', async ({ score }) => {
  const d = await draw(score, `const a = e.addNoteAtBeat({ step: 'A', octave: 4, duration: 'q', dots: 1, measure: 1, beat: f(0, 1) }); e.addNoteAtBeat({ step: 'A', octave: 4, duration: '8', measure: 1, beat: f(3, 2) }); e.toggleTie(a.id)`)
  const [dot] = dotsOf(d)
  const start = /^M(-?[\d.]+) (-?[\d.]+)/.exec(d.ties[0])!
  expect(parseFloat(start[1]), 'the tie starts LEFT of the dot — Gould p. 63, not after it').toBeLessThan(dot.x)
  expect(parseFloat(start[2]), 'and below it, bowing away from the stem').toBeGreaterThan(dot.y)
})

test('a STEM-DOWN dotted note on a line, tied: the tie bows UP over its lifted dot and clears it (`dotTie` `gould`, P4g)', async ({ score }) => {
  // D5: the dot rises into the space above; the tie, away from the stem, arcs over it — Gould p. 63, *"Curve
  // the tie sufficiently to avoid obscuring the dot"*. Measured 2026-09-25: ≈0.31 sp to spare.
  const d = await draw(score, `const a = e.addNoteAtBeat({ step: 'D', octave: 5, duration: 'q', dots: 1, measure: 1, beat: f(0, 1) }); e.addNoteAtBeat({ step: 'D', octave: 5, duration: '8', measure: 1, beat: f(3, 2) }); e.toggleTie(a.id)`)
  const [dot] = dotsOf(d)
  const n = [...d.ties[0].matchAll(/-?[\d.]+/g)].map(m => parseFloat(m[0]))
  expect(n[0], 'the tie starts LEFT of the dot').toBeLessThan(dot.x)
  expect(n[3], 'and its arc rises ABOVE the dot').toBeLessThan(dot.y - SP / 4)
})

