import { describe, it, expect } from 'vitest'
import { circleSpine } from '@/engine/engrave/staff/staffSpine'
import { addOttava } from '@/engine/models/ottavaOps'
import { ScoreModel } from '@/engine/models/ScoreModel'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'
import { SceneRecorder } from '@/engine/scene/SceneRecorder'
import { sceneGroups, scenePrimitives, type SceneGroup } from '@/engine/scene/Scene'
import { levelToGlyphString } from '@/utils/dynamics'
import type { Ottava } from '@/types/music'
import { SPINE_OTTAVA_CLASS } from './spineOttavas'
import { SPINE_MARK_CLASS } from './spineMarks'
import { drawScoreOnSpine } from './spineScore'

/**
 * Subject: `./spineOttavas` — an octave line on the spine (port map #15). ⚠️ jsdom glyphs are 0 wide: asserted
 * are the line's LANE, its dashes and hook, and its rung on the ladder — ⛔ never the numeral's width.
 */
const R = 250
const CX = 400
const CY = 400

/** ⚠️ FOUR bars, as a score is: with one bar stretched round the circle a single beat spans 90° of arc. */
function fourBarsOfQuarters(): ScoreModel {
  const m = new ScoreModel('spine')
  for (let i = 1; i < 4; i++) m.addMeasure()
  for (let bar = 1; bar <= 4; bar++) {
    for (let beat = 0; beat < 4; beat++) m.addNote({ step: 'B', octave: 4, duration: 'q', measure: bar, beat: { num: beat, den: 1 } })
  }
  return m
}

const octave = (m: ScoreModel, shift: Ottava['shift'], measure = 1, length = 8) =>
  addOttava(m.getScore(), measure, { shift, beat: { num: 0, den: 1 }, length: { num: length, den: 1 } })!

const draw = (m: ScoreModel) => {
  const recorder = new SceneRecorder()
  drawScoreOnSpine(recorder, m.getScore(), circleSpine(CX, CY, R))
  return recorder.scene
}
/** The octave line's stroked paths: the dashed line first, then the hook. */
const pathsOf = (group: SceneGroup) => scenePrimitives(group).flatMap(p => (p.kind === 'path' ? [p] : []))
const points = (path: ReturnType<typeof pathsOf>[number]) => path.ops.flatMap(op => ('x' in op ? [{ x: op.x, y: op.y }] : []))
const radius = (p: { x: number; y: number }) => Math.hypot(p.x - CX, p.y - CY)

describe('drawScoreOnSpine — OCTAVE LINES (docs/plans/bent-staff-plan.md #15)', () => {
  it('an 8va stands OUTSIDE the loop (above the staff), an 8vb INSIDE it (below)', () => {
    const up = fourBarsOfQuarters()
    octave(up, 1)
    const [line] = pathsOf(sceneGroups(draw(up), SPINE_OTTAVA_CLASS)[0])
    expect(radius(points(line)[0])).toBeGreaterThan(R)

    const down = fourBarsOfQuarters()
    octave(down, -1)
    const [below] = pathsOf(sceneGroups(draw(down), SPINE_OTTAVA_CLASS)[0])
    expect(radius(points(below)[0])).toBeLessThan(R - 4 * STAFF_SPACE_PX)
  })

  it('⭐ the line is DASHED and FOLLOWS the path; the hook turns toward the staff, square to it', () => {
    const m = fourBarsOfQuarters()
    octave(m, 1)
    const [line, hook] = pathsOf(sceneGroups(draw(m), SPINE_OTTAVA_CLASS)[0])
    expect(line.style.lineDash?.length).toBe(2)
    const run = points(line)
    // One radius all the way along — an arc of the lane, not a chord.
    for (const p of run) expect(radius(p)).toBeCloseTo(radius(run[0]), 6)
    const angle = (p: { x: number; y: number }) => Math.atan2(p.y - CY, p.x - CX)
    expect(Math.abs(angle(run[run.length - 1]) - angle(run[0]))).toBeGreaterThan(0.5)
    const [from, to] = points(hook)
    expect(radius(to)).toBeLessThan(radius(from)) // an 8va's hook reaches DOWN, toward the staff
    expect(angle(to)).toBeCloseTo(angle(from), 9)
  })

  it('⭐⭐ the LADDER: an 8vb stands INSIDE the dynamics (Gould p. 101) — the dynamic is pushed further in', () => {
    const plain = fourBarsOfQuarters()
    plain.getScore().measures[0].dynamics = [{ id: 'd', beat: { num: 0, den: 1 }, text: levelToGlyphString('f') }]
    const withOttava = fourBarsOfQuarters()
    withOttava.getScore().measures[0].dynamics = [{ id: 'd', beat: { num: 0, den: 1 }, text: levelToGlyphString('f') }]
    octave(withOttava, -1)
    // The dynamic's piece is placed ON the path; its DEPTH is the y it was drawn at inside the piece.
    const depth = (m: ScoreModel) => {
      const piece = sceneGroups(sceneGroups(draw(m), SPINE_MARK_CLASS)[0], 'spine-mark-piece')[0]
      const text = scenePrimitives(piece).find(p => p.kind === 'text')
      return text && text.kind === 'text' ? text.y : NaN
    }
    const alone = depth(plain)
    const pushed = depth(withOttava)
    expect(pushed).toBeGreaterThan(alone)
  })
})
