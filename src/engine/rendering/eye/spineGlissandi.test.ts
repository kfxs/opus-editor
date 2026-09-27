import { describe, it, expect } from 'vitest'
import { circleSpine, straightSpine } from '@/engine/engrave/staff/staffSpine'
import { addGlissando, setGlissandoEnd } from '@/engine/models/glissandoOps'
import { ScoreModel } from '@/engine/models/ScoreModel'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'
import { SceneRecorder } from '@/engine/scene/SceneRecorder'
import { sceneGroups, scenePrimitives } from '@/engine/scene/Scene'
import type { PitchStep } from '@/types/music'
import { SPINE_GLISSANDO_CLASS } from './spineGlissandi'
import { drawScoreOnSpine } from './spineScore'

/**
 * Subject: `./spineGlissandi` — a glissando on the spine (port map #26). ⚠️ jsdom glyphs are 0 wide: asserted are
 * the line's ends and its path — ⛔ never the word's width.
 */
const R = 250
const CX = 400
const CY = 400

/** ⚠️ FOUR bars, as a score is: with one bar stretched round the circle a single beat spans 90° of arc. */
function fourBars(steps: PitchStep[] = ['C', 'G', 'E', 'B']): ScoreModel {
  const m = new ScoreModel('spine')
  for (let i = 1; i < 4; i++) m.addMeasure()
  for (let bar = 1; bar <= 4; bar++) {
    steps.forEach((step, beat) => m.addNote({ step, octave: 4, duration: 'q', measure: bar, beat: { num: beat, den: 1 } }))
  }
  return m
}
const pitchAt = (m: ScoreModel, bar: number, index: number) => {
  const slot = m.getScore().measures[bar - 1].slots[index]
  if (slot.type !== 'chord') throw new Error('no note')
  return slot.notes[0].id
}
/** Each glissando's stroked line, as the points it was drawn through. */
const linesOf = (m: ScoreModel, spine = circleSpine(CX, CY, R)) => {
  const recorder = new SceneRecorder()
  drawScoreOnSpine(recorder, m.getScore(), spine)
  return sceneGroups(recorder.scene, SPINE_GLISSANDO_CLASS).map(group =>
    scenePrimitives(group).flatMap(p => (p.kind === 'path' ? p.ops.flatMap(op => ('x' in op ? [{ x: op.x, y: op.y }] : [])) : [])))
}
const radius = (p: { x: number; y: number }) => Math.hypot(p.x - CX, p.y - CY)

describe('drawScoreOnSpine — GLISSANDI (docs/plans/bent-staff-plan.md #26)', () => {
  it('draws one line from a head to the next note\'s head', () => {
    const m = fourBars()
    addGlissando(m.getScore(), pitchAt(m, 1, 0))
    expect(linesOf(m)).toHaveLength(1)
  })

  it('⭐ a rising glissando (C4 → G4) ends HIGHER than it starts — on a straight spine, a plain line', () => {
    const m = fourBars()
    addGlissando(m.getScore(), pitchAt(m, 1, 0))
    const [line] = linesOf(m, straightSpine(0, 100, 1200))
    expect(line[line.length - 1].y).toBeLessThan(line[0].y - STAFF_SPACE_PX)
    expect(line[line.length - 1].x).toBeGreaterThan(line[0].x)
  })

  it('⭐⭐ it FOLLOWS the path: round the circle, a line between two notes a bar apart turns through a real angle', () => {
    const m = fourBars(['C', 'D', 'E', 'F'])
    const id = pitchAt(m, 1, 3)
    addGlissando(m.getScore(), id)
    const [line] = linesOf(m)
    const angle = (p: { x: number; y: number }) => Math.atan2(p.y - CY, p.x - CX)
    // More than one straight step, and every point stays in the staff's band — ⛔ never a chord cutting the loop.
    expect(line.length).toBeGreaterThan(2)
    for (const p of line) expect(radius(p)).toBeGreaterThan(R - 6 * STAFF_SPACE_PX)
    expect(Math.abs(angle(line[line.length - 1]) - angle(line[0]))).toBeGreaterThan(0.05)
  })

  it('a line with NO target (the free end) is drawn too, and stops before the barline', () => {
    const m = fourBars()
    const g = addGlissando(m.getScore(), pitchAt(m, 1, 3))!
    setGlissandoEnd(m.getScore(), g.id, 'none')
    expect(linesOf(m)).toHaveLength(1)
  })
})
