// @vitest-environment jsdom
/**
 * P5.4 — **incremental redraw** (docs/render-performance-plan.md §7a).
 *
 * A render now reuses the measure groups it did not have to redraw. Two things must both be true,
 * and they pull against each other:
 *
 * 1. **It must be fast** — a render that changes nothing must re-engrave nothing.
 * 2. **It must be indistinguishable from a full render** — because a stale group is a *wrong
 *    picture that never repairs itself*, which is far worse than a slow one.
 *
 * Reuse is observable without any test-only API: a reused measure is the **same DOM node** across
 * renders, a redrawn one is a new node. So these tests assert on node identity.
 */
import { describe, it, expect } from 'vitest'
import { ScoreModel } from '../models/ScoreModel'
import { VexFlowRenderer } from './VexFlowRenderer'
import { Renderer } from 'vexflow'
import { laneFingerprint } from './MeasureWidthCache'
import { measureShapeKey } from './MeasureRedrawKey'
import type { Measure } from '@/types/music'
import { fracCreate as frac } from '@/utils/fraction'

/** Minimal shape inputs — the width is held fixed so only CONTENT can move the key. */
function keyInputs(view: Measure) {
  return { view, staffIndex: 0, width: 300, isFirstInLine: true, clef: 'treble' as const, hasClefChange: false }
}

function makeRenderer() {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const renderer = new VexFlowRenderer(container)
  renderer.initialize(1200, 800)
  return renderer
}

/** A score long enough to wrap onto more than one system. */
function buildScore(bars = 12): ScoreModel {
  const model = new ScoreModel()
  for (let i = 1; i < bars; i++) model.addMeasure()
  for (let m = 1; m <= bars; m++) {
    model.addNote({ step: 'C', octave: 4, duration: 'q', measure: m, beat: frac(0, 1) })
    model.addNote({ step: 'E', octave: 4, duration: 'q', measure: m, beat: frac(1, 1) })
  }
  return model
}

/** The identity of every drawn measure group, so we can see which survived a render. */
function groupNodes(renderer: VexFlowRenderer, bars: number): Map<number, SVGGElement | null> {
  const nodes = new Map<number, SVGGElement | null>()
  for (let m = 1; m <= bars; m++) nodes.set(m, renderer.getMeasureSVGGroup(m, 0))
  return nodes
}

/** Which measures were RE-ENGRAVED between two renders (their group is a different node). */
function redrawnMeasures(before: Map<number, SVGGElement | null>, after: Map<number, SVGGElement | null>): number[] {
  return [...after.keys()].filter(m => before.get(m) !== after.get(m))
}

/**
 * Everything the registry knows — **every field**, not just the bbox.
 *
 * The exhaustiveness is the point. A translated measure (P5.4b) has to have every coordinate-bearing
 * field shifted: `bbox`, but also `headX`, `points`, `controlPoints`, `slurEndpoints`,
 * `tupletGeometry`, the staff's line Y positions, the measure bounds. Forgetting one does not crash
 * and does not look wrong — it drifts the *hit-box* away from the *glyph*, so clicks land on the
 * wrong thing, and only for bars that happened to move. Comparing whole elements is what makes that
 * impossible to miss.
 */
function registrySnapshot(renderer: VexFlowRenderer, bars: number, staves = 1) {
  const registry = renderer.getElementRegistry()
  const geometry: string[] = []
  for (let m = 1; m <= bars; m++) {
    for (let s = 0; s < staves; s++) {
      const geo = registry.getStaffGeometry(m, s)
      if (geo) geometry.push(JSON.stringify(geo))
    }
  }
  return {
    elements: registry.getAll().map(el => JSON.stringify(el)).sort(),
    geometry: geometry.sort(),
    bounds: [...renderer.getAllMeasureBounds().entries()]
      .map(([n, b]) => `${n}:${JSON.stringify(b)}`)
      .sort(),
  }
}

describe('P5.4 — incremental redraw', () => {
  it('a render that changes nothing re-engraves NOTHING', () => {
    // This is the slur drag (§7's loudest case, 626 ms across 6 frames): the score does not change,
    // so not one bar should be re-engraved to move a Bézier control point.
    const model = buildScore()
    const renderer = makeRenderer()

    renderer.renderScore(model.getScore())
    const before = groupNodes(renderer, 12)

    renderer.renderScore(model.getScore())
    const after = groupNodes(renderer, 12)

    expect(redrawnMeasures(before, after)).toEqual([])
    // And they are all still really there.
    expect([...after.values()].every(g => g?.isConnected)).toBe(true)
  })

  it('a DYNAMIC redraws its bar — the case a width-keyed cache would silently miss', () => {
    // **The §7a headline, and the reason the redraw key is not the width key.**
    //
    // A dynamic takes no horizontal space, so P2's width fingerprint is BLIND to it — deliberately
    // (§4b excludes dynamics). Had the redraw key simply reused that fingerprint, this measure would
    // be judged "clean", its group would be reused, and the `mf` would never appear. The picture
    // would silently rot while every test about widths stayed green.
    //
    // So: prove the width key does NOT move, that the redraw key DOES, and that the bar redraws.
    const model = buildScore()
    const renderer = makeRenderer()
    renderer.renderScore(model.getScore())
    const before = groupNodes(renderer, 12)

    const laneBefore = model.getScore().measures[0]
    const widthKeyBefore = laneFingerprint(laneBefore, 'treble')
    const drawKeyBefore = measureShapeKey(model.getScore(), keyInputs(laneBefore), null, null)

    model.addDynamic(1, { kind: 'level', level: 'mf', beat: frac(0, 1), voice: 0 })

    const laneAfter = model.getScore().measures[0]
    expect(laneFingerprint(laneAfter, 'treble'), 'the WIDTH key must be blind to a dynamic').toBe(widthKeyBefore)
    expect(measureShapeKey(model.getScore(), keyInputs(laneAfter), null, null), 'the DRAW key must not be').not.toBe(drawKeyBefore)

    renderer.renderScore(model.getScore())
    expect(redrawnMeasures(before, groupNodes(renderer, 12))).toContain(1)
  })

  it('a pitch change redraws ONLY that bar — its neighbours keep their DOM', () => {
    // Re-pitching a note changes the bar's content but not its width, so nothing re-justifies and
    // no neighbour moves. The blast radius should be exactly one bar.
    const model = buildScore()
    const renderer = makeRenderer()
    renderer.renderScore(model.getScore())
    const before = groupNodes(renderer, 12)

    const target = model.getScore().measures[2].slots.find(s => s.type === 'chord')!
    model.updateNote(target.notes[0].id, { step: 'A', octave: 4 })

    renderer.renderScore(model.getScore())
    const after = groupNodes(renderer, 12)

    expect(redrawnMeasures(before, after)).toEqual([3])
  })

  it('an incremental render is INDISTINGUISHABLE from a full one', () => {
    // The correctness half. Whatever reuse saves, it must not change what the renderer ends up
    // believing: same elements, same bboxes, same measure bounds.
    const model = buildScore()

    const incremental = makeRenderer()
    incremental.renderScore(model.getScore()) // full first render
    model.addNote({ step: 'G', octave: 4, duration: 'q', measure: 2, beat: frac(2, 1) })
    model.addDynamic(4, { kind: 'level', level: 'p', beat: frac(0, 1), voice: 0 })
    incremental.renderScore(model.getScore()) // ...then an incremental one

    const fresh = makeRenderer()
    fresh.renderScore(model.getScore()) // the same score, rendered from scratch

    expect(registrySnapshot(incremental, 12)).toEqual(registrySnapshot(fresh, 12))
  })
})

/**
 * P5.4b — **a bar that only MOVED is translated, not re-engraved** (§7a).
 *
 * Measured, not guessed: with position baked into the key, a staff-spacing drag re-engraved 66% of
 * the score on every frame and that one gesture was **53% of all render time** in an ordinary
 * session. Nothing about those bars had changed. They had moved.
 *
 * Linear view is the clean way to provoke it: widen bar 2 and every later bar slides right, with
 * identical content and identical justified width.
 */
describe('P5.4b — a bar that only moved is translated', () => {
  function linearRenderer() {
    const renderer = makeRenderer()
    renderer.setViewMode('linear')
    return renderer
  }

  /** Pack bar 2 with sixteenths so it genuinely gets WIDER — everything after it must slide right. */
  function widenBar2(model: ScoreModel): void {
    for (const [num, den] of [[2, 1], [9, 4], [5, 2], [11, 4], [3, 1], [13, 4], [7, 2], [15, 4]] as const) {
      model.addNote({ step: 'G', octave: 4, duration: '16', measure: 2, beat: frac(num, den) })
    }
  }

  it('bars downstream of an edit KEEP their DOM and are translated', () => {
    const model = buildScore()
    const renderer = linearRenderer()
    renderer.renderScore(model.getScore())
    const before = groupNodes(renderer, 12)
    const xBefore = renderer.getMeasureBounds(5)!.measureX

    widenBar2(model)
    renderer.renderScore(model.getScore())
    const after = groupNodes(renderer, 12)

    // The premise: bar 5 really did move. (Without this, a no-op edit would pass vacuously.)
    expect(renderer.getMeasureBounds(5)!.measureX, 'bar 5 did not move').not.toBe(xBefore)

    // Only bar 2 was re-engraved...
    expect(redrawnMeasures(before, after)).toEqual([2])

    // ...and the bars after it moved by TRANSFORM, keeping their DOM.
    expect(after.get(5)!.getAttribute('transform'), 'bar 5 should have been translated').toMatch(/^translate\(/)
    // Bars BEFORE the edit did not move, so they carry no transform.
    expect(after.get(1)!.getAttribute('transform')).toBeNull()
  })

  it('a translated bar is INDISTINGUISHABLE from a freshly drawn one — every field', () => {
    // The one that catches a forgotten coordinate. If `headX`, a tuplet bracket, a staff line Y or a
    // measure bound is left un-offset, the glyph and its hit-box part company and this goes red.
    const model = buildScore()
    const incremental = linearRenderer()
    incremental.renderScore(model.getScore())

    widenBar2(model)
    incremental.renderScore(model.getScore()) // bars 3..12 translate

    const fresh = linearRenderer()
    fresh.renderScore(model.getScore())

    expect(registrySnapshot(incremental, 12)).toEqual(registrySnapshot(fresh, 12))
  })

  it('translating the same bar repeatedly does not accumulate drift', () => {
    // The offset is measured from where the group was PAINTED, never from where it was last seen —
    // so a bar dragged across many frames carries one exact transform, not a compounding one.
    const model = buildScore()
    const incremental = linearRenderer()
    incremental.renderScore(model.getScore())

    for (const beat of [2, 3]) {
      model.addNote({ step: 'A', octave: 4, duration: '8', measure: 2, beat: frac(beat, 1) })
      incremental.renderScore(model.getScore())
    }
    widenBar2(model)
    incremental.renderScore(model.getScore())

    const fresh = linearRenderer()
    fresh.renderScore(model.getScore())

    expect(registrySnapshot(incremental, 12)).toEqual(registrySnapshot(fresh, 12))
  })

  it("a SPAN's endpoint bars are re-engraved when they move — never translated", () => {
    // Ties and slurs are redrawn every render from their endpoint notes' `StaveNote`s, and a
    // translated bar keeps the StaveNotes it was DRAWN with — which still report the old
    // coordinates. So an anchor bar must be redrawn when it moves, or the slur detaches from its
    // notes. The bars a span merely CROSSES are unaffected and still translate.
    const model = buildScore()
    const m4 = model.getScore().measures[3].slots.find(s => s.type === 'chord')!
    const m7 = model.getScore().measures[6].slots.find(s => s.type === 'chord')!
    model.addSlur({ startNoteId: m4.notes[0].id, endNoteId: m7.notes[0].id, voice: 0 })

    const renderer = linearRenderer()
    renderer.renderScore(model.getScore())
    const before = groupNodes(renderer, 12)

    widenBar2(model)
    renderer.renderScore(model.getScore())
    const after = groupNodes(renderer, 12)

    const redrawn = redrawnMeasures(before, after)
    expect(redrawn, 'the edited bar plus the slur ENDPOINTS').toEqual([2, 4, 7])
    // The bars the slur merely crosses still just translate.
    expect(after.get(5)!.getAttribute('transform')).toMatch(/^translate\(/)
    expect(after.get(6)!.getAttribute('transform')).toMatch(/^translate\(/)
  })

  it('the ghost note still draws after a render — the layout it overlays must survive', () => {
    // REGRESSION. The ghost is an overlay drawn against the LAST render's layout (P4), which lives
    // on `measureLayoutInfo`. That field is *assigned* (not filled) during a render, so the
    // incremental teardown — which runs after the assignment, where the old `clear()` ran before it
    // — emptied the very layout it had just computed. `drawGhostNote` bails on an empty layout, so
    // note-entry mode silently showed no ghost at all, while every other test stayed green.
    const model = buildScore()
    const renderer = makeRenderer()
    renderer.renderScore(model.getScore())

    const drew = renderer.drawGhostNote(model.getScore(), {
      step: 'D', alter: 0, octave: 5, duration: 'q', measure: 2, beat: 2,
    })

    expect(drew, 'the ghost declined to draw').toBe(true)
    expect(renderer.getSVGElement()!.querySelector('.ghost-note-group')).not.toBeNull()

    // ...and it must still work on the render AFTER an incremental one.
    model.addDynamic(1, { kind: 'level', level: 'f', beat: frac(0, 1), voice: 0 })
    renderer.renderScore(model.getScore())
    expect(renderer.drawGhostNote(model.getScore(), {
      step: 'D', alter: 0, octave: 5, duration: 'q', measure: 2, beat: 2,
    })).toBe(true)
  })

  it('clearGhosts removes the group openGroup actually creates — not the one we assumed', () => {
    // REGRESSION, and a naming contract rather than a drawing one.
    //
    // Ghosts are overlays (P4), so hovering does NOT re-render: `clearGhosts()` is the ONLY thing
    // that takes the previous one down, and it matches BY CLASS. Four of the five ghosts build
    // their `<g>` by hand. The tempo ghost is the one that goes through VexFlow's
    // `openGroup('ghost-tempo')` — **which prefixes the class with `vf-` itself**. The selector
    // said `.ghost-tempo`, matched nothing, and so every mouse position left its ghost behind: a
    // permanent blue smear across the score.
    //
    // So don't assert the class we *think* VexFlow produces — ask VexFlow, then require
    // `clearGhosts` to handle exactly that. (The real tempo-ghost draw path can't run here: it
    // needs `getBBox`, which jsdom does not implement.)
    const renderer = makeRenderer()
    renderer.renderScore(buildScore().getScore())
    const svg = renderer.getSVGElement()!

    const probe = new Renderer(document.createElement('div'), Renderer.Backends.SVG).getContext()
    const groupClass = (probe.openGroup('ghost-tempo') as SVGGElement).getAttribute('class')!
    probe.closeGroup()
    expect(groupClass).toBe('vf-ghost-tempo') // VexFlow's prefix — the whole trap

    // A ghost of exactly that shape must be removable.
    const ghost = document.createElementNS('http://www.w3.org/2000/svg', 'g')
    ghost.setAttribute('class', groupClass)
    svg.appendChild(ghost)

    renderer.clearGhosts()
    expect(svg.querySelector(`.${groupClass}`), 'the tempo ghost was never taken down').toBeNull()
  })

  it('a deleted measure leaves nothing behind', () => {
    // measureBounds was never cleared before P5.4 — a removed measure's bounds lingered for the life
    // of the renderer, so a click in empty space could still resolve to a bar that no longer exists.
    const model = buildScore(4)
    const renderer = makeRenderer()
    renderer.renderScore(model.getScore())
    expect(renderer.getMeasureBounds(4)).toBeDefined()

    model.removeMeasure(4)
    renderer.renderScore(model.getScore())

    expect(renderer.getMeasureBounds(4)).toBeUndefined()
    expect(renderer.getMeasureSVGGroup(4, 0)).toBeNull()
    expect(renderer.getSVGElement()!.querySelector('#vf-m4-s0')).toBeNull()
  })
})
