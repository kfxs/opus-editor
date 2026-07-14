// @vitest-environment jsdom
/**
 * P5.3 — **tier 1 is complete without tier 2** (docs/render-performance-plan.md §7).
 *
 * The claim the whole two-tier design rests on: *a measure that is never drawn still knows where it
 * is.* `linear-view-plan.md` named the blocker — `ElementRegistry` was populated **as a side effect
 * of drawing**, so culling a measure erased its geometry and broke selection, scroll-into-view and
 * playback-follow for everything off-screen.
 *
 * So this file does the only thing that can actually settle it: render the score twice — once
 * normally, once with **every measure culled** — and assert the tier-1 registry comes out
 * *identical*. If tier 1 ever quietly starts depending on the draw again, these go red.
 *
 * The rule being pinned:
 *
 * > **Tier 1 is what a measure you cannot see must still know. Tier 2 is what only a measure you
 * > can see needs.**
 */
import { describe, it, expect } from 'vitest'
import { ScoreModel } from '../models/ScoreModel'
import { VexFlowRenderer, type MeasureBounds } from './VexFlowRenderer'
import { fracCreate as frac } from '@/utils/fraction'

/** A score with two staves, three bars, notes, an accidental and a mid-measure clef change. */
function buildScore(): ScoreModel {
  const model = new ScoreModel()
  model.addStaff(0, 'below')
  model.addMeasure()
  model.addMeasure()
  model.addNote({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
  model.addNote({ step: 'F', alter: 1, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
  model.addNote({ step: 'G', octave: 4, duration: 'h', measure: 2, beat: frac(0, 1) })
  model.addNote({ step: 'E', octave: 4, duration: 'q', measure: 3, beat: frac(0, 1) })
  return model
}

function makeRenderer() {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const renderer = new VexFlowRenderer(container)
  renderer.initialize(1200, 600)
  return renderer
}

/** Everything tier 1 is responsible for, in a comparable shape. */
function tier1Snapshot(renderer: VexFlowRenderer) {
  const registry = renderer.getElementRegistry()
  const bounds: Record<number, MeasureBounds> = {}
  for (const [n, b] of renderer.getAllMeasureBounds()) bounds[n] = { ...b }

  const geometry: Record<string, unknown> = {}
  for (const measure of [1, 2, 3]) {
    for (const staff of [0, 1]) {
      const geo = registry.getStaffGeometry(measure, staff)
      if (geo) geometry[`m${measure}-s${staff}`] = { ...geo, clefSegments: undefined }
    }
  }

  // The hit-boxes a measure has by virtue of WHERE IT IS, not what is drawn in it.
  const boxes = (['staff', 'clef', 'timeSignature', 'barline'] as const).flatMap(type =>
    registry.getByType(type).map(el => `${type}:m${el.measure}:s${el.staff}:${JSON.stringify(el.bbox)}`),
  )

  return { bounds, geometry, boxes: boxes.sort() }
}

describe('P5.3 — tier 1 stands without tier 2', () => {
  it('a score with NOTHING drawn has exactly the same tier-1 geometry as a fully drawn one', () => {
    const score = buildScore().getScore()

    const full = makeRenderer()
    full.renderScore(score)
    const drawnSnapshot = tier1Snapshot(full)

    const culled = makeRenderer()
    culled.setDrawFilter(() => false) // cull EVERY measure
    culled.renderScore(score)
    const culledSnapshot = tier1Snapshot(culled)

    // Nothing was painted...
    expect(culled.getSVGElement()!.querySelectorAll('g.vf-measure')).toHaveLength(0)
    expect(culled.getMeasureSVGGroup(1, 0)).toBeNull()

    // ...and yet every measure still knows exactly where it is.
    expect(culledSnapshot).toEqual(drawnSnapshot)
  })

  it('the snapshot is substantial — the test above could not pass by comparing two empties', () => {
    const full = makeRenderer()
    full.renderScore(buildScore().getScore())
    const snap = tier1Snapshot(full)

    expect(Object.keys(snap.bounds)).toHaveLength(3) // 3 measures
    expect(Object.keys(snap.geometry)).toHaveLength(6) // 3 measures × 2 staves
    expect(snap.boxes.length).toBeGreaterThan(10)
  })

  it('pixel↔position still resolves inside a culled measure', () => {
    // The blocker, stated concretely: hit-testing an off-screen measure must not depend on its
    // glyphs existing. Bounds + staff geometry are what CoordinateMapper maps through.
    const culled = makeRenderer()
    culled.setDrawFilter(() => false)
    culled.renderScore(buildScore().getScore())

    const registry = culled.getElementRegistry()
    const geo = registry.getStaffGeometry(2, 1)!
    expect(geo).toBeDefined()
    expect(geo.lineYPositions).toHaveLength(5)
    expect(geo.noteEndX).toBeGreaterThan(geo.noteStartX)

    const bounds = culled.getMeasureBounds(2)!
    expect(bounds.measureWidth).toBeGreaterThan(0)
    expect(bounds.noteStartX).toBeGreaterThan(bounds.measureX)
  })

  it('tier 2 — noteheads — is the part that DOES vanish when a measure is not drawn', () => {
    // The other half of the rule. If culling dropped nothing, the tiers would be pointless.
    const full = makeRenderer()
    full.renderScore(buildScore().getScore())
    expect(full.getElementRegistry().getByType('note').length).toBeGreaterThan(0)

    const culled = makeRenderer()
    culled.setDrawFilter(() => false)
    culled.renderScore(buildScore().getScore())
    expect(culled.getElementRegistry().getByType('note')).toHaveLength(0)
  })
})
