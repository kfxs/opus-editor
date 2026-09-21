import { describe, it, expect } from 'vitest'
import { circleSpine, straightSpine } from '@/engine/engrave/staff/staffSpine'
import { ScoreModel } from '@/engine/models/ScoreModel'
import { SceneRecorder } from '@/engine/scene/SceneRecorder'
import { sceneGroups, scenePrimitives, type SceneGroup } from '@/engine/scene/Scene'
import type { PitchStep } from '@/types/music'
import { SPINE_BLOCK_CLASS, SPINE_NOTE_CLASS } from './spineStaff'
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

  describe('⭐⭐ every boundary carries the SCORE\'s own sign — the page\'s, in a block', () => {
    /** The rects (strokes) and texts (repeat dots, wings) of each block past the header and slots. */
    const signsOf = (m: ScoreModel, spine = straightSpine(0, 0, 900)) =>
      blocksOf(m, spine)
        .filter(block => scenePrimitives(block).every(p => p.kind === 'rect' || p.kind === 'text'))
        .filter(block => scenePrimitives(block).some(p => p.kind === 'rect'))
        .map(block => ({
          s: block.placement.e,
          strokes: scenePrimitives(block).filter(p => p.kind === 'rect').length,
          glyphs: scenePrimitives(block).filter(p => p.kind === 'text').length,
        }))

    it('a plain line is one stroke; a FINAL bar is thin + thick, its thick edge ON the boundary', () => {
      const m = model(2)
      addQuarter(m, 1, 0)
      m.getScore().measures[1].barline = { style: 'final' }
      const [plain, final] = signsOf(m)
      expect(plain).toMatchObject({ strokes: 1, glyphs: 0 })
      expect(final).toMatchObject({ strokes: 2, glyphs: 0 })
      expect(final.s).toBeCloseTo(900, 6) // the BOUNDARY is where the block stands, not the ink's middle
    })

    it('an end repeat adds its two dots; two repeats meeting draw ONE `:||:`, ⛔ not two signs', () => {
      const m = model(2)
      addQuarter(m, 1, 0)
      m.getScore().measures[0].repeatEnd = {}
      expect(signsOf(m)[0]).toMatchObject({ strokes: 2, glyphs: 2 })
      m.getScore().measures[1].repeatStart = {}
      const signs = signsOf(m)
      expect(signs).toHaveLength(2)
      expect(signs[0]).toMatchObject({ strokes: 3, glyphs: 4 })
    })

    it('a `|:` on bar 1 stands at the bar\'s own start — the one opening edge a single system has', () => {
      const m = model(1)
      addQuarter(m, 1, 0)
      const before = signsOf(m)
      m.getScore().measures[0].repeatStart = {}
      const after = signsOf(m)
      expect(after).toHaveLength(before.length + 1)
      expect(after[0]).toMatchObject({ strokes: 2, glyphs: 2 })
      expect(after[0].s).toBeLessThan(after[1].s)
    })

    it('WINGS are drawn when the bar asks for them, and an INVISIBLE line draws nothing', () => {
      const m = model(2)
      addQuarter(m, 1, 0)
      m.getScore().measures[0].repeatEnd = { winged: true }
      expect(signsOf(m)[0].glyphs).toBe(2 + 2) // two dots + the top and bottom tips
      m.getScore().measures[0].repeatEnd = undefined
      m.getScore().measures[0].barline = { style: 'invisible' }
      expect(signsOf(m)).toHaveLength(1)
    })
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

  describe('⭐ the LOCAL TILT — a note’s own ink turns with the PATH, not with the block (plan §8.3)', () => {
    /** The rotation a placement carries, radians — `atan2(b, a)` of the matrix. */
    const turn = (group: SceneGroup) => Math.atan2(group.placement.b, group.placement.a)

    const beamedPair = (spine = circleSpine(400, 400, 250)) => {
      const m = model(1)
      for (let i = 4; i < 6; i++) addEighth(m, 1, i)
      const block = blocksOf(m, spine).find(group => sceneGroups(group, SPINE_NOTE_CLASS).length > 0)!
      return { block, notes: sceneGroups(block, SPINE_NOTE_CLASS) }
    }

    it('each beamed note has a group of its own inside the block', () => {
      expect(beamedPair().notes).toHaveLength(2)
    })

    it('⭐ the two ends turn by EQUAL and OPPOSITE angles about the block’s middle', () => {
      const [first, last] = beamedPair().notes.map(turn)
      expect(Math.abs(first)).toBeGreaterThan(1e-3)
      expect(first + last).toBeCloseTo(0, 9)
      // …and the first note is BEFORE the middle, so it is turned back against the path's turning.
      expect(Math.sign(first)).toBe(-Math.sign(last))
    })

    it('⭐⭐ block turn + note turn = the PATH’s own angle where the note stands', () => {
      // Read back from the scene alone: a rotation about a point leaves that point where it was, so
      // the note's pivot is the fixed point of its placement — (I − R)·c = (e, f). Through the
      // block's placement that is a PAGE point, and on a circle the tangent there is square to the
      // radius through it — at any depth, since a deeper head is on the same radius.
      const centre = { x: 400, y: 400 }
      const { block, notes } = beamedPair(circleSpine(centre.x, centre.y, 250))
      for (const note of notes) {
        const { a, b, c, d, e, f } = note.placement
        const det = (1 - a) * (1 - d) - c * b
        const pivot = { x: ((1 - d) * e + c * f) / det, y: (b * e + (1 - a) * f) / det }
        const B = block.placement
        const page = { x: B.a * pivot.x + B.c * pivot.y + B.e, y: B.b * pivot.x + B.d * pivot.y + B.f }
        const radial = Math.atan2(page.y - centre.y, page.x - centre.x)
        const drawn = turn(block) + turn(note)
        // Square to the radius, whichever way round the path runs: cos of the difference is 0.
        expect(Math.cos(drawn - radial)).toBeCloseTo(0, 6)
      }
    })

    it('⛔ the STEMS and the BEAM stay in the block’s frame — parallel, and straight', () => {
      const { block, notes } = beamedPair()
      for (const note of notes) expect(sceneGroups(note, 'stem')).toHaveLength(0)
      expect(sceneGroups(block, 'stem')).toHaveLength(2)
      expect(sceneGroups(block, 'beam').length).toBeGreaterThan(0)
      for (const note of notes) expect(sceneGroups(note, 'beam')).toHaveLength(0)
    })

    it('on a STRAIGHT spine nothing turns — the page’s own picture', () => {
      for (const note of beamedPair(straightSpine(0, 100, 2000)).notes) expect(turn(note)).toBe(0)
    })
  })
})

