import { describe, it, expect } from 'vitest'
import { circleSpine, straightSpine } from '@/engine/engrave/staff/staffSpine'
import { ScoreModel } from '@/engine/models/ScoreModel'
import { SceneRecorder } from '@/engine/scene/SceneRecorder'
import { sceneGroups, scenePrimitives } from '@/engine/scene/Scene'
import type { PitchStep } from '@/types/music'
import { SPINE_BLOCK_CLASS } from './spineStaff'
import { drawScoreOnSpine } from './spineScore'

/**
 * ⭐ What stands on the spine is READ FROM THE MODEL — so these drive a real `ScoreModel` and count
 * what the scene holds. ⚠️ jsdom glyphs are 0 wide: counts and placements, ⛔ never ink positions.
 */

const HEADER_BLOCKS = 2 // the clef and the meter

function model(bars: number): ScoreModel {
  const m = new ScoreModel('spine')
  for (let i = 1; i < bars; i++) m.addMeasure()
  return m
}

const addQuarter = (m: ScoreModel, measure: number, beat: number, step: PitchStep = 'G') =>
  m.addNote({ step, octave: 4, duration: 'q', measure, beat: { num: beat, den: 1 }, staff: 0 })

const blocksOf = (m: ScoreModel, spine = circleSpine(400, 400, 250)) => {
  const recorder = new SceneRecorder()
  drawScoreOnSpine(recorder, m.getScore(), spine)
  return sceneGroups(recorder.scene, SPINE_BLOCK_CLASS)
}

const slotCount = (m: ScoreModel) => m.getScore().measures.reduce((n, bar) => n + bar.slots.length, 0)

describe('drawScoreOnSpine', () => {
  it('⭐⭐ one block per SLOT of the model — notes and the rests that fill the bar alike', () => {
    const m = model(2)
    addQuarter(m, 1, 0)
    addQuarter(m, 2, 2)
    // …and one barline per bar, the LAST included (his report, 2026-09-21).
    expect(blocksOf(m)).toHaveLength(HEADER_BLOCKS + slotCount(m) + 2)
  })

  it('⭐⭐ an EDIT to the score is an edit to the circle', () => {
    const m = model(1)
    addQuarter(m, 1, 0)
    const before = blocksOf(m).length
    const slotsBefore = slotCount(m)
    addQuarter(m, 1, 1)
    addQuarter(m, 1, 2)
    expect(blocksOf(m).length - before).toBe(slotCount(m) - slotsBefore)
  })

  it('every block drew ink, and none is deformed — the notes are turned, as they stand', () => {
    const m = model(2)
    for (let b = 0; b < 4; b++) addQuarter(m, 1, b)
    for (const block of blocksOf(m)) {
      expect(scenePrimitives(block).length).toBeGreaterThan(0)
      const { a, b, c, d } = block.placement
      expect(a * d - b * c).toBeCloseTo(1, 9) // a rotation's determinant: no scale, no mirror
    }
  })

  it('⭐ on a CLOSED spine the last barline stands short of the clef, ⛔ not on top of it', () => {
    const m = model(2)
    addQuarter(m, 1, 0)
    const spine = circleSpine(400, 400, 250)
    const blocks = blocksOf(m, spine)
    const last = blocks[blocks.length - 1].placement
    const at = spine.locate(last.e, last.f)!
    expect(at.s).toBeLessThan(spine.length - 1)
    expect(at.s).toBeGreaterThan(spine.length * 0.9)
  })

  it('an OPEN spine runs its last bar to the very end', () => {
    const m = model(2)
    addQuarter(m, 1, 0)
    const spine = straightSpine(0, 0, 900)
    const blocks = blocksOf(m, spine)
    expect(blocks).toHaveLength(HEADER_BLOCKS + slotCount(m) + 2)
    expect(blocks[blocks.length - 1].placement.e).toBeCloseTo(900, 6)
  })

  it('⭐ blocks stand in SCORE ORDER along the spine: a later beat is further round', () => {
    const m = model(1)
    for (let b = 0; b < 4; b++) addQuarter(m, 1, b)
    const spine = straightSpine(0, 0, 900)
    const xs = blocksOf(m, spine).slice(HEADER_BLOCKS, HEADER_BLOCKS + 4).map(g => g.placement.e)
    // ⚠️ On a straight spine a placement's `e` is the block's x less its own head x — the same head
    // for four equal quarters, so the ORDER is the beats' order.
    expect([...xs].sort((p, q) => p - q)).toEqual(xs)
    expect(new Set(xs).size).toBe(4)
  })
})

describe('drawScoreOnSpine — BEAMS (docs/plans/bent-staff-plan.md §6)', () => {
  const addEighth = (m: ScoreModel, measure: number, halfBeat: number, step: PitchStep = 'C') =>
    m.addNote({ step, octave: 5, duration: '8', measure, beat: { num: halfBeat, den: 2 }, staff: 0 })

  it('⭐ a beam group is ONE block — fewer blocks than slots, by the notes that share a beam', () => {
    const m = model(1)
    for (let i = 0; i < 4; i++) addEighth(m, 1, i)
    const beamGroups = 2 // the page's grouper: four eighths in 4/4 are two beats of two
    const beamedNotes = 4
    expect(blocksOf(m)).toHaveLength(HEADER_BLOCKS + (slotCount(m) - beamedNotes) + beamGroups + 1)
  })

  it('a lone eighth stays its own block — nothing to beam with', () => {
    const m = model(1)
    addEighth(m, 1, 1)
    expect(blocksOf(m)).toHaveLength(HEADER_BLOCKS + slotCount(m) + 1)
  })

  it('a beamed block is placed by a rotation at its MIDDLE — not upright, on a circle', () => {
    const m = model(1)
    for (let i = 4; i < 6; i++) addEighth(m, 1, i)
    const placed = blocksOf(m).map(group => group.placement).filter(p => p && Math.abs(p.b) > 1e-6)
    expect(placed.length).toBeGreaterThan(0)
  })
})

