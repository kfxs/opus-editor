/**
 * ⭐ docs/plans/other-durations-plan.md P3 — the 64th … 512th in a real browser: what jsdom cannot see.
 *
 * - a FLAG meets its stem — the font's own 4-, 5-, 6- and 7-flag glyphs, hung from the tip;
 * - a STEM grows with the flags (the "a flag taller than the stem" rule, by the glyph's own height);
 * - a REST stands on the middle line and reaches below the staff, one hook per space;
 * - FOUR to SEVEN beams clear the notehead — the stem is extended by the duration's row.
 *
 * 🚨 A `<text>`'s client rect is its EM box, ⛔ not its ink — so a glyph is located by its ANCHOR (the
 * `x`/`y` it was drawn at) plus the font's own measured box (`fonts/fontMetrics.glyphBox`), the way
 * `flag.e2e.ts` does. Positions are in staff spaces, off the stave's own lines.
 */
import { test, expect } from './fixtures'
import { glyphBox, flagGlyph, restGlyph } from '../src/engine/fonts/fontMetrics'
import type { NoteDuration } from '../src/types/music'

type Page = Parameters<Parameters<typeof test>[1]>[0]['score']

/** Clear bar 1, place `notes`, render; report the stave and each glyph's anchor. */
async function drawBar(score: Page, notes: { duration: string; beat: [number, number]; step: string; octave: number }[]) {
  return score.evaluate(async (notes) => {
    const h = window.__h
    for (const slot of [...h.engine.getScore().measures[0].slots]) {
      for (const note of (slot as { notes?: { id: string }[] }).notes ?? []) h.engine.deleteNote(note.id)
    }
    for (const n of notes) {
      h.engine.addNoteAtBeat({ step: n.step, octave: n.octave, duration: n.duration as never, measure: 1, beat: h.frac(n.beat[0], n.beat[1]) })
    }
    await h.render()
    const stave = h.staves().find(s => s.measure === 1)!
    const glyphs = h.glyphs('g.notehead text').map(g => ({ ...g, code: parseInt(g.code, 16) }))
    return {
      space: (stave.bottom - stave.top) / 4, top: stave.top, bottom: stave.bottom,
      stems: h.stems(),
      flags: h.glyphs('g.flag text'),
      rests: glyphs.filter(g => g.code >= 0xe4e0 && g.code <= 0xe4ff),
      heads: glyphs.filter(g => g.code >= 0xe0a0 && g.code <= 0xe0ff),
      beams: h.quads('g.beam path'),
    }
  }, notes)
}

const SHORT = ['32', '64', '128', '256', '512'] as const

test('⭐ a lone short note: its flag meets the stem tip, and the stem grows with the flags', async ({ score }) => {
  const lengths: number[] = []
  for (const duration of SHORT) {
    // E4 — the bottom line, stem UP.
    const bar = await drawBar(score, [{ duration, beat: [0, 1], step: 'E', octave: 4 }])
    const stem = bar.stems[0]
    const tip = Math.min(stem.y1, stem.y2)
    const length = Math.abs(stem.y2 - stem.y1) / bar.space
    lengths.push(length)
    expect(bar.flags, `${duration}: one flag`).toHaveLength(1)
    // An up-flag's anchor is where it meets the stem; its ink runs DOWN from there by `box.down`.
    const box = glyphBox(flagGlyph(duration as NoteDuration, true)!)
    const flagTop = bar.flags[0].y - box.up * bar.space
    const flagBottom = bar.flags[0].y + box.down * bar.space
    const headY = bar.heads[0].y
    console.log(`${duration}: stem ${length.toFixed(2)} sp · flag ${(box.up + box.down).toFixed(2)} sp · flag top ${((flagTop - tip) / bar.space).toFixed(2)} sp from the tip · flag foot ${((headY - flagBottom) / bar.space).toFixed(2)} sp above the head`)
    expect(Math.abs(flagTop - tip) / bar.space, `${duration}: the flag's top meets the stem tip`).toBeLessThan(0.5)
    expect(flagBottom, `${duration}: the flag stays clear of its own notehead`).toBeLessThan(headY)
  }
  for (let i = 1; i < lengths.length; i++) {
    expect(lengths[i], `${SHORT[i]} stem ≥ ${SHORT[i - 1]} stem`).toBeGreaterThanOrEqual(lengths[i - 1] - 0.01)
  }
  expect(lengths[SHORT.indexOf('64')], 'a 64th stem is longer than 3½ spaces').toBeGreaterThan(3.5)
  await score.screenshot({ path: 'test-results/shortValues-lone-512.png' })
})

test('⭐ beamed pairs: 4 … 7 beams, and the innermost clears the notehead', async ({ score }) => {
  for (const [duration, perQuarter, lines] of [['64', 16, 4], ['128', 32, 5], ['256', 64, 6], ['512', 128, 7]] as const) {
    const bar = await drawBar(score, [
      { duration, beat: [0, 1], step: 'E', octave: 4 },
      { duration, beat: [1, perQuarter], step: 'F', octave: 4 },
    ])
    expect(bar.beams, `${duration}: one quad per beam line`).toHaveLength(lines)
    // Stems up: the innermost beam is the LOWEST quad; a black head reaches ½ space above its anchor.
    const innermost = Math.max(...bar.beams.map(q => Math.max(q.yLeft, q.yRight))) + 0.5 * bar.space
    const headTop = Math.min(...bar.heads.map(h => h.y)) - 0.5 * bar.space
    console.log(`${duration}: innermost beam ${((headTop - innermost) / bar.space).toFixed(2)} sp above the head`)
    expect(innermost, `${duration}: the beams stand ABOVE the heads`).toBeLessThan(headTop)
    if (duration === '512') await score.screenshot({ path: 'test-results/shortValues-beamed-512.png' })
  }
})

test('⭐ the short rests stand on the middle line and reach below the staff', async ({ score }) => {
  for (const duration of ['32', '64', '128', '256', '512'] as const) {
    // A C5 at beat 0 — its own value's rest follows it in the fill.
    const bar = await drawBar(score, [{ duration, beat: [0, 1], step: 'C', octave: 5 }])
    const code = parseInt(restCode(duration), 16)
    const rest = bar.rests.find(r => r.code === code)!
    expect(rest, `${duration}: its own rest is in the fill`).toBeDefined()
    const box = glyphBox(restGlyph(duration))
    const middle = (bar.top + bar.bottom) / 2
    const inkTop = (rest.y - box.up * bar.space - bar.top) / bar.space
    const inkBottom = (rest.y + box.down * bar.space - bar.bottom) / bar.space
    console.log(`${duration} rest: origin ${((rest.y - middle) / bar.space).toFixed(2)} sp from the middle line · top ${inkTop.toFixed(2)} sp below the top line · foot ${inkBottom.toFixed(2)} sp below the bottom line`)
    expect(Math.abs(rest.y - middle) / bar.space, `${duration}: stands on the middle line`).toBeLessThan(0.05)
    if (duration !== '32') expect(inkBottom, `${duration}: reaches below the bottom line`).toBeGreaterThan(0.5)
  }
  await score.screenshot({ path: 'test-results/shortValues-rest-512.png' })
})

/** The rest glyph's code point as the harness spells it (hex). */
function restCode(duration: NoteDuration): string {
  const codes: Record<string, string> = {
    '32': 'e4e8', '64': 'e4e9', '128': 'e4ea', '256': 'e4eb', '512': 'e4ec',
  }
  return codes[duration]
}
