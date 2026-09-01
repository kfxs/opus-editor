/**
 * The beam's ink, in jsdom.
 *
 * ⛔ There is deliberately no spec here for WHICH x's a beam line runs between, or for what slope it
 * takes: P4a took the ink and left the hooks and the slope with VexFlow until `docs/beaming.md` gains
 * a rule for the drawn line. A test asserting either now would pin VexFlow's answer as if it were
 * ours — the same line `engrave/notes/stem` draws against the stem's LENGTH.
 */
import { describe, it, expect } from 'vitest'
import {
  BEAM_LEVEL_STRIDE, beamLevelY, beamLevelRun, beamLineStartX, beamRunInkBox,
  fillBeamQuad, drawBeamLines,
} from './beamLines'
import { SceneRecorder } from '@/engine/scene/SceneRecorder'
import type { Scene, ScenePrimitive } from '@/engine/scene/Scene'
import { engravingDefault } from '@/engine/fonts/fontMetrics'

type ScenePath = Extract<ScenePrimitive, { kind: 'path' }>

function paths(scene: Scene): ScenePath[] {
  return scene.children.filter((c): c is ScenePath => c.kind === 'path')
}

describe('fillBeamQuad', () => {
  it('⭐ a filled quad: the top edge as given, the thickness applied downward', () => {
    const recorder = new SceneRecorder()
    fillBeamQuad(recorder, 100, 50, 200, 60, 5)

    expect(paths(recorder.scene)).toEqual([{
      kind: 'path',
      painted: 'fill',
      ops: [
        { op: 'moveTo', x: 100, y: 50 },
        { op: 'lineTo', x: 100, y: 55 },
        { op: 'lineTo', x: 200, y: 65 },
        { op: 'lineTo', x: 200, y: 60 },
        { op: 'closePath' },
      ],
      style: { fill: undefined, stroke: undefined, lineWidth: undefined, lineDash: undefined },
    }])
  })

  it('⭐ a NEGATIVE thickness fills upward — that is how a stem-down beam is drawn', () => {
    const recorder = new SceneRecorder()
    fillBeamQuad(recorder, 0, 100, 50, 100, -5)
    const ops = paths(recorder.scene)[0].ops
    expect(ops[1], 'the second vertex is ABOVE the first').toEqual({ op: 'lineTo', x: 0, y: 95 })
  })

  it('⛔ opens no group — the group belongs to the beam OBJECT, not to the ink', () => {
    const recorder = new SceneRecorder()
    fillBeamQuad(recorder, 0, 0, 10, 0, 5)
    expect(recorder.scene.children.every(c => c.kind !== 'group')).toBe(true)
  })
})

describe('drawBeamLines', () => {
  it('⭐ one quad per line, in the order given, all at one thickness', () => {
    const recorder = new SceneRecorder()
    drawBeamLines(recorder, [
      { startX: 10, startY: 20, endX: 60, endY: 20 },
      { startX: 10, startY: 27.5, endX: 60, endY: 27.5 },
    ], 5)

    const drawn = paths(recorder.scene)
    expect(drawn.length, 'two levels, two quads').toBe(2)
    expect(drawn.every(p => p.painted === 'fill')).toBe(true)
    expect(drawn[0].ops[0]).toEqual({ op: 'moveTo', x: 10, y: 20 })
    expect(drawn[1].ops[0]).toEqual({ op: 'moveTo', x: 10, y: 27.5 })
  })

  it('an empty run draws nothing — ⛔ not an empty path', () => {
    const recorder = new SceneRecorder()
    drawBeamLines(recorder, [], 5)
    expect(recorder.scene.children).toEqual([])
  })
})

describe('beamLevelY — the level stack, whose one owner this now is', () => {
  it('⭐ the first level is where it was told; each next one is 1.5 thicknesses on', () => {
    expect(beamLevelY(100, 0, 5)).toBe(100)
    expect(beamLevelY(100, 1, 5)).toBe(107.5)
    expect(beamLevelY(100, 2, 5)).toBe(115)
  })

  it('⭐ …and it stacks the other way for a stem-down beam, by the sign of the thickness', () => {
    expect(beamLevelY(100, 1, -5)).toBe(92.5)
  })

  // ⭐⭐ The one number in this family where the room reserved and the ink drawn AGREE. Bravura says
  // it as a pair (0.5 of ink, 0.25 of air); VexFlow says it as this single ratio. Asserted rather
  // than described, because the agreement is what makes the stride NOT a taste call for his eye —
  // unlike the ledger overhang, the stem's thickness and the notehead table
  // (docs/note-engraving-plan.md §3).
  it('⭐⭐ the stride IS the font’s: (beamThickness + beamSpacing) / beamThickness', () => {
    const thickness = engravingDefault('beamThickness')
    const spacing = engravingDefault('beamSpacing')
    expect((thickness + spacing) / thickness).toBeCloseTo(BEAM_LEVEL_STRIDE, 6)
  })
})

describe('P4d — the cross-system fragments’ arithmetic, given a home', () => {
  it('⭐ a beam line starts half a stem-width left of its stem', () => {
    expect(beamLineStartX(120.25, 1.5)).toBe(119.5)
    // ⭐ …and that is the number `e2e/beam.e2e.ts` measures on the drawn page.
    expect(120.25 - beamLineStartX(120.25, 1.5)).toBeCloseTo(0.75, 6)
  })

  it('⭐ a FLAT run repeats one span across its levels, one stride apart', () => {
    const run = beamLevelRun({ startX: 10, endX: 40 }, 100, 5, 3, (_x, y) => y)
    expect(run.map(l => l.startY), 'three levels, 1.5 thicknesses apart').toEqual([100, 107.5, 115])
    for (const line of run) {
      expect(line.startY, 'flat: both ends at one y').toBe(line.endY)
      expect([line.startX, line.endX], 'and every level spans the same x’s').toEqual([10, 40])
    }
  })

  it('⭐⭐ a SLOPED run asks the caller for each end’s y — which is how `engrave/` stays free of vexflow', () => {
    // The caller's slope: y falls by 1 per 10 of x, continued from the baseline.
    const run = beamLevelRun({ startX: 0, endX: 30 }, 50, 5, 2, (x, y) => y - x / 10)
    expect(run[0]).toEqual({ startX: 0, startY: 50, endX: 30, endY: 47 })
    expect(run[1], 'the second level rides the same slope, a stride below').toEqual(
      { startX: 0, startY: 57.5, endX: 30, endY: 54.5 })
  })

  it('⛔ no levels ⇒ no lines, and ⛔ no box', () => {
    expect(beamLevelRun({ startX: 0, endX: 10 }, 0, 5, 0, (_x, y) => y)).toEqual([])
    expect(beamRunInkBox([], 5)).toBeNull()
  })

  it('⭐ the ink box is DERIVED from the run — both edges of every level', () => {
    const run = beamLevelRun({ startX: 10, endX: 40 }, 100, 5, 2, (_x, y) => y)
    // Levels at 100 and 107.5, each 5 thick ⇒ ink from 100 to 112.5.
    expect(beamRunInkBox(run, 5)).toEqual({ x: 10, y: 100, width: 30, height: 12.5 })
  })

  it('⭐⭐ …and a NEGATIVE thickness (a stem-down fragment) still gives a positive box', () => {
    const run = beamLevelRun({ startX: 10, endX: 40 }, 100, -5, 2, (_x, y) => y)
    // Stacking upward: levels at 100 and 92.5, ink reaching from 87.5 up to 100.
    expect(beamRunInkBox(run, -5)).toEqual({ x: 10, y: 87.5, width: 30, height: 12.5 })
  })
})
