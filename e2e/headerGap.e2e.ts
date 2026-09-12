/**
 * ⭐⭐ **THE CLEF → TIME SIGNATURE GAP, MEASURED IN INK** — `engine/layout/clefMeterGap`,
 * `docs/header-spacing-research.md` §4.4/§4.5/§5.6.
 *
 * 🚨 **Why this is a browser spec and cannot be a unit one.** `Stave.format()`'s begin walk reads
 * `padding = modifier.getPadding(i + offset)` and then `if (padding + width === 0) offset--`. In
 * jsdom every glyph measures 0×0, so the zero-width clef decrements the offset and the time
 * signature is asked for `getPadding(1)` — which is 0. ⇒ ⛔ **in jsdom a zero-width modifier eats the
 * next one's padding**, and the clef and meter coincide whatever the armed rule says
 * (`VexFlowRenderer.scene.test.ts` records this at the assertion that proves it).
 *
 * ⭐ Here the glyphs are real, so the CLEAR WHITE can be measured — which is the unit every engine
 * and three of the four books use for this pair.
 */
import { test, expect } from './fixtures'

/**
 * ⭐ The armed rule, in staff spaces of CLEAR WHITE (`layout/clefMeterGap` — `stone`, his choice).
 *
 * ⚠️ Deliberately a LITERAL and not an import: this file's job is to say what the page actually
 * looks like, and a spec that reads the same constant the drawing reads would agree with itself.
 */
const ARMED_WHITE_SP = 1.0

test('⭐⭐ the clef→meter white gap is the ARMED rule — 1.0 sp, and the same for every clef', async ({ score }) => {
  const measured = await score.evaluate(async () => {
    const h = window.__h
    const out: { clef: string; whiteSp: number }[] = []
    for (const clef of ['treble', 'bass', 'alto', 'tenor'] as const) {
      h.engine.setClef(1, clef)
      await h.render()
      const clefInk = h.inkSizes('g.vf-clef text')[0]
      const meterInk = h.inkSizes('.vf-timesignature text')
      const meterLeft = Math.min(...meterInk.map(m => m.x))
      out.push({ clef, whiteSp: (meterLeft - (clefInk.x + clefInk.width)) / 10 })
    }
    return out
  })

  // ⭐ The armed row is `stone` — 1.0 sp: Stone p. 44's sentence, MuseScore's `clefTimesigDistance`
  //   and Verovio's margins all landing on the same number, and HIS choice on 2026-09-12.
  //
  // ⚠️ **Measured 0.98, and the tolerance is the INSTRUMENT's, not slack in the rule.** Two known
  //    sub-pixel terms live inside it and neither is worth chasing here: a digit's ink starts
  //    0.08 sp before its origin (`timeSig4.left`), and the clef's drawn box and its font ink differ
  //    by 0.02 sp (`headerInkRightX`'s own measurement). `getBoundingClientRect` reports text in
  //    whole device pixels, so 0.1 sp is the finest this reader resolves — which is why the
  //    assertion is on the RULE and not on a modelled correction of it.
  for (const { clef, whiteSp } of measured) {
    expect(whiteSp, `${clef}: the armed clear white`).toBeCloseTo(ARMED_WHITE_SP, 1)
  }

  // 🚨🚨 **The assertion that would have caught the old defect**: before 2026-09-12 this gap was
  //    VexFlow's `customPadding` of 15 px — 1.42 sp — and the give-away was that it came out
  //    IDENTICAL for all four clefs *because nothing derived it from a glyph*. It is still identical
  //    now, but for the opposite reason: the rule is a clear white, so it is glyph-independent BY
  //    CONSTRUCTION. ⇒ what this pins is that we are no longer at 1.42.
  const spread = Math.max(...measured.map(m => m.whiteSp)) - Math.min(...measured.map(m => m.whiteSp))
  expect(spread, 'a clear-white rule is the same for every clef').toBeLessThan(0.15)
  expect(measured[0].whiteSp, '⛔ not VexFlow’s unchosen 1.42').toBeLessThan(1.2)
  // ⭐ Pleasingly, 0.98 is also exactly what Ross's own p. 145 plate measures (§4.5).
})
