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

/**
 * ⭐ **A small head shares a full head's CENTRE** — his question, 2026-09-24. The rule: Gould p. 569 (a cue
 * note keeps the full staff's pitch positions — its ledgers are *"the same vertical distance apart"*);
 * MuseScore places a note at `(line + stepOffset) × stepDistance` whatever its mag (`chordlayout.cpp:2789`),
 * Verovio at `CalcPitchPosYRel(loc)`; a SMuFL head is centred on its baseline (Bravura `noteheadBlack`: 0.5 sp
 * up, 0.5 down), so shrinking it about that point keeps its centre. ⭐ Measured here: the INK centre of a
 * full, a cue and a grace head — on a line (E4) and in a space (F4) — lands on the same y.
 *
 * ⭐⭐ …and that centre IS the middle of the line or space, measured against the staff lines the page drew.
 * 🚨 The first version compared the heads with EACH OTHER only, and passed while every note stood ½ a staff
 * line's thickness above the middle — the lines hung DOWN from their y (VexFlow's crispness idiom) while notes
 * were centred on it. His screenshot caught it (*"touching up line and there is empty space in the low
 * line"*); fixed 2026-09-24 by centring the line, as LilyPond, MuseScore and Verovio all do
 * (`engrave/staff/staffLines`).
 */
test('⭐ cue and grace heads centre on their line or space — as a full head does', async ({ score }) => {
  const measured = await score.evaluate(async () => {
    const h = window.__h
    const put = (step: string, beat: number) => h.engine.addNoteAtBeat({ step, alter: 0, octave: 4, duration: 'q', measure: 1, beat: h.frac(beat, 1) })!
    const notes = [put('E', 0), put('F', 1), put('E', 2), put('F', 3)]
    h.engine.cue.set([notes[2].id, notes[3].id], true)
    for (const [i, n] of notes.entries()) h.engine.grace.addGrace(n.id, 'before', { step: i % 2 ? 'F' : 'E', alter: 0, octave: 4 }, 'appoggiatura', { duration: '8' })
    await h.render()
    const svg = document.querySelector('svg') as SVGGraphicsElement
    const toPage = svg.getScreenCTM()!.inverse()
    const ctx = document.createElement('canvas').getContext('2d')!
    // The first stave's lines, where the page STROKED them (a staff line's path is centred on its line).
    const strokeYs = [...document.querySelectorAll('g.stave path')].slice(0, 5)
      .map(p => Number(/M\s*[-\d.]+\s+([-\d.]+)/.exec(p.getAttribute('d') ?? '')?.[1]))
      .sort((a, b) => a - b)
    const lines = { bottom: strokeYs[4], second: strokeYs[3] }
    // Every notehead glyph, left to right, with its ink centre in page y (through any grace group's scale).
    const heads = [...document.querySelectorAll('text')]
      .filter(t => { const cp = (t.textContent ?? '').codePointAt(0) ?? 0; return cp >= 0xe0a0 && cp <= 0xe0ff })
      .map(t => {
        const style = getComputedStyle(t)
        ctx.font = `${style.fontSize} ${style.fontFamily}`
        const m = ctx.measureText(t.textContent!)
        const x = parseFloat(t.getAttribute('x')!)
        const y = parseFloat(t.getAttribute('y')!)
        const M = toPage.multiply((t as SVGGraphicsElement).getScreenCTM()!)
        const top = new DOMPoint(x, y - m.actualBoundingBoxAscent).matrixTransform(M)
        const bottom = new DOMPoint(x, y + m.actualBoundingBoxDescent).matrixTransform(M)
        return { x: top.x, size: style.fontSize, centre: (top.y + bottom.y) / 2 }
      })
      .sort((a, b) => a.x - b.x)
    return { heads, lines }
  })
  const { heads: centres, lines } = measured
  // Left to right: grace E, full E, grace F, full F, grace E, cue E, grace F, cue F.
  expect(centres).toHaveLength(8)
  const [gE1, fullE, gF1, fullF, gE2, cueE, gF2, cueF] = centres
  expect(cueE.size).not.toBe(fullE.size)
  // ⚠️ Chromium reports ink in whole pixels, so a head's centre is known to ½ px.
  for (const e of [cueE, gE1, gE2]) expect(Math.abs(e.centre - fullE.centre), 'on the line').toBeLessThanOrEqual(0.5)
  for (const f of [cueF, gF1, gF2]) expect(Math.abs(f.centre - fullF.centre), 'in the space').toBeLessThanOrEqual(0.5)
  // ⭐⭐ …against the LINES: E4 on the bottom line's middle, F4 midway between the bottom two.
  for (const e of [fullE, cueE, gE1, gE2]) expect(Math.abs(e.centre - lines.bottom), 'E4 on the bottom line').toBeLessThanOrEqual(0.5)
  for (const f of [fullF, cueF, gF1, gF2]) expect(Math.abs(f.centre - (lines.bottom + lines.second) / 2), 'F4 mid-space').toBeLessThanOrEqual(0.5)
})

/** ⭐ P5 — a cue note's HIT BOX is its small head: the registry files the drawn head's centre and width. */
test('⭐ a cue note’s hit box is its drawn head — centre and width', async ({ score }) => {
  const r = await score.evaluate(async () => {
    const h = window.__h
    const n = h.engine.addNoteAtBeat({ step: 'A', alter: 0, octave: 4, duration: 'q', measure: 1, beat: h.frac(0, 1) })!
    h.engine.cue.set([n.id], true)
    await h.render()
    const head = (document.querySelector('g.notehead > text') as SVGGraphicsElement).getBBox()
    const filed = ((h.engine as unknown as { renderer: { getElementRegistry(): { getAll(): { type: string; id: string; headX?: number; bbox: { width: number } }[] } } })
      .renderer.getElementRegistry().getAll()).find(e => e.type === 'note' && e.id === n.id)!
    return { headCentre: head.x + head.width / 2, headWidth: head.width, filedX: filed.headX!, filedWidth: filed.bbox.width }
  })
  expect(Math.abs(r.filedX - r.headCentre)).toBeLessThanOrEqual(1)
  expect(Math.abs(r.filedWidth - r.headWidth)).toBeLessThanOrEqual(1)
})

/**
 * ⭐ P6 — a CLOSED-UP cue (C8, Gould p. 569): a bar of cue quarters stands them closer than the same bar at full
 * size — the gap between heads about ¾ as wide under `gould` (the springs × the cue size; the justification
 * shares the system's surplus by the same springs).
 */
test('⭐ a bar of cue notes is closed up: its note gaps about ¾ of a full bar’s', async ({ score }) => {
  const gaps = await score.evaluate(async () => {
    const h = window.__h
    h.engine.addMeasure()
    const ids: string[] = []
    for (const bar of [1, 2]) {
      for (let b = 0; b < 4; b++) {
        const n = h.engine.addNoteAtBeat({ step: 'C', alter: 0, octave: 5, duration: 'q', measure: bar, beat: h.frac(b, 1) })!
        if (bar === 2) ids.push(n.id)
      }
    }
    h.engine.cue.set(ids, true)
    await h.render()
    const xs = h.noteheads().map(n => n.x).sort((a, b) => a - b)
    const gap = (from: number) => (xs[from + 3] - xs[from]) / 3
    return { full: gap(0), cue: gap(4) }
  })
  expect(gaps.cue / gaps.full).toBeGreaterThan(0.65)
  expect(gaps.cue / gaps.full).toBeLessThan(0.85)
})
