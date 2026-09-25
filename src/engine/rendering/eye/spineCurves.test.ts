import { describe, it, expect } from 'vitest'
import { circleSpine, straightSpine } from '@/engine/engrave/staff/staffSpine'
import { ScoreModel } from '@/engine/models/ScoreModel'
import { toggleTie } from '@/engine/models/tieOps'
import { setEngravingOverride } from '@/engine/models/overrideOps'
import type { CurveShapeOverride, SlurEndpointOffsetOverride, SlurOffsetOverride, TieOffsetOverride } from '@/types/music'
import { SceneRecorder } from '@/engine/scene/SceneRecorder'
import { sceneGroups, scenePrimitives, type SceneGroup } from '@/engine/scene/Scene'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'
import { SPINE_CURVE_CLASS } from './spineCurves'
import { drawScoreOnSpine } from './spineScore'

/**
 * Subject: `./spineCurves` — ties and slurs on the spine (port map #13), by HIS rule (2026-09-25): a curve
 * OUTSIDE the loop follows the circle, one INSIDE is drawn from its two anchors like a normal one. ⚠️ jsdom
 * glyphs are 0 wide, so the endpoints' x is approximate; asserted are the DRAWING each side gets (a bent
 * lens of lineTos · a rigid cubic), the bow's side and size, and the bands — ⛔ never a page x.
 */
const R = 250
const CX = 400
const CY = 400

/** ⚠️ FOUR bars, as a score is: with one bar stretched round the circle a single beat spans 90° of arc. */
function fourBars(): ScoreModel {
  const m = new ScoreModel('spine')
  for (let i = 1; i < 4; i++) m.addMeasure()
  return m
}

function tiedPair(): ScoreModel {
  const m = fourBars()
  const a = m.addNote({ step: 'G', octave: 4, duration: 'q', measure: 1, beat: { num: 0, den: 1 } })
  m.addNote({ step: 'G', octave: 4, duration: 'q', measure: 1, beat: { num: 1, den: 1 } })
  toggleTie(m, a.id)
  return m
}


const curvesOf = (m: ScoreModel, spine = circleSpine(CX, CY, R)) => {
  const recorder = new SceneRecorder()
  drawScoreOnSpine(recorder, m.getScore(), spine)
  return sceneGroups(recorder.scene, SPINE_CURVE_CLASS)
}


/** Every (x, y) the group's path ops name. */
const inkPoints = (group: SceneGroup): { x: number; y: number }[] =>
  scenePrimitives(group).flatMap(p => (p.kind === 'path' ? p.ops.flatMap(op => ('x' in op && 'y' in op ? [{ x: op.x as number, y: op.y as number }] : [])) : []))
/** The radius of every ink point about the circle's centre. */
const radii = (group: SceneGroup) => inkPoints(group).map(p => Math.hypot(p.x - CX, p.y - CY))
/** The op names of the first (stroked) path — a RIGID cubic is moveTo + two bezierCurveTo; a BENT lens is lineTos. */
const opsOf = (group: SceneGroup) => {
  const path = scenePrimitives(group).find(p => p.kind === 'path')
  return path && path.kind === 'path' ? path.ops.map(op => (op as unknown as { op: string }).op) : []
}
/** A rigid cubic's apex distance from its chord, toward the page's "down" at the chord's middle × direction. */
const rigidApex = (group: SceneGroup, direction: 1 | -1) => {
  const path = scenePrimitives(group).find(p => p.kind === 'path')
  if (!path || path.kind !== 'path') throw new Error('no path')
  const ops = path.ops as unknown as Record<string, number>[]
  const p0 = { x: ops[0].x, y: ops[0].y }, c0 = { x: ops[1].cp1x, y: ops[1].cp1y }, c1 = { x: ops[1].cp2x, y: ops[1].cp2y }, p1 = { x: ops[1].x, y: ops[1].y }
  const mid = { x: 0.125 * p0.x + 0.375 * c0.x + 0.375 * c1.x + 0.125 * p1.x, y: 0.125 * p0.y + 0.375 * c0.y + 0.375 * c1.y + 0.125 * p1.y }
  const chordMid = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 }
  // the chord's normal, on the side away from the notes = toward the centre for a curve inside a clockwise loop
  const chord = { x: p1.x - p0.x, y: p1.y - p0.y }
  const len = Math.hypot(chord.x, chord.y)
  let n = { x: -chord.y / len, y: chord.x / len }
  const toCentre = { x: CX - p0.x, y: CY - p0.y }
  if (n.x * toCentre.x + n.y * toCentre.y < 0) n = { x: -n.x, y: -n.y }
  return ((mid.x - chordMid.x) * n.x + (mid.y - chordMid.y) * n.y) * direction
}
const PAGE_TIE_APEX = 0.75 * 0.53 * STAFF_SPACE_PX

describe('drawScoreOnSpine — TIES and SLURS (docs/plans/bent-staff-plan.md #13) — ⭐ HIS RULE: outside follows the circle, inside forgets it', () => {
  it('⭐ a tied pair draws ONE curve group — a filled lens with its outline, ⛔ not a stroke', () => {
    const curves = curvesOf(tiedPair())
    expect(curves).toHaveLength(1)
    expect(curves[0].id).toMatch(/^tie-/)
    const paths = scenePrimitives(curves[0]).filter(p => p.kind === 'path')
    expect(paths.map(p => p.kind === 'path' && p.painted).sort()).toEqual(['fill', 'stroke'])
  })

  it('⭐⭐ INSIDE the loop (a tie under G4, stems up) the curve is RIGID — the page’s cubic from its two anchors', () => {
    const [tie] = curvesOf(tiedPair())
    expect(opsOf(tie)).toEqual(['moveTo', 'bezierCurveTo', 'bezierCurveTo'])
    // …bowing away from the notes (toward the centre) by the page's bow — ⛔ never flattened or inverted
    const apex = rigidApex(tie, 1)
    expect(apex).toBeGreaterThan(PAGE_TIE_APEX * 0.9)
    expect(apex).toBeLessThan(PAGE_TIE_APEX * 1.6)
  })

  it('⭐⭐ OUTSIDE the loop (a long slur above) the curve FOLLOWS the circle — a bent lens riding the lines', () => {
    const m = fourBars()
    const first = m.addNote({ step: 'G', octave: 4, duration: 'q', measure: 1, beat: { num: 0, den: 1 } })
    for (let b = 1; b < 4; b++) m.addNote({ step: 'G', octave: 4, duration: 'q', measure: 1, beat: { num: b, den: 1 } })
    for (let b = 0; b < 3; b++) m.addNote({ step: 'G', octave: 4, duration: 'q', measure: 2, beat: { num: b, den: 1 } })
    const last = m.addNote({ step: 'G', octave: 4, duration: 'q', measure: 2, beat: { num: 3, den: 1 } })
    m.addSlur({ startNoteId: first.id, endNoteId: last.id, placement: 'above' })
    const [slur] = curvesOf(m)
    expect(slur.id).toMatch(/^slur-/)
    expect(opsOf(slur)[1], 'sampled, not a cubic').toBe('lineTo')
    const rs = radii(slur)
    expect(rs.length).toBeGreaterThan(40)
    // half the circle: a chord would sag the whole radius; riding the lines the spread is the arch's own height
    expect(Math.max(...rs) - Math.min(...rs)).toBeLessThan(6 * STAFF_SPACE_PX)
    expect(Math.min(...rs), 'outside the spine').toBeGreaterThan(R)
  })

  it('⭐ a slur FLIPPED inside over three beats of a two-bar score (his report) is a rigid bowl from its anchors — the pencil’s form', () => {
    const m = new ScoreModel('spine')
    m.addMeasure()
    const notes = [0, 1, 2, 3].map(b => m.addNote({ step: 'G', octave: 5, duration: 'q', measure: 1, beat: { num: b, den: 1 } }))
    m.addSlur({ startNoteId: notes[0].id, endNoteId: notes[3].id, placement: 'below' })
    const [slur] = curvesOf(m)
    expect(opsOf(slur)).toEqual(['moveTo', 'bezierCurveTo', 'bezierCurveTo'])
    // ⚠️ Its chord passes near the circle's CENTRE, so "toward the centre" cannot say which side its bow is on;
    //    what can be said: the cubic is finite and its controls stand clear of the chord by its arch.
    const path = scenePrimitives(slur).find(p => p.kind === 'path')!
    const ops = (path.kind === 'path' ? path.ops : []) as unknown as Record<string, number>[]
    const p0 = { x: ops[0].x, y: ops[0].y }, p1 = { x: ops[1].x, y: ops[1].y }, c0 = { x: ops[1].cp1x, y: ops[1].cp1y }
    const chord = { x: p1.x - p0.x, y: p1.y - p0.y }
    const len = Math.hypot(chord.x, chord.y)
    const offChord = Math.abs((c0.x - p0.x) * (-chord.y / len) + (c0.y - p0.y) * (chord.x / len))
    expect(Number.isFinite(offChord)).toBe(true)
    expect(offChord, 'a control the arch’s height off the chord').toBeGreaterThan(STAFF_SPACE_PX)
  })

  it('a tie ACROSS THE BARLINE draws — the spine is one system', () => {
    const m = fourBars()
    const a = m.addNote({ step: 'A', octave: 4, duration: 'q', measure: 1, beat: { num: 3, den: 1 } })
    m.addNote({ step: 'A', octave: 4, duration: 'q', measure: 2, beat: { num: 0, den: 1 } })
    toggleTie(m, a.id)
    expect(curvesOf(m)).toHaveLength(1)
  })

  it('on a STRAIGHT spine the two drawings coincide — the page’s own tie, flat along the staff under G4', () => {
    const [tie] = curvesOf(tiedPair(), straightSpine(100, 100, 2400))
    const ys = inkPoints(tie).map(p => p.y)
    expect(Math.min(...ys)).toBeGreaterThan(100 + 3 * STAFF_SPACE_PX)
    expect(Math.max(...ys)).toBeLessThan(100 + 6 * STAFF_SPACE_PX)
  })

  it('no ties, no slurs — no curve groups', () => {
    const m = fourBars()
    m.addNote({ step: 'G', octave: 4, duration: 'q', measure: 1, beat: { num: 0, den: 1 } })
    expect(curvesOf(m)).toHaveLength(0)
  })
})

describe('⭐ the HAND’s edits reach the spine (his ask, 2026-09-25: "the slur offset … is still not applied")', () => {
  const meanRadius = (group: SceneGroup) => { const rs = radii(group); return rs.reduce((a, b) => a + b, 0) / rs.length }

  /** A four-bar score with one slur above (outside — bent) and one tie below (inside — rigid). */
  const fixture = () => {
    const m = fourBars()
    const a = m.addNote({ step: 'G', octave: 4, duration: 'q', measure: 1, beat: { num: 0, den: 1 } })
    m.addNote({ step: 'G', octave: 4, duration: 'q', measure: 1, beat: { num: 1, den: 1 } })
    const b = m.addNote({ step: 'B', octave: 4, duration: 'q', measure: 1, beat: { num: 2, den: 1 } })
    toggleTie(m, a.id)
    const slur = m.addSlur({ startNoteId: a.id, endNoteId: b.id, placement: 'above' })
    return { m, tieFrom: a.id, slur }
  }
  const groupsOf = (m: ScoreModel) => {
    const curves = curvesOf(m)
    return { tie: curves.find(g => g.id?.startsWith('tie-'))!, slur: curves.find(g => g.id?.startsWith('slur-'))! }
  }

  it('the WHOLE-slur nudge translates the curve: +2 sp down = 2 sp nearer the centre, the shape kept', () => {
    const { m, slur } = fixture()
    const before = groupsOf(m).slur
    const whole: SlurOffsetOverride = { kind: 'slurOffset', y: 2 }
    setEngravingOverride(m.getScore(), slur.id, whole)
    const after = groupsOf(m).slur
    expect(meanRadius(before) - meanRadius(after)).toBeCloseTo(2 * STAFF_SPACE_PX, 0)
    const spread = (g: SceneGroup) => Math.max(...radii(g)) - Math.min(...radii(g))
    expect(spread(after)).toBeCloseTo(spread(before), 0)
  })

  it('a per-END nudge moves that end alone', () => {
    const { m, slur } = fixture()
    const before = inkPoints(groupsOf(m).slur)
    const end: SlurEndpointOffsetOverride = { kind: 'endpointOffset', end: { x: 0, y: -3 } }
    setEngravingOverride(m.getScore(), slur.id, end)
    const after = inkPoints(groupsOf(m).slur)
    expect(after[0].x).toBeCloseTo(before[0].x, 3)
    expect(after[0].y).toBeCloseTo(before[0].y, 3)
    expect(Math.hypot(after[24].x - before[24].x, after[24].y - before[24].y)).toBeGreaterThan(2 * STAFF_SPACE_PX)
  })

  it('a hand SHAPE replaces the auto arch — taller controls, a taller bow', () => {
    const { m, slur } = fixture()
    const before = groupsOf(m).slur
    const shape: CurveShapeOverride = { kind: 'curveShape', cps: [{ x: 0, y: 6 }, { x: 0, y: 6 }] }
    setEngravingOverride(m.getScore(), slur.id, shape)
    const after = groupsOf(m).slur
    const spread = (g: SceneGroup) => Math.max(...radii(g)) - Math.min(...radii(g))
    expect(spread(after)).toBeGreaterThan(spread(before) + 2 * STAFF_SPACE_PX)
  })

  it('the TIE’s vertical nudge moves the (rigid, inside) tie: +1 sp down = 1 sp nearer the centre', () => {
    const { m, tieFrom } = fixture()
    const before = groupsOf(m).tie
    const nudge: TieOffsetOverride = { kind: 'tieOffset', y: 1 }
    setEngravingOverride(m.getScore(), tieFrom, nudge)
    const after = groupsOf(m).tie
    expect(meanRadius(before) - meanRadius(after)).toBeCloseTo(STAFF_SPACE_PX, 0)
  })
})
