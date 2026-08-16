import { test, expect } from './fixtures'
import { glyphBox } from '../src/engine/fonts/fontMetrics'
import { restStaffLine } from '../src/engine/layout/restPlacement'
import type { NoteDuration } from '../src/types/music'

/** The rest glyphs by the codepoint VexFlow draws — so a drawn rest can be asked its duration. */
const REST_DURATIONS: Record<string, NoteDuration> = {
  e4e3: 'w', e4e4: 'h', e4e5: 'q', e4e6: '8', e4e7: '16', e4e8: '32',
}

/**
 * KERNING, on the page — two inks only need horizontal clearance where they share a vertical band
 * (`docs/vexflow-boundary.md` §5, P1; `src/engine/layout/kerning.ts`).
 *
 * Three things live here, and only the browser can hold any of them:
 *
 *  1. **THE FONT AGAINST THE DRAWING** — ⚠️ read the note below, because this test changed its
 *     subject in F2 and that was the point.
 *  2. **What kerning WINS** — a left-hand accidental no longer buys room in the right hand's gaps.
 *  3. **What it deliberately DOES NOT win** — inside a beamed group the previous stem really is in the
 *     way, so a leap's accidental keeps its room. A test for the decline as much as for the win: the
 *     failure mode of a shape-based spacer is tucking ink into ink.
 *
 * ## 🚨 What (1) asserts changed in F2 — deliberately, and it would not have noticed
 *
 * It used to re-measure the drawing and compare it to `INK_HEIGHT`: **"the table describes what
 * VexFlow draws"**. Since F2 the table is also held against Bravura's own metrics in jsdom
 * (`spacingPadding.font.test.ts`), and leaving this file untouched would have quietly turned it into
 * **"our drawing agrees with the font"** — a different claim, green either way
 * (docs/font-metrics-plan.md §4).
 *
 * ⭐⭐ So the check is now split on purpose, and this half is the interesting one: **the subject is
 * the DEPENDENCY.** There are three copies of Bravura in play — the woff2 VexFlow bundles and draws
 * with, the `public/fonts/Bravura.otf` we measure and outline for the PDF, and Steinberg's metadata
 * (§4.2). The first two are checked against each other HERE, in the only place a drawn glyph exists.
 * When this fails it is telling us something real about the dependency rather than about us.
 */

/** Every gap but the last — the last one is the run-out to the barline, a different question. */
const noteGaps = (gaps: number[]): number[] => gaps.slice(0, -1)

/**
 * The glyphs this file holds the dependency to, by SMuFL name and the codepoint VexFlow draws.
 * ⭐ The rests are here because their heights are what F2 added to the model (plan §3.4) and they had
 * never been measured on the page at all.
 */
const CHECKED = [
  { name: 'noteheadBlack', code: 'e0a4' },
  { name: 'augmentationDot', code: 'e1e7' },
  { name: 'accidentalSharp', code: 'e262' },
  { name: 'accidentalFlat', code: 'e260' },
  { name: 'accidentalNatural', code: 'e261' },
  { name: 'restWhole', code: 'e4e3' },
  { name: 'restHalf', code: 'e4e4' },
  { name: 'restQuarter', code: 'e4e5' },
  { name: 'rest16th', code: 'e4e7' },
] as const

test('🚨 the Bravura the BROWSER draws with is the Bravura we MEASURED', async ({ score }) => {
  // ⭐⭐ THE DEPENDENCY IS THE SUBJECT (see the header). Our metrics come from
  //     `public/fonts/Bravura.otf`; the page is drawn in the woff2 VexFlow bundles. Nothing else
  //     checks that those are the same font, and every number the spacing model uses assumes it.
  const drawn = await score.evaluate(async (codes: string[]) => {
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

    // ⚠️ Canvas `TextMetrics.actualBoundingBox*` and NEVER an SVG bounding box: a music glyph's
    //    `<text>` reports the FONT's line box, the same 16 staff spaces tall for every glyph in
    //    Bravura, so a "height" read that way is not a height.
    return codes.map(code => {
      const m = context.measureText(String.fromCodePoint(parseInt(code, 16)))
      return {
        code,
        up: m.actualBoundingBoxAscent / space,
        down: m.actualBoundingBoxDescent / space,
        right: m.actualBoundingBoxRight / space,
      }
    })
  }, CHECKED.map(g => g.code))

  console.log('[census] drawn ink: ' + JSON.stringify(drawn))

  // ⚠️ **0.15 spaces, and the number is forced rather than chosen.** A staff space is 10 px on the
  //    harness and Chrome reports `actualBoundingBox*` in WHOLE PIXELS, rounded outward — so the
  //    measurement's own resolution is 0.1 spaces before any question of fonts arises. (It shows in
  //    the census: every value comes back a multiple of 0.1.) Tightening this would be pinning the
  //    rasteriser; loosening it would stop catching a different face.
  const RASTER = 0.15

  for (const [i, { name }] of CHECKED.entries()) {
    const font = glyphBox(name)
    const ink = drawn[i]
    expect(Math.abs(ink.up - font.up), `${name} reaches up as far as the font says`).toBeLessThan(RASTER)
    expect(Math.abs(ink.down - font.down), `${name} reaches down as far as the font says`).toBeLessThan(RASTER)
    expect(Math.abs(ink.right - font.right), `${name} is as wide as the font says`).toBeLessThan(RASTER)
  }

  // ⭐ And the two facts the vertical model was built on, said by the drawing itself rather than by
  //   our table: a sharp is symmetric about its line, a flat is not.
  const sharp = drawn[CHECKED.findIndex(g => g.name === 'accidentalSharp')]
  const flat = drawn[CHECKED.findIndex(g => g.name === 'accidentalFlat')]
  expect(sharp.up, 'a sharp is symmetric').toBeCloseTo(sharp.down, 1)
  expect(flat.up, 'a flat reaches higher than it descends').toBeGreaterThan(flat.down + 0.5)
})

test('⭐⭐ a REST is drawn where the model says it is — the half the font cannot give', async ({ score }) => {
  // Plan §3.4a: `glyphBBoxes` gives a rest's EXTENT around its own origin and says nothing about
  // where that origin sits on the staff. `spacingPadding.REST_LINE` supplies that, and this is the
  // only place the claim can be checked, because only the browser has a drawn rest.
  //
  // 🚨 **And it found something.** All six rests are keyed `b/4` in `NoteBuilder`, so all six land on
  //    the MIDDLE line — which is right for a minim rest and **one staff space too low for a
  //    semibreve rest**, which should hang from the fourth line. The model was made to describe the
  //    drawing rather than the tradition, deliberately and out loud (`REST_LINE`'s note), and this
  //    test is the pin that holds them together: ⭐ **fix the drawing and this fails**, which is
  //    exactly when the table has to move with it.
  const drawn = await score.evaluate(async () => {
    const h = window.__h
    // An eighth at the top of a 4/4 bar leaves the fill to make the rest of the bar. ⭐ Whatever mix
    // of rests that produces is what gets checked — plus a reference the staff cannot fudge.
    h.engine.addNoteAtBeat({ step: 'B', octave: 4, duration: '8', measure: 1, beat: h.frac(0, 1) })
    await h.render()
    const stave = h.staves()[0]
    const space = (stave.bottom - stave.top) / 4
    return {
      rests: h.rests().map(rest => ({ code: rest.code, line: (rest.y - stave.top) / space })),
      // ⚠️ B4 in treble IS the middle line, so this is the drawing's own answer to "where is line 2"
      //    — and it absorbs the half-pixel the stave's top edge carries
      //    (`reference_thin_lines_need_half_pixel_offset`), which a bare `stave.top` does not.
      middleLine: h.noteheads().map(head => (head.y - stave.top) / space)[0],
    }
  })

  console.log('[census] rest placement: ' + JSON.stringify(drawn))

  // ⛔ Break-test guard: an empty list, or one kind of rest, would pass the loop vacuously.
  expect(drawn.rests.length, 'the bar really drew some rests').toBeGreaterThan(1)
  expect(new Set(drawn.rests.map(r => r.code)).size, 'and more than one KIND of rest').toBeGreaterThan(1)
  // ⚠️ 1.95, not 2.00 — `stave.top` is the top line's drawn edge and a hairline is nudged half a
  //    pixel onto the device grid (`reference_thin_lines_need_half_pixel_offset`). A staff space is
  //    10 px here, so that half pixel IS 0.05 spaces. ⛔ Hence an explicit tolerance and not
  //    `toBeCloseTo(2, 1)`, which lands exactly on the boundary.
  expect(Math.abs(drawn.middleLine - 2), 'and B4 really is the middle line').toBeLessThan(0.1)

  for (const rest of drawn.rests) {
    const duration = REST_DURATIONS[rest.code]
    expect(duration, `U+${rest.code.toUpperCase()} is a rest we know`).toBeDefined()
    // ⭐ Measured as an OFFSET from the middle line, so the half pixel the stave's top edge carries
    //   cancels: `restStaffLine` is 2 at the middle, and a whole rest's 1 means one space higher.
    const expected = drawn.middleLine - (2 - restStaffLine(duration))
    expect(Math.abs(rest.line - expected), `the ${duration} rest sits where the model puts it`)
      .toBeLessThan(0.1)
  }
})

test('⭐⭐ a WHOLE rest hangs from the FOURTH line — the case every empty bar shows', async ({ score }) => {
  // The defect F2 found, now fixed and pinned. A semibreve rest hangs from the fourth line counting
  // up — the second from the top — one staff space above the middle line where every other rest is
  // anchored. All three reference engines agree (LilyPond `staff-position +2`, MuseScore `line 1`,
  // Verovio `loc 6`), and none of them treats a whole-BAR rest as a special case, which is what this
  // fixture draws: an EMPTY BAR.
  //
  // ⚠️ VexFlow has no rule of its own here — it puts a rest exactly where its key says — so this is
  //    OUR placement being checked, not the library's (`layout/restPlacement`, `NoteBuilder.restKey`).
  const drawn = await score.evaluate(async () => {
    const h = window.__h
    await h.render() // the bar as it loads: empty, so the app draws its measure rest
    const stave = h.staves()[0]
    const space = (stave.bottom - stave.top) / 4
    return h.rests().map(rest => ({ code: rest.code, line: (rest.y - stave.top) / space }))
  })

  expect(drawn, 'an empty bar draws exactly one rest').toHaveLength(1)
  expect(drawn[0].code, 'and it is a whole rest').toBe('e4e3')
  // ⚠️ An explicit tolerance rather than `toBeCloseTo(1, 1)`: `stave.top` is the top line's drawn
  //    edge and a hairline is nudged half a pixel onto the device grid, which at 10 px per staff
  //    space IS 0.05 spaces — exactly on that matcher's boundary.
  expect(Math.abs(drawn[0].line - 1), 'it hangs from the fourth line, not the middle')
    .toBeLessThan(0.1)
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
    //
    // ⚠️ Inside the staff, deliberately: down at C3 these notes would sit on LEDGER LINES, and a ledger
    //    is ink — `ledger↔note` (1.85) then legitimately widens the gap after each of them by 0.05
    //    spaces, which is the model working and would blunt the claim below. (It also only became
    //    visible once both staves shared one column list; before that the right hand never saw the left
    //    hand's ledgers at all.)
    for (const [i, step] of (['C', 'D', 'F', 'G'] as const).entries()) {
      h.engine.addNoteAtBeat({ step, octave: 4, alter: 1, duration: 'q', measure: 1, beat: h.frac(i, 1), staff: 1, forceAccidental: true })
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

  // ⭐⭐ EVERY gap the same. Four of them fall where a left-hand accidental sits; if that accidental
  //     were still buying room they would be `note↔accidental` (2.88) instead of the rule's 1.80 —
  //     about a staff space wider than their neighbours.
  //
  // ⚠️ To a PIXEL and not to a hundredth: the model's grid is exact (every gap 1.80), but VexFlow draws
  //    the bar's FIRST notehead half a pixel closer than the rest from its own left-modifier handling.
  //    That is below the resolution the ink table itself is written at, and it is not a cross-staff
  //    error — the two hands land on the same x to three decimals (`e2e/systems.e2e.ts`).
  const gaps = noteGaps(drawn.right)
  for (const gap of gaps) {
    // Within one PIXEL (0.1 staff spaces): the model's grid is exact, the drawing rounds the first
    // notehead by half of one. An accidental buying room would be a whole space wider, not half a pixel.
    expect(Math.abs(gap - gaps[1]), 'one 16th, the same width all through the bar').toBeLessThan(0.1)
  }
  expect(Math.max(...gaps), 'and none of them is paying for an accidental').toBeLessThan(2.2)
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

test('⭐⭐ a FLAG no longer draws through the next notehead — and a beamed note pays nothing for one', async ({ score }) => {
  // `docs/vexflow-boundary.md` §5 P2, the last blind spot in the ink table. A flag hangs off the stem
  // TIP and the column never counted it, so a bar of UNBEAMED 32nds — whose gap the rule sets at 1.50
  // staff spaces — drew each flag **0.65 spaces through** the next notehead. Seven collisions in one bar.
  //
  // ⚠️ And the opposite error is the one the old ink path made: VexFlow's `preCalculateMinTotalWidth`
  //    counted a flag on every eighth, beamed ones included, which is why an eighth once measured WIDER
  //    than a quarter (docs/spacing-model-research.md §6). So both halves are asserted here.
  const drawn = await score.evaluate(async () => {
    const h = window.__h
    const bar = async (beamed: boolean) => {
      for (const slot of [...h.engine.getScore().measures[0].slots]) {
        for (const note of (slot as { notes?: { id: string }[] }).notes ?? []) h.engine.deleteNote(note.id)
      }
      for (let i = 0; i < 8; i++) {
        h.engine.addNoteAtBeat({
          step: 'D', octave: 4, duration: '32', measure: 1, beat: h.frac(i, 8),
          ...(beamed ? {} : { beam: 'single' as const }),
        })
      }
      await h.render()
      const stave = h.staves()[0]
      const space = (stave.bottom - stave.top) / 4
      const heads = h.noteheads()
      const codes = h.glyphs('g.vf-notehead text, g.vf-stavenote text')
      const boxes = h.inkSizes('g.vf-notehead text, g.vf-stavenote text')
      const flags = boxes.filter((_, i) => codes[i].code === 'e244' || codes[i].code === 'e245')
      return {
        gaps: h.columnGaps()[0].columns.map(column => column.gap),
        flags: flags.length,
        // Positive = the flag's ink reaches PAST the next notehead's left edge, i.e. a collision.
        worst: Math.max(...flags.map((box, i) => heads[i + 1] === undefined ? -Infinity
          : ((box.x + box.width) - heads[i + 1].x) / space)),
      }
    }
    return { unbeamed: await bar(false), beamed: await bar(true) }
  })

  console.log(`[census] 32nds unbeamed: gaps ${drawn.unbeamed.gaps.slice(0, 3).map(g => g.toFixed(2)).join(' ')} ` +
    `worst flag overlap ${drawn.unbeamed.worst.toFixed(2)} · beamed: ` +
    `${drawn.beamed.gaps.slice(0, 3).map(g => g.toFixed(2)).join(' ')}`)

  expect(drawn.unbeamed.flags, 'eight unbeamed 32nds draw eight flags').toBe(8)
  expect(drawn.beamed.flags, '…and eight beamed ones draw none').toBe(0)

  // ⭐⭐ The flag clears the next notehead. It measured +0.65 (a collision) before the flag was ink.
  expect(drawn.unbeamed.worst, 'no flag reaches the next notehead').toBeLessThan(0)
  // The gap is the flag's own ink now — notehead + flag + note↔note — where the rule alone said 1.50.
  expect(drawn.unbeamed.gaps[0], 'the unbeamed bar is spaced by its flags').toBeCloseTo(2.43, 1)
  // ⛔ …and the beamed bar is untouched: the rule's 1.50, because no flag is drawn.
  expect(drawn.beamed.gaps[0], 'a beamed 32nd still gets the rule\'s answer').toBeCloseTo(1.5, 1)
})
