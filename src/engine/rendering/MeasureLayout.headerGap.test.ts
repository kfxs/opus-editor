// @vitest-environment jsdom
/**
 * ⭐⭐ **DECISION D, THROUGH A REAL RENDER — the first note sits further in after a clef than after a
 * meter** (Gould p. 42; `docs/header-spacing-research.md` §8 D, his call 2026-09-01).
 *
 * 🚨 **This file exists because nothing failed when the rule changed.** The single `HEADER_TO_NOTE`
 * was applied by two paths — the width path (`MeasureLayout`'s `sharedOverhead`) and the drawing path
 * (`VexFlowRenderer.applyLeadIn`) — and no spec at any level asserted the result, so replacing one
 * constant with two broke not one test in 6187. ⛔ A pure test of `headerToNoteGap` would not have
 * caught it either: the risk was never the arithmetic, it was whether both paths were WIRED to it.
 *
 * ⚠️ Note what is asserted and what is not: the LEAD-IN (`noteStartX − measureX`), which is arithmetic
 * over staff spaces, ⛔ never a glyph's width — jsdom measures every glyph 0
 * (`reference_jsdom_cannot_measure_glyphs`), and the clef's extent here is a measured CONSTANT from
 * `headerInk`, not something the font is asked for.
 */
import { describe, it, expect } from 'vitest'
import { ScoreModel } from '../models/ScoreModel'
import { VexFlowRenderer } from './VexFlowRenderer'
import { CLEF_INDENT_SHIFT, HEADER_TO_NOTE, HEADER_TO_NOTE_AFTER_SIGN } from '@/engine/layout/headerInk'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'
import { fracCreate as frac } from '@/utils/fraction'

/** Render enough bars to be cast off onto more than one system, and report each bar's lead-in. */
function leadIns(bars = 12) {
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

  const bounds = (renderer as unknown as {
    measureBounds: Map<number, { measureX: number; noteStartX: number; headerToNote?: number }>
  }).measureBounds
  return [...bounds.entries()].map(([number, b]) => ({
    number,
    leadIn: (b.noteStartX - b.measureX) / STAFF_SPACE_PX,
    gap: b.headerToNote,
    measureX: b.measureX,
  }))
}

/** The bars that OPEN a system — the ones that draw a header at all. */
function lineOpeners(rows: ReturnType<typeof leadIns>) {
  const first = Math.min(...rows.map(r => r.measureX))
  return rows.filter(r => Math.abs(r.measureX - first) < 0.001).sort((a, b) => a.number - b.number)
}

describe('⭐⭐ the header→first-note gap is keyed on what ENDS the header', () => {
  it('the fixture really does cast off onto more than one system', () => {
    // ⛔ The break-test. Every assertion below compares system 1 against system 2; if the score fitted
    // on one line they would all pass vacuously on a single row.
    expect(lineOpeners(leadIns()).length).toBeGreaterThan(1)
  })

  it('⭐ system 1 opens with a CLEF AND A METER, so it earns the 2.0 gap', () => {
    const [first] = lineOpeners(leadIns())
    expect(first.number).toBe(1)
    expect(first.gap).toBe(HEADER_TO_NOTE)
  })

  it('⭐⭐ every LATER system opens with a clef and no meter, so it earns 2.5', () => {
    const openers = lineOpeners(leadIns())
    for (const opener of openers.slice(1)) {
      expect(opener.gap, `bar ${opener.number} opens a system`).toBe(HEADER_TO_NOTE_AFTER_SIGN)
    }
  })

  it('🚨 …and the extra half-space is REALLY IN THE DRAWING, not just in the reported gap', () => {
    // The assertion that would have failed before D: a later system's lead-in is its clef's extent
    // plus 2.5, where system 1's is clef + between + meter + 2.0. Comparing the two directly would
    // mix in the meter's own width, so this asserts the later system against its OWN parts.
    const openers = lineOpeners(leadIns())
    const later = openers[1]
    // `headerInk`'s measured constant for a line-opening treble clef, PLUS the engraved indentation
    // (decision A) — the clef part carries it, so the lead-in does too.
    const CLEF_TREBLE_FULL = 3.2 + CLEF_INDENT_SHIFT
    expect(later.leadIn).toBeCloseTo(CLEF_TREBLE_FULL + HEADER_TO_NOTE_AFTER_SIGN, 6)
    // …and it is half a space more than the old single constant would have given.
    expect(later.leadIn - (CLEF_TREBLE_FULL + HEADER_TO_NOTE)).toBeCloseTo(0.5, 6)
  })

  it('⚠️ a bar drawing NO header keeps its own lead-in, untouched by either number', () => {
    const rows = leadIns()
    const openers = new Set(lineOpeners(rows).map(r => r.number))
    const inner = rows.filter(r => !openers.has(r.number))
    expect(inner.length).toBeGreaterThan(0)
    for (const bar of inner) {
      expect(bar.leadIn, `bar ${bar.number} draws no header`)
        .toBeLessThan(HEADER_TO_NOTE) // …nowhere near a header's cost
    }
  })
})
