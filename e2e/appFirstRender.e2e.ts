import { test, expect } from '@playwright/test'

/**
 * ⭐⭐ **THE APP'S OWN FIRST RENDER** — the one drawing in the project that no other e2e spec covers.
 *
 * Every other spec drives `e2e/harness.ts`, which awaits the music font before it engraves. That is
 * correct for a geometry spec, and it is exactly why the net had a hole: what was broken was the
 * path the harness deliberately does not take — `App.ts` booting and painting the score, before
 * Bravura had loaded.
 *
 * ## What goes wrong without the gate
 *
 * VexFlow carries no metrics table for its music font: `Element.measureText()` asks a canvas for
 * `measureText(glyph)` and engraves to the answer. Measured in Chromium, the whole-rest glyph
 * U+E4E3 is **30.3px** wide in the fallback face and **11.0px** in Bravura — so a render that beats
 * the font puts every empty bar's rest `(11 − 30.3) / 2` ≈ **9.7px LEFT of its bar's centre**, which
 * is about one staff space.
 *
 * His report: *"the rests are not centered in relation to the measure… particularly when opening the
 * app for the first time."* The intermittency was a race — whether some early resize/scroll
 * re-render happened to land after the font.
 *
 * ⚠️ The picture then LOOKS half-right and stays wrong, which is what made it hard to place: the
 * browser repaints every `<text>` in Bravura the moment the face lands, so the rest is a proper
 * whole rest sitting at a coordinate computed from somebody else's metrics.
 *
 * ⚠️ **Re-rendering does not repair it**, which is why the fix is a gate and not a retry: a measure
 * whose `MeasureRedrawKey` is unchanged is moved by transform rather than re-engraved, and the font
 * is not (and cannot be) in that key.
 *
 * ⛔ This spec must NOT wait for fonts, reload, or interact before it measures. Its whole subject is
 * the picture the app paints unprompted. The measurement is deliberately taken AFTER the face has
 * landed — the drawn glyph is then the real one, so what is left is purely where it was PUT.
 */
test("⭐ the app's FIRST render centres a whole-bar rest — it does not beat the music font", async ({ page }) => {
  const crashes: string[] = []
  page.on('pageerror', error => crashes.push(String(error)))

  // The real editor, not the harness. `/opus-editor/` is vite.config.ts's `base`.
  await page.goto('/opus-editor/index.html')
  // The score's SVG appearing IS the first render finishing — the app draws once at boot.
  await page.waitForSelector('.score-zoom-layer svg g.vf-measure')

  const bars = await page.evaluate(async () => {
    // Only so the drawn glyph is Bravura by the time we measure its width. It changes nothing about
    // where the render PUT it, which is the subject.
    await document.fonts.ready

    const root = document.querySelector<SVGSVGElement>('.score-zoom-layer svg')!
    const toScore = root.getScreenCTM()!.inverse()
    // The zoom layer carries a CSS transform, so nothing may be read off an attribute: compose each
    // element's own CTM back into the SVG's space, the way `harness.staves()` does.
    const inScoreSpace = (el: Element, x: number, y: number) => {
      const point = root.createSVGPoint()
      point.x = x
      point.y = y
      return point.matrixTransform((el as SVGGraphicsElement).getScreenCTM()!).matrixTransform(toScore)
    }

    return [...root.querySelectorAll<SVGGElement>('g.vf-measure[id]')].flatMap(group => {
      // A stave line is a two-point horizontal path; the outer pair gives the staff space and the
      // run gives the bar's own extent.
      const ends = [...group.querySelectorAll<SVGPathElement>('g.vf-stave path')].flatMap(path => {
        const d = /M\s*([\d.-]+)[\s,]+([\d.-]+)\s*L\s*([\d.-]+)[\s,]+([\d.-]+)/.exec(path.getAttribute('d') ?? '')
        if (!d) return []
        const a = inScoreSpace(path, parseFloat(d[1]), parseFloat(d[2]))
        const b = inScoreSpace(path, parseFloat(d[3]), parseFloat(d[4]))
        return Math.abs(a.y - b.y) < 0.001 ? [{ a, b }] : []
      })
      if (ends.length < 5) return []
      const x1 = Math.min(...ends.map(e => e.a.x))
      const x2 = Math.max(...ends.map(e => e.b.x))
      const top = Math.min(...ends.map(e => e.a.y))
      const bottom = Math.max(...ends.map(e => e.a.y))

      // A rest is drawn as a `vf-notehead` too, so SMuFL's own range is the only thing that tells one
      // from the other (`harness.rests()`): rests are U+E4E0–E4FF.
      const rest = [...group.querySelectorAll<SVGTextElement>('g.vf-notehead text')].find(t => {
        const code = (t.textContent ?? '').codePointAt(0) ?? 0
        return code >= 0xe4e0 && code <= 0xe4ff
      })
      if (!rest) return []
      const anchor = inScoreSpace(rest, parseFloat(rest.getAttribute('x') ?? '0'), 0)
      // ⚠️ `getComputedTextLength()` is used as a SIZE and never as a position — which is what
      //    centring needs (half a glyph), and why it is safe here.
      const width = rest.getComputedTextLength()

      return [{
        // The group id is the renderer's own measure key: `vf-m<measure>-s<staff>`.
        measure: Number(/^vf-m(\d+)-s\d+$/.exec(group.getAttribute('id') ?? '')?.[1] ?? -1),
        top,
        x1,
        space: (bottom - top) / 4,
        off: (anchor.x + width / 2) - (x1 + x2) / 2,
      }]
    })
  })

  expect(crashes, 'nothing threw in the page').toEqual([])
  expect(bars.length, 'the empty score drew its measure rests').toBeGreaterThan(4)

  // A system's OPENING bar centres its rest in the room left after the clef and meter, not between
  // its barlines — Gould, and what `centerMeasureRests` has always done. So it is off by design, and
  // the bars to judge are the ones with no header: everything but the leftmost of each system.
  const leftmostOfSystem = new Map<number, number>()
  for (const bar of bars) {
    const row = Math.round(bar.top)
    leftmostOfSystem.set(row, Math.min(leftmostOfSystem.get(row) ?? Infinity, bar.x1))
  }
  const headerless = bars.filter(b => b.x1 > (leftmostOfSystem.get(Math.round(b.top)) ?? 0) + 1)
  expect(headerless.length, 'there are headerless bars to judge').toBeGreaterThan(3)

  const offsets = headerless.map(b => b.off / b.space)
  console.log(`[census] first-render measure rests, staff spaces off centre: ${
    offsets.map(o => o.toFixed(2)).join(' ')}`)

  // ⭐ THE STATEMENT. Without the gate every one of these is about −1 staff space (the fallback
  //   `.notdef` box is ~2.75× the real whole rest, and half that error is the shift).
  for (const [i, off] of offsets.entries()) {
    expect(Math.abs(off), `bar ${headerless[i].measure} is centred in its own bar`).toBeLessThan(0.15)
  }
})
