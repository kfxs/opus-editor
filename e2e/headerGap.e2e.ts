/**
 * ⭐⭐ **THE CLEF → TIME SIGNATURE GAP** — `engine/layout/clefMeterGap`,
 * `docs/header-spacing-research.md` §4.4/§4.5/§5.6, placed by `rendering/headerPlacementPass`.
 *
 * 🚨 **Why this is a browser spec and cannot be a unit one.** `Stave.format()`'s begin walk reads
 * `padding = modifier.getPadding(i + offset)` and then `if (padding + width === 0) offset--`. In
 * jsdom every glyph measures 0×0, so a zero-width clef decremented the offset and the meter was
 * asked for `getPadding(1)` — which is 0. ⚠️ Since P5b's placement step the meter no longer depends
 * on that walk at all, so the ORDER is now a unit test (`VexFlowRenderer.scene.test.ts`); what still
 * needs a browser is the INK, because jsdom has no font.
 *
 * ## 🚨🚨 WHAT THIS SPEC GOT WRONG, AND WHY IT IS WRITTEN THIS WAY NOW (2026-09-13)
 *
 * It used to assert the measured white against the armed 1.0 at `toBeCloseTo(…, 1)` and read
 * **0.98** — which looked like confirmation and was not. `getBoundingClientRect` reports a text box
 * in **whole device pixels, rounded OUTWARD**, so every glyph measures 1–2 px too wide and a white
 * gap between two of them reads **~2 px too SMALL** — at the default staff that is **≈0.2 staff
 * spaces**, larger than the ±0.05 this asserted within.
 *
 * ⇒ 🚨 **the spec confirmed whichever conversion was tried last.** When the clef→meter and
 * key→meter arms were unified, the correct `+ bearing` form read 0.80 here and was "corrected" to
 * the wrong one, which read 0.96. Both were ≈0.17 short of the truth; the drawn gaps were 1.0 and
 * 1.16. ⭐ The calibration that proves it is {@link readerInflation} below, and it is part of the
 * spec rather than a comment so that it fails if the instrument ever changes.
 *
 * ⭐⭐ **So the RULE is asserted on the ORIGIN we placed** — the `<text>` `x` attribute, exact, no
 * rounding — and the ink is asserted only as far as the reader can honestly resolve.
 * ⚠️ ⛔ Do not "tighten" the ink assertion back: the number it would agree with is not the truth.
 */
import { test, expect } from './fixtures'

/**
 * The FONT's own numbers, in staff spaces (`fonts/bravuraMetrics`). ⭐ Literals on purpose: they are
 * BRAVURA's measurements of its own outlines, ⛔ not our layout's opinion, so a spec reading them is
 * not agreeing with itself. ⚠️ `timeSig4.left` is NEGATIVE — a digit's ink starts 0.08 sp to the
 * RIGHT of its origin — which is the whole of what the conversion has to get right.
 */
const G_CLEF_INK_RIGHT = 2.684
const TIME_SIG_LEFT_BEARING = -0.08
/** One staff space in the units the `<text>` `x` attributes are written in, at staff size 1. */
const SPACE = 10


/**
 * ⭐ The armed rule, in staff spaces of CLEAR WHITE (`layout/clefMeterGap` — `stone`, his choice).
 *
 * ⚠️ Deliberately a LITERAL and not an import: this file's job is to say what the page actually
 * looks like, and a spec that reads the same constant the drawing reads would agree with itself.
 */
const ARMED_WHITE_SP = 1.0

test('⭐⭐ the clef→meter gap is the ARMED rule — asserted on the ORIGIN, which is exact', async ({ score }) => {
  const placed = await score.evaluate(async () => {
    const h = window.__h
    const out: { clef: string; clefOriginX: number; meterOriginX: number; spacePx: number }[] = []
    for (const clef of ['treble', 'bass', 'alto', 'tenor'] as const) {
      h.engine.setClef(1, clef)
      await h.render()
      // ⭐ The `x` ATTRIBUTE — what our placement wrote, ⛔ not a measured box.
      const clefGlyph = h.glyphs('g.vf-clef text')[0]
      const meterGlyphs = h.glyphs('.vf-timesignature text')
      const stave = h.staves().find(s => s.measure === 1 && s.staff === 0)!
      out.push({
        clef,
        clefOriginX: clefGlyph.x,
        meterOriginX: Math.min(...meterGlyphs.map(g => g.x)),
        spacePx: (stave.bottom - stave.top) / 4,
      })
    }
    return out
  })

  for (const row of placed) {
    // ⚠️ The guard that keeps the two coordinate spaces honest: `glyphs()` reads a raw attribute
    //    while `staves()` composes the CTM, so they are only comparable while the CTM is identity.
    //    ⛔ If a transform ever appears, this fails loudly instead of the numbers drifting.
    expect(row.spacePx, 'the harness page is unscaled').toBeCloseTo(SPACE, 4)
  }

  // ⭐⭐ THE RULE, stated once and checked against what was drawn: the meter's ORIGIN stands at the
  //    clef's ink right, plus the armed clear white, converted to an origin by the digit's own
  //    bearing. Every term is a number somebody CHOSE or the FONT measured — ⛔ none is ours-by-
  //    construction, which is what makes this an assertion rather than an echo.
  const treble = placed.find(p => p.clef === 'treble')!
  const expected = treble.clefOriginX
    + (G_CLEF_INK_RIGHT + ARMED_WHITE_SP + TIME_SIG_LEFT_BEARING) * SPACE
  expect(treble.meterOriginX, 'the armed gap, ink to ink, as an origin').toBeCloseTo(expected, 3)

  // 🚨 The bearing's SIGN, pinned on its own — this is the 0.16 sp the two arms once disagreed by,
  //    and the reason a browser could not adjudicate it. The origin sits BEFORE the ink target.
  const inkTarget = treble.clefOriginX + (G_CLEF_INK_RIGHT + ARMED_WHITE_SP) * SPACE
  expect(treble.meterOriginX, 'a digit’s ink starts right of its origin, so the origin goes EARLIER')
    .toBeLessThan(inkTarget)
  expect(inkTarget - treble.meterOriginX, 'by exactly the bearing').toBeCloseTo(0.8, 3)

  // ⭐ …and the same for every clef, which is what a CLEAR-WHITE rule means: the step from the
  //    clef's own ink right to the meter's origin does not depend on which clef it is.
  for (const row of placed) {
    const step = row.meterOriginX - row.clefOriginX
    const inkRight = row.clef === 'treble' ? G_CLEF_INK_RIGHT : null
    if (inkRight === null) continue
    expect(step / SPACE).toBeCloseTo(inkRight + ARMED_WHITE_SP + TIME_SIG_LEFT_BEARING, 3)
  }
})

/**
 * ⭐⭐ **THE CALIBRATION — how wrong the ink reader is, measured, in the spec that depends on it.**
 *
 * ⚠️ This is here so the claim in the header cannot rot into a comment nobody re-checks: it fails
 * the day `getBoundingClientRect` starts reporting sub-pixel boxes, which would be good news and
 * should be noticed.
 */
test('🚨 readerInflation — every ink box measures ~1 px per side TOO WIDE', async ({ score }) => {
  const rows = await score.evaluate(async () => {
    const h = window.__h
    h.engine.addNoteAtBeat({ step: 'B', octave: 4, duration: 'q', measure: 1, beat: { num: 0, den: 1 } })
    const out: { size: number; headWidthSp: number; clefWidthSp: number }[] = []
    for (const size of [1, 8]) {
      h.engine.setStaffSize(0, size)
      await h.render()
      const stave = h.staves().find(s => s.measure === 1 && s.staff === 0)!
      const sp = (stave.bottom - stave.top) / 4
      out.push({
        size,
        headWidthSp: h.inkSizes('g.vf-notehead text')[0].width / sp,
        clefWidthSp: h.inkSizes('g.vf-clef text')[0].width / sp,
      })
    }
    return out
  })

  const [small, big] = rows
  // The font's own widths (`fonts/bravuraMetrics`): noteheadBlack 1.18, gClef 2.684.
  // ⭐ At 8× the staff a device pixel is 0.0125 sp, so the reader's rounding all but vanishes and
  //    the measurement converges on the FONT — which is what proves the excess is the reader.
  expect(big.headWidthSp, 'a big staff reads the font’s own notehead width').toBeCloseTo(1.18, 1)
  expect(big.clefWidthSp, '…and its own clef width').toBeCloseTo(2.684, 1)
  // ⚠️ …while at staff size 1 both read WIDE, by roughly a pixel a side.
  expect(small.headWidthSp - big.headWidthSp, 'the notehead is inflated at 1×').toBeGreaterThan(0.05)
  expect(small.clefWidthSp - big.clefWidthSp, 'and so is the clef').toBeGreaterThan(0.05)
  // 🚨 ⇒ a WHITE GAP between two boxes is under-reported by the sum of two inflated edges. THAT is
  //    why the rule above is asserted on origins: this error (~0.2 sp) is larger than the 0.16 sp
  //    that told two conversions apart.
})
