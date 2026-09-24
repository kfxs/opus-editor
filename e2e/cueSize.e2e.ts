/**
 * ⭐ **A CUE NOTE'S INK, MEASURED** (docs/plans/cue-size-plan.md P1) — the half of the proof jsdom cannot
 * give (every glyph measures 0 there; `EngravedNote.cue.test.ts` holds the font sizes, the stem length and
 * the ledger). The same dotted C♯4 eighth in two bars, the second cue: each part's DRAWN box in Chromium.
 *
 * ⭐ What it proves: the head, accidental, dot and flag come out ¾ as wide and tall as the full note's, and
 * the stem stands at the SMALL head's edge (the note's x's follow its measured head, not a full one).
 */
import { test, expect } from './fixtures'

test('⭐ a cue note’s head, sign, dot and flag are drawn at ¾, and its stem meets the small head', async ({ score }) => {
  const bars = await score.evaluate(async () => {
    const h = window.__h
    h.engine.addMeasure()
    const add = (measure: number) => h.engine.addNoteAtBeat({
      step: 'C', alter: 1, octave: 4, duration: '8', dots: 1, measure, beat: h.frac(0, 1), beam: 'single' as const,
    })!
    add(1)
    h.engine.cue.set([add(2).id], true)
    await h.render()
    const box = (el: Element | null) => {
      if (!el) return null
      const b = (el as SVGGraphicsElement).getBBox()
      return { x: b.x, y: b.y, w: b.width, h: b.height }
    }
    return [...document.querySelectorAll('g.measure')].slice(0, 2).map(bar => ({
      head: box(bar.querySelector('g.notehead > text')),
      accidental: box(bar.querySelector('g.accidental text')),
      dot: box(bar.querySelector('g.dot text')),
      flag: box(bar.querySelector('g.flag text')),
      stem: box(bar.querySelector('g.stem path')),
    }))
  })
  const [full, cue] = bars
  for (const part of ['head', 'accidental', 'dot', 'flag'] as const) {
    expect(full[part], `${part} drawn at full size`).not.toBeNull()
    expect(cue[part], `${part} drawn at cue size`).not.toBeNull()
    // ⚠️ getBBox of a <text> is its EM box, not its ink (`reference_a_throwaway_chromium_probe_measures_the_page`):
    //   both scale with the font, so the ratio is the size either way. 🚨 Its WIDTH is the glyph's advance in
    //   WHOLE px (measured 2026-09-24: head 12 → 9, sign 10 → 8, dot 4 → 3, flag 11 → 8), so a width is
    //   ¾ to within a pixel; the HEIGHT (the em) is exact (160 → 120).
    expect(Math.abs(cue[part]!.w - full[part]!.w * 0.75), `${part} width`).toBeLessThanOrEqual(1)
    expect(cue[part]!.h / full[part]!.h, `${part} height`).toBeCloseTo(0.75, 3)
  }
  // ⭐ The stem stands at the head's right edge (stem up) — the SMALL head's, one stem width in.
  const headRight = (b: typeof full) => b.head!.x + b.head!.w
  expect(Math.abs(cue.stem!.x - headRight(cue)), 'the cue stem meets the cue head').toBeLessThan(2)
  expect(Math.abs((cue.stem!.x - cue.head!.x) - (full.stem!.x - full.head!.x) * 0.75)).toBeLessThan(1)
})
