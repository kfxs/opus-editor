// @vitest-environment jsdom
/**
 * ⭐⭐ **DOES THE LEFT-EDGE INDENT ACTUALLY REACH THE LAYOUT?** — P2 of docs/braces-brackets-plan.md.
 *
 * A **feature test** rather than one module's: the claim spans `models/staffGroups` (which signs
 * stand), `layout/systemStartColumn` (what they take), `MeasureLayout` (the casting-off that gets
 * less room) and `VexFlowRenderer` (which surface each reader is handed), and belongs to none of
 * them. Each of those has its own spec for its own arithmetic; ⛔ **none of them can catch a wire
 * that was never connected**, which is the only thing this file is here for.
 *
 * ## 🚨 Why it needs its own file at all
 *
 * The wiring is **inert for every score in the repo** — no score has an authored `symbol`, so the
 * whole 5600-test suite passing says nothing about it. ⭐ That inertness is the FEATURE (the plan's
 * §1a: a `symbol` is what says a sign was asked for), and it is exactly what makes a green suite
 * worthless as evidence here. So this file authors one and watches the picture move.
 *
 * ⚠️ Stave arithmetic and layout numbers only — jsdom has no fonts, so nothing here reads a glyph.
 */
import { describe, it, expect } from 'vitest'
import { ScoreModel } from '@/engine/models/ScoreModel'
import { VexFlowRenderer } from '../VexFlowRenderer'
import { scoreSystemStartIndentPx } from '@/engine/layout/systemStartColumn'
import { fracCreate as frac } from '@/utils/fraction'
import type { Score } from '@/types/music'

/** A grand staff with enough bars to make the casting-off say something. */
function buildScore(): ScoreModel {
  const model = new ScoreModel()
  model.addStaff(0, 'below')
  for (let i = 0; i < 11; i++) model.addMeasure()
  for (let bar = 1; bar <= 12; bar++) {
    model.addNote({ step: 'C', octave: 4, duration: 'q', measure: bar, beat: frac(0, 1) })
    model.addNote({ step: 'G', octave: 3, duration: 'q', measure: bar, beat: frac(0, 1), staff: 1 })
  }
  return model
}

/** ⭐ Author a sign the way P5's rule does — on the staves a selection names. */
function brace(score: Score): Score {
  // ⭐ AUTHORED, the way P5's rule does it: a sign applies to the staves the selection names.
  // 🚨 This used to reach for a group the MODEL had created (`ensureSingleGroupSpansAllStaves`) and
  //    only supply its `symbol`. That writer is gone since 2026-08-29 — the user owns membership —
  //    so the test now authors the whole group, which is what the app does.
  expect(score.staffGroups, 'the model invents no group').toBeUndefined()
  score.staffGroups = [{ id: 'g1', staffIds: score.staves!.map(s => s.id), symbol: 'brace' }]
  return score
}

function makeRenderer(): VexFlowRenderer {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const renderer = new VexFlowRenderer(container)
  renderer.initialize(1200, 600)
  return renderer
}

/** Where bar 1's staff actually starts, as tier 1 registered it. */
function firstBarX(renderer: VexFlowRenderer): number {
  return renderer.getAllMeasureBounds().get(1)!.measureX
}

/** The justified widths of every bar on the first system. */
function firstLineWidths(renderer: VexFlowRenderer): number[] {
  return [...renderer.getMeasureLayoutInfo().values()]
    .filter(info => info.lineNumber === 0)
    .map(info => info.finalWidth)
}

describe('a score with no authored symbol', () => {
  it('⭐⭐ is byte-identical — the indent is ZERO and nothing moves', () => {
    const model = buildScore()
    expect(scoreSystemStartIndentPx(model.getScore())).toBe(0)

    const plain = makeRenderer()
    plain.renderScore(model.getScore())
    const before = { x: firstBarX(plain), widths: firstLineWidths(plain) }

    // Re-render the same score through a fresh renderer: same answer, so the wiring adds nothing.
    const again = makeRenderer()
    again.renderScore(model.getScore())
    expect(firstBarX(again)).toBe(before.x)
    expect(firstLineWidths(again)).toEqual(before.widths)
  })
})

describe('a score with a brace — 🚨 the wire this file exists to prove', () => {
  it('⭐⭐ pushes the music RIGHT by exactly the indent', () => {
    const plain = makeRenderer()
    plain.renderScore(buildScore().getScore())
    const plainX = firstBarX(plain)

    const model = buildScore()
    const braced = brace(model.getScore())
    const indent = scoreSystemStartIndentPx(braced)
    expect(indent).toBeGreaterThan(0)

    const r = makeRenderer()
    r.renderScore(braced)
    expect(firstBarX(r) - plainX).toBeCloseTo(indent, 6)
  })

  it('⭐⭐ …and takes that room OFF THE MUSIC, not off the paper — the system is narrower', () => {
    const plain = makeRenderer()
    plain.renderScore(buildScore().getScore())
    const plainTotal = firstLineWidths(plain).reduce((a, b) => a + b, 0)

    const model = buildScore()
    const braced = brace(model.getScore())
    const indent = scoreSystemStartIndentPx(braced)

    const r = makeRenderer()
    r.renderScore(braced)
    const bracedTotal = firstLineWidths(r).reduce((a, b) => a + b, 0)

    // ⚠️ Only comparable while the same bars share the system — a re-wrap would change the sum for
    // a different reason. Asserted, so a failure here reads as "it re-wrapped", not "it drifted".
    expect(firstLineWidths(r), 'the same bars still share system 0').toHaveLength(
      firstLineWidths(plain).length)
    expect(plainTotal - bracedTotal).toBeCloseTo(indent, 6)
  })

  it('🚨 the RIGHT edge does not move — ⛔ the indent is never borrowed from the margin', () => {
    const model = buildScore()
    const braced = brace(model.getScore())
    const r = makeRenderer()
    r.renderScore(braced)

    const plain = makeRenderer()
    plain.renderScore(buildScore().getScore())

    const rightEdge = (renderer: VexFlowRenderer) =>
      firstBarX(renderer) + firstLineWidths(renderer).reduce((a, b) => a + b, 0)
    expect(rightEdge(r)).toBeCloseTo(rightEdge(plain), 6)
  })

  it('⛔ a group with NO symbol still moves nothing — the gate, at the far end of the wire', () => {
    const plain = makeRenderer()
    plain.renderScore(buildScore().getScore())
    const plainX = firstBarX(plain)

    // A group with membership but NO symbol — nobody has asked for a sign.
    const model = buildScore()
    const score = model.getScore()
    score.staffGroups = [{ id: 'g1', staffIds: score.staves!.map(s => s.id) }]
    const r = makeRenderer()
    r.renderScore(model.getScore())
    expect(firstBarX(r)).toBe(plainX)
  })
})
