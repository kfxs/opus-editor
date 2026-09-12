/**
 * ⭐⭐ **A CAUTIONARY TIME SIGNATURE STANDS AFTER THE LAST BARLINE** — his report, 2026-09-12, and
 * `docs/barline-types-plan.md` §4.4a.
 *
 * > *"The new time signature is always placed **after the barline**. When a change of time signature
 * > occurs between systems, add a cautionary indication at the end of the first system, **after the
 * > last barline**."* — Gould, *Behind Bars* **p. 152**, read on the scan, with a drawn example.
 *
 * ⚠️⚠️ **The OPPOSITE of a cautionary CLEF**, which all four books put BEFORE the barline
 * (`docs/clef-research.md` §4.3). ⛔ The two cautionaries are not one family, and a test that pinned
 * only one of them would let the other regress — so both sides are asserted here.
 *
 * 🚨 **Why a browser spec**: the positions come from `Stave.format()`'s END walk, which steps back
 * past each modifier by its `Element.getWidth()` — a runtime `measureText` that answers 0 in jsdom.
 * There every end modifier has zero width and they all collapse onto the stave's right edge, so the
 * bug and the fix look identical.
 */
import { test, expect } from './fixtures'

test('⭐⭐ the cautionary meter stands AFTER the closing barline — Gould p. 152', async ({ score }) => {
  const drawn = await score.evaluate(async () => {
    const h = window.__h
    for (let m = 2; m <= 30; m++) h.engine.addMeasure()
    await h.render()
    // ⚠️ Which bar ends line 1 is the casting-off's answer, so ask it rather than assuming — it
    //    moves with every width change (this very file's neighbour moved it twice today).
    const top0 = Math.round(h.staves()[0].top)
    const line1 = h.staves().filter(s => Math.round(s.top) === top0)
    const last = line1[line1.length - 1]
    h.engine.applyTimeSignatureChange(last.measure + 1, {
      timeSignature: { numerator: 6, denominator: 8 }, cautionary: true,
    })
    await h.render()

    const stave = h.staves().find(s => s.measure === last.measure)!
    const near = (x: number) => x >= stave.x1 - 5 && x <= stave.x2 + 80
    return {
      lastBar: last.measure,
      staveEnd: stave.x2,
      // The cautionary's two digits, drawn on the FIRST system (not the new line's own meter).
      meterX: h.placed('.vf-timesignature text')
        .filter(g => near(g.x) && Math.abs(g.y - stave.top) < 80)
        .map(g => g.x),
      barlineX: h.barlines()
        .filter(b => near(b.x) && Math.abs(b.y - stave.top) < 80)
        .map(b => b.x),
    }
  })

  expect(drawn.meterX.length, 'the cautionary 6/8 is drawn at the end of system 1').toBe(2)
  const meter = Math.min(...drawn.meterX)
  // The bar's own closing line is the RIGHTMOST barline standing at this bar.
  const barline = Math.max(...drawn.barlineX)

  // ⭐⭐ **THE RULE**: barline first, then the cautionary. Before 2026-09-12 this was backwards —
  //    the meter sat at 958 and the line at 980, because the pass drew at the stave's right EDGE
  //    while VexFlow had correctly placed the meter OUTSIDE the barline modifier.
  expect(barline, 'the line stands BEFORE the sign it warns with').toBeLessThan(meter)

  // 🚨 The break-test: `toBeLessThan` would also pass if the meter were flung to the far right by
  //    something unrelated. The sign belongs just past the line, still on this system.
  expect(meter - barline, 'and just past it — a gap, not a gulf').toBeGreaterThan(2)
  expect(meter - barline, '…measured in staff spaces, under three of them').toBeLessThan(30)
})

test('⛔ …and a cautionary CLEF stays INSIDE the bar — the opposite rule, four books', async ({ score }) => {
  const drawn = await score.evaluate(async () => {
    const h = window.__h
    for (let m = 2; m <= 30; m++) h.engine.addMeasure()
    await h.render()
    const top0 = Math.round(h.staves()[0].top)
    const line1 = h.staves().filter(s => Math.round(s.top) === top0)
    const last = line1[line1.length - 1]
    h.engine.setClef(last.measure + 1, 'bass')
    // ⚠️ Per-STAFF, unlike the meter's: a transposing part's clef change is its own
    //    (`MusicEngine.setCautionaryClefAllowed(measure, staff, allowed)`).
    h.engine.setCautionaryClefAllowed(last.measure + 1, 0, true)
    await h.render()
    const stave = h.staves().find(s => s.measure === last.measure)!
    const near = (x: number) => x >= stave.x1 - 5 && x <= stave.x2 + 80
    return {
      clefX: h.placed('g.vf-clef text')
        .filter(g => near(g.x) && Math.abs(g.y - stave.top) < 80).map(g => g.x),
      barlineX: h.barlines()
        .filter(b => near(b.x) && Math.abs(b.y - stave.top) < 80).map(b => b.x),
    }
  })

  // ⚠️ The cautionary clef is opt-in per change; if this build did not draw one there is nothing to
  //    assert and the test says so rather than passing vacuously.
  expect(drawn.clefX.length, 'a warning clef at the end of system 1').toBeGreaterThan(0)
  const clef = Math.max(...drawn.clefX)
  const barline = Math.max(...drawn.barlineX)
  // ⭐ Gould p. 7, Ross p. 166, Stone pp. 46/57, Gerou & Lusk p. 27 — all four put it BEFORE the line.
  expect(clef, 'a warning CLEF goes inside the bar, before the barline').toBeLessThan(barline)
})
