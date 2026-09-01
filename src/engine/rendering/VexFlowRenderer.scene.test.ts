// @vitest-environment jsdom
/**
 * ⭐⭐ **THE PAYOFF — GEOMETRY AS A UNIT TEST** (`docs/own-engraving-engine.md` §7.2, P1d).
 *
 * > *"'the whole-bar rest is centred in its bar' becomes an assertion on a scene, in jsdom, in
 * > milliseconds. This is the single most valuable item in this document — it is worth more than
 * > the golden-image net of §6.3, and it is what makes P3 safe."*
 *
 * This file is that claim, exercised: a REAL render of a REAL score, in jsdom, with the positions
 * read back as numbers. ⚠️ Every one of these assertions previously required a browser
 * (`e2e/barlineTypes.e2e.ts` and friends), because the only record of what had been drawn was the
 * DOM — and `reference: jsdom cannot measure glyphs` made reading it there meaningless.
 *
 * ## ⚠️ What can and cannot be asserted here, and the line is sharp
 *
 * ✅ **Anything OUR primitives drew** — barlines, key signatures, grouping signs, the hairpin's
 * wedge, the octave line, the pedal's dashes, page sheets. Their coordinates are arithmetic over
 * stave geometry and the layout, and jsdom computes all of it.
 *
 * ⛔ **Anything a VexFlow object painted itself** — noteheads, stems, flags, beams, the stave's own
 * five lines. Those go through `vexContext`, never reach a `DrawContext`, and are invisible to the
 * recorder. ⭐ That gap is the migration's remaining work rather than a defect of the scene, and it
 * shrinks with every P3/P4 commit; the browser suite stays for exactly that half.
 *
 * ⛔ **And still not INK EXTENTS.** A glyph's drawn width needs a font. The scene says *where a
 * glyph was stamped and which codepoint it was*, ⛔ never how wide it came out.
 */
import { describe, it, expect } from 'vitest'
import { ScoreModel } from '../models/ScoreModel'
import { VexFlowRenderer } from './VexFlowRenderer'
import { scenePrimitives, sceneGroups, walkScene } from '@/engine/scene/Scene'
import { fracCreate as frac } from '@/utils/fraction'

function makeRenderer() {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const renderer = new VexFlowRenderer(container)
  renderer.initialize(1200, 800)
  return renderer
}

function buildScore(bars = 4): ScoreModel {
  const model = new ScoreModel()
  for (let i = 1; i < bars; i++) model.addMeasure()
  for (let m = 1; m <= bars; m++) {
    model.addNote({ step: 'C', octave: 4, duration: 'q', measure: m, beat: frac(0, 1) })
    model.addNote({ step: 'E', octave: 4, duration: 'q', measure: m, beat: frac(1, 1) })
  }
  return model
}

/** Render once, with the drawing written down. */
function render(bars = 4) {
  const renderer = makeRenderer()
  const model = buildScore(bars)
  const { scene, result } = renderer.recordScene(() => renderer.renderScore(model.getScore()))
  return { renderer, model, scene, drew: result }
}

describe('recordScene', () => {
  it('⭐ renders normally AND hands back a scene — the tee paints, it does not replace', () => {
    const { renderer, scene, drew } = render()
    // ⚠️ `renderScore` answers whether a GHOST NOTE was drawn, ⛔ not whether the render succeeded —
    //    false is correct here, and reading it as "it failed" is a mistake this comment now blocks.
    expect(drew, 'no ghost note was armed').toBe(false)
    expect(scene.children.length, 'something was recorded').toBeGreaterThan(0)
    // 🚨 The break-test for "the tee paints": if the recorder had REPLACED the context, the page
    // would be empty. The measure groups are VexFlow's own, drawn through `vexContext`.
    expect(renderer.getMeasureSVGGroup(1, 0), 'the real page was still painted').not.toBeNull()
  })

  it('⛔ stops recording afterwards — a scene is one render, not a growing log', () => {
    const { renderer, model, scene } = render()
    const before = scene.children.length
    renderer.renderScore(model.getScore())
    expect(scene.children.length, 'the second render went nowhere near this scene').toBe(before)
  })
})

describe('⭐⭐ the barlines, measured in jsdom — what used to need a browser', () => {
  it('every bar draws its own end barline, as a rect, in a `stavebarline` group', () => {
    const { scene } = render(4)
    const groups = sceneGroups(scene, 'stavebarline')
    expect(groups.length, 'one sign per bar boundary drawn').toBeGreaterThanOrEqual(4)

    const strokes = groups.flatMap(g => g.children.filter(c => c.kind === 'rect'))
    expect(strokes.length, 'a barline is filled rects — `BarlineRenderer`').toBeGreaterThanOrEqual(4)
  })

  it('⭐⭐ …and they stand at ASCENDING x, left to right across the system', () => {
    const { scene } = render(4)
    const xs = sceneGroups(scene, 'stavebarline')
      .flatMap(g => g.children.filter(c => c.kind === 'rect').map(r => r.x))
      .sort((a, b) => a - b)
    expect(xs.length).toBeGreaterThanOrEqual(4)
    // ⭐ The assertion that could not be made in jsdom before this file existed: real positions.
    expect(xs[0]).toBeGreaterThan(0)
    expect(xs[xs.length - 1]).toBeGreaterThan(xs[0])
  })

  it('⭐ a barline is TALL and THIN — the shape of the ink, not just its presence', () => {
    const { scene } = render(2)
    const rects = sceneGroups(scene, 'stavebarline').flatMap(g =>
      g.children.filter(c => c.kind === 'rect'))
    expect(rects.length).toBeGreaterThan(0)
    for (const r of rects) {
      expect(r.height, 'a barline spans the staff').toBeGreaterThan(r.width)
      expect(r.width, 'and it is thin — 0.16 staff spaces (`barlineInk`)').toBeLessThan(5)
    }
  })

  // 🚨 The break-test for the three above: if the recorder were silently recording NOTHING and the
  // helpers were returning empty arrays, every `toBeGreaterThanOrEqual(0)`-shaped assertion would
  // pass. This one fails on an empty scene.
  it('🚨 the break-test — an empty scene would fail these, not pass them vacuously', () => {
    const { scene } = render(4)
    const primitives = scenePrimitives(scene)
    expect(primitives.length, 'real ink was recorded').toBeGreaterThanOrEqual(4)
    // ⭐ …and it carries real numbers, not zeros: the thing jsdom could never say before.
    expect(primitives.every(p => 'x' in p && Number.isFinite(p.x))).toBe(true)
    expect(primitives.some(p => 'x' in p && p.x > 0), '⛔ not all at the origin').toBe(true)
    expect(sceneGroups(scene, 'stavebarline').length).toBeGreaterThan(0)
    expect(sceneGroups(scene, 'no-such-group-exists'), 'and a wrong name finds nothing').toEqual([])
  })
})

describe('the scene’s SHAPE', () => {
  it('⭐ groups nest, and every group carries a placement', () => {
    const { scene } = render(2)
    const groups = [...walkScene(scene)].filter(n => n.kind === 'group')
    expect(groups.length).toBeGreaterThan(0)
    for (const g of groups) {
      expect(g.placement, 'rule 8: a group is placed by an affine').toBeDefined()
      expect(typeof g.placement.a).toBe('number')
    }
  })

  it('⭐ a group keeps the BARE class the pass asked for — ⛔ not VexFlow’s `vf-` prefix', () => {
    const { scene } = render(2)
    const classes = [...walkScene(scene)]
      .filter(n => n.kind === 'group')
      .map(g => (g as { cls?: string }).cls)
    expect(classes).toContain('stavebarline')
    expect(classes.filter(c => c?.startsWith('vf-')), 'the prefix is the painter’s').toEqual([])
  })

  it('⛔ notes and stems are NOT here — they are VexFlow’s, and that gap is the work left', () => {
    const { scene } = render(2)
    // A notehead would be a `text` primitive if we drew it; today `StaveNote.draw()` paints it
    // through `vexContext`. ⭐ When P3 lands this expectation flips, and that is the intended
    // signal: the scene's coverage IS the migration's progress.
    const classes = [...walkScene(scene)]
      .filter(n => n.kind === 'group')
      .map(g => (g as { cls?: string }).cls)
    expect(classes, 'the measure group is opened by the renderer itself').toContain('measure')
    expect(classes).not.toContain('stavenote')
  })
})
