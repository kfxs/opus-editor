import { test, expect } from './fixtures'

/**
 * KERNING, on the page — two inks only need horizontal clearance where they share a vertical band
 * (`docs/vexflow-boundary.md` §5, P1; `src/engine/layout/kerning.ts`).
 *
 * Three things live here, and only the browser can hold any of them:
 *
 *  1. **The vertical ink table, re-measured** — the anti-drift gate `spacingPadding.ts` already has for
 *     its horizontal half. ⚠️ Measured with canvas `TextMetrics.actualBoundingBox*` and NEVER with a
 *     bounding box: a music glyph's SVG `<text>` reports the FONT's line box, which comes out the same
 *     16 staff spaces tall for every glyph in Bravura, so a "height" read that way is not a height.
 *  2. **What kerning WINS** — a left-hand accidental no longer buys room in the right hand's gaps.
 *  3. **What it deliberately DOES NOT win** — inside a beamed group the previous stem really is in the
 *     way, so a leap's accidental keeps its room. A test for the decline as much as for the win: the
 *     failure mode of a shape-based spacer is tucking ink into ink.
 */

/** Every gap but the last — the last one is the run-out to the barline, a different question. */
const noteGaps = (gaps: number[]): number[] => gaps.slice(0, -1)

test('⭐⭐ the VERTICAL ink table still matches the drawing — the anti-drift gate', async ({ score }) => {
  const drawn = await score.evaluate(async () => {
    const h = window.__h
    h.engine.addNoteAtBeat({ step: 'B', octave: 4, duration: 'q', measure: 1, beat: h.frac(0, 1) })
    await h.render()
    const stave = h.staves()[0]
    const space = (stave.bottom - stave.top) / 4

    // The font the score is actually drawn in, read off a real music glyph rather than assumed.
    const glyph = document.querySelector('g.vf-notehead text') as SVGTextElement
    const style = window.getComputedStyle(glyph)
    const context = document.createElement('canvas').getContext('2d')!
    context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
    const measure = (code: string) => {
      const m = context.measureText(String.fromCodePoint(parseInt(code, 16)))
      return { up: m.actualBoundingBoxAscent / space, down: m.actualBoundingBoxDescent / space }
    }

    const table = h.ink()
    return {
      table: {
        notehead: table.height.notehead,
        dot: table.height.dot,
        sharp: table.accidentalHeight('#'),
        flat: table.accidentalHeight('b'),
        natural: table.accidentalHeight('n'),
      },
      drawn: {
        notehead: measure('e0a4'),
        dot: measure('e1e7'),
        sharp: measure('e262'),
        flat: measure('e260'),
        natural: measure('e261'),
      },
    }
  })

  console.log('[census] vertical ink: ' + JSON.stringify(drawn.drawn))

  // ⭐ A notehead is half a space either side of its line, and the table rounds that OUT to 0.6 — a
  //   minimum should be generous, never tight.
  expect(drawn.table.notehead, 'a notehead').toBeGreaterThanOrEqual(drawn.drawn.notehead.up)
  expect(drawn.table.notehead).toBeGreaterThanOrEqual(drawn.drawn.notehead.down)
  expect(drawn.table.notehead, '…and not generous by more than a third of a space')
    .toBeLessThan(drawn.drawn.notehead.down + 0.35)

  expect(drawn.table.dot, 'a dot').toBeCloseTo(drawn.drawn.dot.up, 1)

  // ⭐⭐ The one that carries the model: a sharp is SYMMETRIC at ±1.4 spaces while a flat reaches 1.8
  //     UP and 0.8 down — its bowl sits above the line. One number for "an accidental is this tall"
  //     would be wrong for both.
  expect(drawn.table.sharp.up, 'a sharp, up').toBeCloseTo(drawn.drawn.sharp.up, 1)
  expect(drawn.table.sharp.down, 'a sharp, down').toBeCloseTo(drawn.drawn.sharp.down, 1)
  expect(drawn.table.flat.up, 'a flat, up').toBeCloseTo(drawn.drawn.flat.up, 1)
  expect(drawn.table.flat.down, 'a flat, down').toBeCloseTo(drawn.drawn.flat.down, 1)
  expect(drawn.table.natural.up, 'a natural, up').toBeCloseTo(drawn.drawn.natural.up, 1)
  expect(drawn.drawn.flat.up, 'and a flat really does reach higher than it descends')
    .toBeGreaterThan(drawn.drawn.flat.down + 0.5)
})

test('⭐⭐ a LEFT-HAND accidental buys no room in the RIGHT hand — the piano case', async ({ score }) => {
  // A column holds every staff, so before kerning a low sharpened quarter in the left hand widened the
  // gap between two right-hand 16ths four spaces above it — ink that cannot touch, paid for on every
  // beat of a piano score.
  const drawn = await score.evaluate(async () => {
    const h = window.__h
    h.engine.addStaffBelow(0)
    for (let i = 0; i < 16; i++) {
      h.engine.addNoteAtBeat({ step: 'B', octave: 4, duration: '16', measure: 1, beat: h.frac(i, 4), staff: 0 })
    }
    // Four DIFFERENT sharpened pitches, so each really draws its sign (a repeated C♯ is spelled once).
    for (const [i, step] of (['C', 'D', 'F', 'G'] as const).entries()) {
      h.engine.addNoteAtBeat({ step, octave: 3, alter: 1, duration: 'q', measure: 1, beat: h.frac(i, 1), staff: 1, forceAccidental: true })
    }
    await h.render()
    const bars = h.columnGaps()
    return {
      right: bars.find(b => b.staff === 0)!.columns.map(c => c.gap),
      signs: h.glyphs('g.vf-notehead text').filter(g => g.code === 'e262').length,
      width: bars[0].width,
    }
  })

  console.log(`[census] dense RH over a sharpened LH: width ${drawn.width} gaps ` +
    `${drawn.right.map(g => g.toFixed(2)).join(' ')}`)
  expect(drawn.signs, 'the left hand really draws four sharps').toBe(4)
  expect(drawn.right, 'sixteen 16ths in the right hand').toHaveLength(16)

  // ⭐⭐ EVERY gap the same, to a hundredth. Four of them fall where a left-hand accidental sits; if
  //     that accidental were still buying room they would be about a staff space wider than the rest.
  const gaps = noteGaps(drawn.right)
  for (const gap of gaps) expect(gap, 'one 16th, the same width all through the bar').toBeCloseTo(gaps[0], 2)
})

test('⛔ …but inside a BEAM the previous stem is in the way, and the accidental keeps its room', async ({ score }) => {
  // The decline, and it is as much the point as the win: a beamed stem runs to a beam whose height is
  // not a width-time fact, so `measureColumns` treats it as reaching the far side of the staff. Here
  // that is not a conservatism but the truth — with stems one way or the other, one of these stems
  // crosses the whole leap.
  const drawn = await score.evaluate(async () => {
    const h = window.__h
    for (let i = 0; i < 16; i++) {
      const low = i % 2 === 1
      h.engine.addNoteAtBeat({
        step: low ? 'D' : 'B', octave: low ? 4 : 5, alter: low ? 1 : 0,
        duration: '16', measure: 1, beat: h.frac(i, 4), forceAccidental: low,
      })
    }
    await h.render()
    const census = h.columnGaps()[0]
    return { gaps: census.columns.map(c => c.gap), width: census.width }
  })

  console.log(`[census] beamed leaps, every other note sharpened: width ${drawn.width} gaps ` +
    `${drawn.gaps.map(g => g.toFixed(2)).join(' ')}`)

  // The gap BEFORE a sharpened note is wider than the gap before a bare one — the accidental is paid
  // for, because there is a stem where it would have tucked.
  const gaps = noteGaps(drawn.gaps)
  const beforeSharp = gaps.filter((_, i) => i % 2 === 0)
  const beforePlain = gaps.filter((_, i) => i % 2 === 1)
  expect(beforeSharp[0], 'the sharpened columns still buy their room').toBeGreaterThan(beforePlain[0] + 0.5)
})
