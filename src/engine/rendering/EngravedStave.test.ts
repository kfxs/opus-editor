// @vitest-environment jsdom
/**
 * ⭐⭐ **P5a's DIVIDEND — the staff's five lines are now in the SCENE** (`docs/own-engraving-engine.md` P5).
 *
 * Before P5a a staff line was painted by VexFlow's `Stave` onto the raw context, so it was invisible
 * to `recordScene` and every question about it needed a browser
 * (`reference_jsdom_cannot_measure_glyphs` is about GLYPHS; a staff line is arithmetic and never
 * needed a font). ⇒ *"the five lines are evenly spaced and span the bar"* is now a unit test.
 *
 * ⚠️ What is still NOT here: the clef, the meter and the opening barline are stave MODIFIERS and
 * still paint themselves on VexFlow's context. That is the rest of P5.
 */
import { describe, it, expect } from 'vitest'
import { ScoreModel } from '../models/ScoreModel'
import { VexFlowRenderer } from './VexFlowRenderer'
import { scenePrimitives, sceneGroups } from '@/engine/scene/Scene'
import { STAVE_LINE_WIDTH_PX } from '@/engine/engrave/staff/staffLines'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'
import { fracCreate as frac } from '@/utils/fraction'

function render(bars = 2) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const renderer = new VexFlowRenderer(container)
  renderer.initialize(1200, 400)
  const model = new ScoreModel()
  for (let i = 1; i < bars; i++) model.addMeasure()
  for (let m = 1; m <= bars; m++) {
    model.addNote({ step: 'E', octave: 4, duration: 'q', measure: m, beat: frac(0, 1) })
  }
  return renderer.recordScene(() => renderer.renderScore(model.getScore()))
}

/** Every stave group's own stroked lines, as {x1, x2, y}. */
function staveLines(scene: ReturnType<typeof render>['scene']) {
  return sceneGroups(scene, 'stave').map(group =>
    scenePrimitives(group)
      .flatMap(p =>
        p.kind === 'path' && p.painted === 'stroke'
          && p.ops[0]?.op === 'moveTo' && p.ops[1]?.op === 'lineTo'
          ? [{ x1: p.ops[0].x, x2: p.ops[1].x, y: p.ops[0].y, lineWidth: p.style.lineWidth }]
          : [])
      .sort((a, b) => a.y - b.y))
}

describe('⭐⭐ the stave draws its own five lines, through our primitives', () => {
  it('one `stave` group per bar, five lines in each', () => {
    const groups = staveLines(render(2).scene)
    expect(groups).toHaveLength(2)
    for (const lines of groups) expect(lines).toHaveLength(5)
  })

  it('⭐ the lines are HORIZONTAL and evenly spaced by one staff space', () => {
    const [lines] = staveLines(render(1).scene)
    for (let i = 1; i < lines.length; i++) {
      expect(lines[i].y - lines[i - 1].y, `gap ${i}`).toBeCloseTo(STAFF_SPACE_PX, 6)
    }
  })

  it('⭐ …all five span the same x, which is the bar’s own width', () => {
    const [lines] = staveLines(render(1).scene)
    for (const line of lines) {
      expect(line.x1).toBeCloseTo(lines[0].x1, 6)
      expect(line.x2).toBeCloseTo(lines[0].x2, 6)
    }
    expect(lines[0].x2 - lines[0].x1, 'a bar is wider than a staff space').toBeGreaterThan(STAFF_SPACE_PX)
  })

  it('⭐ each is stroked at OUR thickness — ⛔ never whatever the context happened to carry', () => {
    for (const lines of staveLines(render(2).scene)) {
      for (const line of lines) expect(line.lineWidth).toBe(STAVE_LINE_WIDTH_PX)
    }
  })

  it('⭐⭐ …and the stroke is offset by half the thickness, so the ink hangs BELOW the line’s y', () => {
    // The scene records where the stroke was PUT; the line's own y is half a thickness above it.
    const [lines] = staveLines(render(1).scene)
    const tops = lines.map(l => l.y - STAVE_LINE_WIDTH_PX / 2)
    for (const top of tops) expect(Number.isInteger(top * 2), 'a half-pixel grid').toBe(true)
    expect(lines[0].y - tops[0]).toBeCloseTo(0.5, 10)
  })

  it('🚨 the break-test — bar 2 stands to the RIGHT of bar 1, so these really are two staves', () => {
    const [first, second] = staveLines(render(2).scene)
    expect(second[0].x1).toBeGreaterThan(first[0].x1)
    expect(first[0].y).toBeCloseTo(second[0].y, 6) // …and on the same system
  })
})
