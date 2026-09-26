import { describe, it, expect } from 'vitest'
import { circleSpine, straightSpine } from '@/engine/engrave/staff/staffSpine'
import { apply } from '@/engine/paint/Affine'
import { ScoreModel } from '@/engine/models/ScoreModel'
import { setEngravingOverride } from '@/engine/models/overrideOps'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'
import { SceneRecorder } from '@/engine/scene/SceneRecorder'
import { sceneGroups, scenePrimitives, type SceneGroup } from '@/engine/scene/Scene'
import { levelToGlyphString } from '@/utils/dynamics'
import type { Dynamic, DynamicOffsetOverride, TempoMark, TempoOffsetOverride } from '@/types/music'
import { SPINE_MARK_CLASS, SPINE_MARK_PIECE_CLASS } from './spineMarks'
import { drawScoreOnSpine } from './spineScore'

/**
 * Subject: `./spineMarks` — dynamics, expression words and tempo marks on the spine (port map #16). ⚠️ jsdom
 * glyphs are 0 wide, so asserted are the LANES (which side of the path, how far out) and the placements —
 * ⛔ never a glyph's x.
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

const dynamic = (id: string, text: string, beat = 0, extra: Partial<Dynamic> = {}): Dynamic =>
  ({ id, beat: { num: beat, den: 1 }, text, ...extra })
const tempo = (id: string, text: string, beat = 0): TempoMark => ({ id, beat: { num: beat, den: 1 }, text })

const marksOf = (m: ScoreModel, spine = circleSpine(CX, CY, R)) => {
  const recorder = new SceneRecorder()
  drawScoreOnSpine(recorder, m.getScore(), spine)
  return sceneGroups(recorder.scene, SPINE_MARK_CLASS)
}

/** Where the mark's first text primitive stands on the page — through its PIECE's placement when it has pieces. */
const textAt = (group: SceneGroup) => {
  const piece = sceneGroups(group, SPINE_MARK_PIECE_CLASS)[0] ?? group
  const text = scenePrimitives(piece).find(p => p.kind === 'text')
  if (!text || text.kind !== 'text') throw new Error('no text')
  const inner = piece === group ? { x: text.x, y: text.y } : apply(piece.placement, text.x, text.y)
  return apply(group.placement, inner.x, inner.y)
}
/** The placement that turns the mark's (first piece's) ink. */
const turnOf = (group: SceneGroup) => (sceneGroups(group, SPINE_MARK_PIECE_CLASS)[0] ?? group).placement
const radius = (p: { x: number; y: number }) => Math.hypot(p.x - CX, p.y - CY)

describe('drawScoreOnSpine — DYNAMICS, WORDS and TEMPO (docs/plans/bent-staff-plan.md #16)', () => {
  it('draws one block per dynamic and per tempo mark, each with its text', () => {
    const m = fourBarsOfQuarters()
    const score = m.getScore()
    score.measures[0].dynamics = [dynamic('d1', levelToGlyphString('p'))]
    score.measures[2].dynamics = [dynamic('d2', 'dolce', 1)]
    score.measures[0].tempos = [tempo('t1', 'Allegro')]
    const marks = marksOf(m)
    expect(marks.map(g => g.id).sort()).toEqual(['dynamic-d1', 'dynamic-d2', 'tempo-t1'])
    for (const g of marks) expect(scenePrimitives(g).some(p => p.kind === 'text')).toBe(true)
  })

  it('⭐ a dynamic stands INSIDE the loop, on the page\'s line — the floor, 2.1 sp past the bottom line', () => {
    const m = fourBarsOfQuarters()
    m.getScore().measures[1].dynamics = [dynamic('d', levelToGlyphString('f'))]
    const [mark] = marksOf(m)
    // The spine is the TOP line; below the staff is toward the centre on a clockwise circle.
    const depth = R - radius(textAt(mark))
    expect(depth / STAFF_SPACE_PX).toBeGreaterThan(4 + 2.1)
  })

  it('⭐ a tempo mark stands OUTSIDE the loop, above the staff, past the tempo floor', () => {
    const m = fourBarsOfQuarters()
    m.getScore().measures[1].tempos = [tempo('t', 'Andante')]
    const [mark] = marksOf(m)
    expect((radius(textAt(mark)) - R) / STAFF_SPACE_PX).toBeGreaterThanOrEqual(3)
  })

  it('⭐ the tempo row CLEARS a dynamic placed above the staff at its beat — the ladder', () => {
    const alone = fourBarsOfQuarters()
    alone.getScore().measures[1].tempos = [tempo('t', 'Andante')]
    const withDynamic = fourBarsOfQuarters()
    withDynamic.getScore().measures[1].tempos = [tempo('t', 'Andante')]
    withDynamic.getScore().measures[1].dynamics = [dynamic('d', levelToGlyphString('f'), 0, { placement: 'above' })]
    const t = (m: ScoreModel) => marksOf(m).find(g => g.id === 'tempo-t')!
    expect(radius(textAt(t(withDynamic)))).toBeGreaterThan(radius(textAt(t(alone))) + 1)
  })

  it('⭐ each mark is TURNED to the path where it stands — a rotation, no scale', () => {
    const m = fourBarsOfQuarters()
    m.getScore().measures[2].dynamics = [dynamic('d', levelToGlyphString('mp'))]
    const [mark] = marksOf(m)
    const { a, b, c, d } = turnOf(mark)
    expect(a * a + b * b).toBeCloseTo(1, 9)
    expect(a * d - b * c).toBeCloseTo(1, 9)
    expect(Math.abs(b)).toBeGreaterThan(0.1) // bar 3 is far round the circle from its top
  })

  it('⭐ the hand\'s nudges reach the spine: a dynamic\'s +y goes DOWN (inward), a tempo\'s +y goes UP (outward)', () => {
    const plain = fourBarsOfQuarters()
    plain.getScore().measures[1].dynamics = [dynamic('d', levelToGlyphString('p'))]
    plain.getScore().measures[1].tempos = [tempo('t', 'Lento')]
    const nudged = fourBarsOfQuarters()
    nudged.getScore().measures[1].dynamics = [dynamic('d', levelToGlyphString('p'))]
    nudged.getScore().measures[1].tempos = [tempo('t', 'Lento')]
    setEngravingOverride(nudged.getScore(), 'd', { kind: 'dynamicOffset', x: 0, y: 2 } as DynamicOffsetOverride)
    setEngravingOverride(nudged.getScore(), 't', { kind: 'tempoOffset', x: 0, y: 2 } as TempoOffsetOverride)
    const find = (m: ScoreModel, id: string) => marksOf(m, straightSpine(0, 100, 1200)).find(g => g.id === id)!
    expect(textAt(find(nudged, 'dynamic-d')).y - textAt(find(plain, 'dynamic-d')).y).toBeCloseTo(2 * STAFF_SPACE_PX, 6)
    expect(textAt(find(nudged, 'tempo-t')).y - textAt(find(plain, 'tempo-t')).y).toBeCloseTo(-2 * STAFF_SPACE_PX, 6)
  })

  it('⭐ a WORD follows the spine: each letter is its own piece, turned where it stands (his ask, 2026-09-26)', () => {
    const m = fourBarsOfQuarters()
    m.getScore().measures[2].dynamics = [dynamic('d', 'dolce')]
    const [mark] = marksOf(m)
    const pieces = sceneGroups(mark, SPINE_MARK_PIECE_CLASS)
    expect(pieces).toHaveLength(5)
    for (const piece of pieces) expect(scenePrimitives(piece).filter(p => p.kind === 'text')).toHaveLength(1)
  })

  it('a dynamic GLYPH run stays ONE rigid piece', () => {
    const m = fourBarsOfQuarters()
    m.getScore().measures[2].dynamics = [dynamic('d', levelToGlyphString('mf'))]
    expect(sceneGroups(marksOf(m)[0], SPINE_MARK_PIECE_CLASS)).toHaveLength(1)
  })

  it('a mark that only SOUNDS (a tempo with no text) draws nothing', () => {
    const m = fourBarsOfQuarters()
    m.getScore().measures[0].tempos = [{ id: 't', beat: { num: 0, den: 1 }, bpm: 90 }]
    expect(marksOf(m)).toHaveLength(0)
  })
})
