// @vitest-environment jsdom
/**
 * Subject: `./headerPlacementPass` — where each sign of the header stands.
 *
 * ⭐⭐ **DECISION A — the clef's INDENTATION, measured in a real render**
 * (`docs/header-spacing-research.md` §8 A / §3.4, his call 2026-09-01). ⚠️ This spec moved here with
 * the code on 2026-09-13, when the indent stopped being a NUDGE applied to VexFlow's 0.5 and became
 * a PLACEMENT stated from the staff's own edge. The assertions did not change: the drawn answer is
 * the same 0.7, which is the point of doing it that way.
 *
 * 🚨 **The gap this pass exists for was never a wrong number — it was an ABSENT one.** VexFlow put a
 * line-opening clef 0.50 staff spaces inside the staff, which is its own opening barline's width and
 * not a decision anybody took; the number was then absorbed invisibly inside `headerInk`'s
 * `CLEF_FULL`, so nothing in this editor even named it. Three sources agree on ~0.6–0.8 (Gould p. 6
 * drawn 0.67–0.74, Gerou & Lusk 0.62–0.70, Ross p. 144 *"½ to 1 space"*), and he chose **0.7**.
 *
 * ⚠️ **jsdom can measure this and it is not a glyph measurement.** The assertion is the clef `<text>`
 * element's own `x` ATTRIBUTE against the stave line's start — both are numbers our layout put there,
 * ⛔ never an ink extent, which would be 0 without a font (`reference_jsdom_cannot_measure_glyphs`).
 */
import { describe, it, expect } from 'vitest'
import { ScoreModel } from '../models/ScoreModel'
import { VexFlowRenderer } from './VexFlowRenderer'
import { CLEF_INDENT } from '@/engine/layout/headerInk'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'
import { fracCreate as frac } from '@/utils/fraction'

/** Render a score long enough to be cast off, and report each bar's clef indent in staff spaces. */
function indents(bars = 12) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const renderer = new VexFlowRenderer(container)
  renderer.initialize(700, 900)

  const model = new ScoreModel()
  for (let i = 1; i < bars; i++) model.addMeasure()
  for (let b = 1; b <= bars; b++) {
    model.addNote({ step: 'C', octave: 5, duration: 'q', measure: b, beat: frac(0, 1) })
  }
  renderer.renderScore(model.getScore())

  const rows: { id: string; indent: number }[] = []
  for (const group of container.querySelectorAll('g.vf-measure[id]')) {
    // ⛔ `g.vf-clef text` ONLY — a looser selector falls through to the first notehead in bars that
    //    draw no clef, which reads as a plausible-but-meaningless indent.
    const clef = group.querySelector('g.vf-clef text')
    const staveLine = group.querySelector('g.vf-stave path')
    if (!clef || !staveLine) continue
    const staveX = Number((staveLine.getAttribute('d') ?? '').match(/M\s*(-?[\d.]+)/)?.[1])
    const clefX = Number(clef.getAttribute('x'))
    if (!Number.isFinite(staveX) || !Number.isFinite(clefX)) continue
    rows.push({ id: group.getAttribute('id') ?? '?', indent: (clefX - staveX) / STAFF_SPACE_PX })
  }
  return rows
}

describe('⭐⭐ a line-opening clef is indented into the stave', () => {
  it('the fixture really does draw clefs, on more than one system', () => {
    // ⛔ The break-test: every assertion below is over this list, and a selector that matched nothing
    //    would let them all pass vacuously.
    const rows = indents()
    expect(rows.length, 'clefs found').toBeGreaterThan(1)
  })

  it('⭐ …by exactly the engraved indentation, and every system agrees', () => {
    for (const row of indents()) {
      expect(row.indent, row.id).toBeCloseTo(CLEF_INDENT, 6)
    }
  })

  it('🚨 …which is NOT VexFlow\'s 0.5 — the number nobody had ever chosen', () => {
    const [first] = indents()
    expect(first.indent).toBeGreaterThan(0.5)
    // …and it sits inside the range all three books draw or state (§3.4).
    expect(first.indent).toBeGreaterThanOrEqual(0.6)
    expect(first.indent).toBeLessThanOrEqual(0.8)
  })

  it('⭐ Gould draws "a little less" than the one space she names — and so do we', () => {
    // p. 6: "indented into the stave by one stave-space (⌐) or a little less", drawn 0.67–0.74.
    expect(CLEF_INDENT).toBeLessThan(1)
    expect(CLEF_INDENT).toBeGreaterThanOrEqual(0.67)
    expect(CLEF_INDENT).toBeLessThanOrEqual(0.74)
  })
})
