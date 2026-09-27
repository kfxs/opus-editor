import { describe, it, expect } from 'vitest'
import { apply, isTranslation } from '@/engine/paint/Affine'
import { circleSpine, straightSpine } from '@/engine/engrave/staff/staffSpine'
import { ScoreModel } from '@/engine/models/ScoreModel'
import { SceneRecorder } from '@/engine/scene/SceneRecorder'
import { sceneGroups, scenePrimitives, type SceneGroup } from '@/engine/scene/Scene'
import type { PitchStep, TupletOffsetOverride } from '@/types/music'
import { setEngravingOverride } from '@/engine/models/overrideOps'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'
import { staffStridePx } from '@/engine/layout/staffStride'
import { setBarlineJoinBelow } from '@/engine/models/barlineJoin'
import { applyGroupSymbol } from '@/engine/models/staffGroupOps'
import { SPINE_BLOCK_CLASS, SPINE_NOTE_CLASS } from './spineStaff'
import { drawScoreOnSpine } from './spineScore'
import { addGrace } from '@/engine/models/graceOps'
import { addBracketed } from '@/engine/models/bracketedGraceOps'
import { GRACE_GROUP } from '../GracePass'
import { BRACKETED_GROUP } from '../BracketedGracePass'
import { ENCLOSURE_GROUP } from '../EnclosurePass'

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

/** A block's INK — ⛔ not its click targets (`pointerRect`, the barline's since plan §9's clicking). */
const inkOf = (group: SceneGroup) => scenePrimitives(group).filter(p => p.kind !== 'pointerRect')

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
        .filter(block => inkOf(block).every(p => p.kind === 'rect' || p.kind === 'text'))
        .filter(block => inkOf(block).some(p => p.kind === 'rect'))
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


describe('drawScoreOnSpine — TUPLETS (docs/plans/bent-staff-plan.md port map #8)', () => {
  const tupletGroups = (blocks: SceneGroup[]) => blocks.flatMap(block => sceneGroups(block, 'tuplet'))
  /** A bracket is two legs and a line — `fillRect`s; a beamed group's mark has none. */
  const rects = (group: SceneGroup) => scenePrimitives(group).filter(p => p.kind === 'rect').length

  it('⭐ a triplet of QUARTERS is ONE block — its three slots formatted together — with its mark inside', () => {
    const m = model(1)
    const tuplet = m.createTuplet(1, { num: 0, den: 1 }, 'q', 3, 2)!
    for (let i = 0; i < 3; i++) m.addNote({ step: 'G', octave: 4, duration: 'q', measure: 1, beat: { num: 2 * i, den: 3 }, tupletId: tuplet.id, staff: 0 })
    const blocks = blocksOf(m)
    // the header's two, the tuplet's ONE, the rests that fill the bar (its 2 beats → one half rest), the last barline
    expect(blocks).toHaveLength(HEADER_BLOCKS + 1 + (slotCount(m) - 3) + 1)
    const marks = tupletGroups(blocks)
    expect(marks, 'one tuplet mark, inside a block').toHaveLength(1)
    expect(rects(marks[0]), 'unbeamed ⇒ BRACKETED: legs and a line').toBeGreaterThan(0)
  })

  it('⭐ a beamed triplet of EIGHTHS: one block, the beam AND the mark inside — and NO bracket (the beam shows the group)', () => {
    const m = model(1)
    const tuplet = m.createTuplet(1, { num: 0, den: 1 }, '8', 3, 2)!
    for (let i = 0; i < 3; i++) m.addNote({ step: 'C', octave: 5, duration: '8', measure: 1, beat: { num: i, den: 3 }, tupletId: tuplet.id, staff: 0 })
    const blocks = blocksOf(m)
    const marks = tupletGroups(blocks)
    expect(marks).toHaveLength(1)
    expect(rects(marks[0]), 'beamed ⇒ no bracket, only the figure').toBe(0)
    const withMark = blocks.find(b => sceneGroups(b, 'tuplet').length)!
    expect(sceneGroups(withMark, SPINE_NOTE_CLASS), 'the three notes are in that block').toHaveLength(3)
  })

  it('the mark is drawn in the BLOCK’s frame, straight — not inside any note’s turned group', () => {
    const m = model(1)
    const tuplet = m.createTuplet(1, { num: 0, den: 1 }, '8', 3, 2)!
    for (let i = 0; i < 3; i++) m.addNote({ step: 'C', octave: 5, duration: '8', measure: 1, beat: { num: i, den: 3 }, tupletId: tuplet.id, staff: 0 })
    const blocks = blocksOf(m)
    for (const noteGroup of blocks.flatMap(b => sceneGroups(b, SPINE_NOTE_CLASS))) {
      expect(sceneGroups(noteGroup, 'tuplet')).toHaveLength(0)
    }
  })

  it('⭐ the HAND\'s vertical nudge reaches the spine (port map #27): +2 staff spaces moves the bracket 2 spaces DOWN', () => {
    const bracketYs = (y: number) => {
      const m = model(1)
      const tuplet = m.createTuplet(1, { num: 0, den: 1 }, 'q', 3, 2)!
      for (let i = 0; i < 3; i++) m.addNote({ step: 'G', octave: 4, duration: 'q', measure: 1, beat: { num: 2 * i, den: 3 }, tupletId: tuplet.id, staff: 0 })
      if (y !== 0) setEngravingOverride(m.getScore(), tuplet.id, { kind: 'tupletOffset', y } as TupletOffsetOverride)
      return scenePrimitives(tupletGroups(blocksOf(m))[0]).flatMap(p => (p.kind === 'rect' ? [p.y] : []))
    }
    const plain = bracketYs(0)
    const nudged = bracketYs(2)
    expect(plain.length).toBeGreaterThan(0)
    nudged.forEach((y, i) => expect(y - plain[i]).toBeCloseTo(2 * STAFF_SPACE_PX, 6))
  })

  it('a bar with no tuplet draws no mark — the page’s picture, unchanged', () => {
    const m = model(1)
    addQuarter(m, 1, 0)
    expect(tupletGroups(blocksOf(m))).toHaveLength(0)
  })
})

describe('drawScoreOnSpine — VOICES (docs/plans/bent-staff-plan.md #11)', () => {
  const QUARTER_REST = ''
  /** Every quarter rest's page y on a straight spine, left to right. */
  const quarterRestYs = (m: ScoreModel): number[] => {
    const recorder = new SceneRecorder()
    drawScoreOnSpine(recorder, m.getScore(), straightSpine(0, 200, 1600))
    const ys: { x: number; y: number }[] = []
    for (const block of sceneGroups(recorder.scene, SPINE_BLOCK_CLASS)) {
      for (const p of scenePrimitives(block)) {
        if (p.kind === 'text' && p.text === QUARTER_REST) ys.push(apply(block.placement, p.x, p.y))
      }
    }
    return ys.sort((a, b) => a.x - b.x).map(p => p.y)
  }
  const barWithUpperNote = (): ScoreModel => {
    const m = new ScoreModel('voices')
    for (let i = 1; i < 4; i++) m.addMeasure()
    m.addNote({ step: 'D', octave: 5, duration: 'q', measure: 1, beat: { num: 0, den: 1 } })
    return m
  }

  it('⭐ a multi-voice bar puts its rests where the PAGE does (`engraved/restShift`) — the upper voice\'s rest steps UP', () => {
    const alone = quarterRestYs(barWithUpperNote())
    const twoVoices = barWithUpperNote()
    twoVoices.addNote({ step: 'G', octave: 4, duration: 'w', measure: 1, beat: { num: 0, den: 1 }, voice: 1 })
    const shared = quarterRestYs(twoVoices)
    expect(alone.length).toBeGreaterThan(0)
    expect(shared.length).toBe(alone.length)
    expect(shared[0]).toBeLessThan(alone[0])
  })
})

describe('drawScoreOnSpine — GRACES, BRACKETED graces, PARENTHESIS brackets (port map #21–#23)', () => {
  /** Four bars of quarters; the second note of bar 1 carries the ornament `add` puts on it. */
  const withOrnament = (add: (m: ScoreModel, hostId: string) => void) => {
    const m = model(4)
    const notes = [0, 1, 2, 3].map(b => m.addNote({ step: 'D', octave: 5, duration: 'q', measure: 1, beat: { num: b, den: 1 } }))
    add(m, notes[1].id)
    const recorder = new SceneRecorder()
    drawScoreOnSpine(recorder, m.getScore(), circleSpine(400, 400, 250))
    return recorder.scene
  }
  /** The block (placed group) each group of class `cls` is drawn inside. */
  const blocksHolding = (scene: ReturnType<typeof withOrnament>, cls: string) =>
    sceneGroups(scene, SPINE_BLOCK_CLASS).filter(block => sceneGroups(block, cls).length > 0)

  it('⭐ a grace is drawn INSIDE its host note\'s block — the page\'s own `GracePass`, turning with the note', () => {
    const scene = withOrnament((m, host) => { addGrace(m.getScore(), host, 'before', { step: 'E', alter: 0, octave: 5 }, 'acciaccatura', { duration: '8' }) })
    expect(sceneGroups(scene, GRACE_GROUP)).toHaveLength(1)
    expect(blocksHolding(scene, GRACE_GROUP)).toHaveLength(1)
  })

  it('⭐ a bracketed grace, and a parenthesised head\'s brackets, are drawn in their note\'s block too', () => {
    const bracketed = withOrnament((m, host) => { addBracketed(m.getScore(), host, 'before', { step: 'E', alter: 0, octave: 5 }) })
    expect(blocksHolding(bracketed, BRACKETED_GROUP)).toHaveLength(1)
    const enclosed = withOrnament((m, host) => {
      const pitch = m.getScore().measures[0].slots.find(s => s.type === 'chord' && s.id !== undefined && s.notes.some(p => p.id === host))
      if (pitch?.type === 'chord') pitch.notes[0].enclosure = 'round'
    })
    expect(blocksHolding(enclosed, ENCLOSURE_GROUP)).toHaveLength(1)
  })

  it('a score with no ornaments draws none', () => {
    const scene = withOrnament(() => {})
    expect(sceneGroups(scene, GRACE_GROUP)).toHaveLength(0)
    expect(sceneGroups(scene, ENCLOSURE_GROUP)).toHaveLength(0)
  })
})

describe('drawScoreOnSpine — FANNED BEAMS (port map #29)', () => {
  const FAN = 'fan'
  const FAN_HEAD = 'fanhead'
  const FAN_DROP = 'fandrop'
  const draw = (m: ScoreModel, spine = circleSpine(400, 400, 250)) => {
    const recorder = new SceneRecorder()
    drawScoreOnSpine(recorder, m.getScore(), spine)
    return recorder.scene
  }
  /** A lone accel fan of 5 on a half note, then two quarters, in four bars. */
  const loneFan = () => {
    const m = model(4)
    const owner = m.addNote({ step: 'G', octave: 4, duration: 'h', measure: 1, beat: { num: 0, den: 1 } })
    m.addNote({ step: 'C', octave: 5, duration: 'q', measure: 1, beat: { num: 2, den: 1 } })
    m.addNote({ step: 'D', octave: 5, duration: 'q', measure: 1, beat: { num: 3, den: 1 } })
    m.setFan(owner.id, { direction: 'accel', count: 5, beams: 3 })
    return m
  }
  /** Four sixteenths JOINED to a fan on beat 2 (`beam: 'continue'` — fan.e2e's fixture). */
  const joinedFan = () => {
    const m = model(4)
    for (const k of [0, 1, 2, 3]) m.addNote({ step: 'C', octave: 5, duration: '16', measure: 1, beat: { num: k, den: 4 } })
    const owner = m.addNote({ step: 'C', octave: 5, duration: 'q', measure: 1, beat: { num: 1, den: 1 } })
    m.setFan(owner.id, { direction: 'accel', count: 6, beams: 3 })
    m.updateNote(owner.id, { beam: 'continue' })
    return m
  }

  it('⭐ a LONE fan is drawn — the page\'s own `FanPass`, inside its owner\'s block, with its members', () => {
    const scene = draw(loneFan())
    const blocks = sceneGroups(scene, SPINE_BLOCK_CLASS).filter(b => sceneGroups(b, FAN).length)
    expect(blocks).toHaveLength(1)
    expect(sceneGroups(blocks[0], FAN_HEAD), 'members 1…4 — member 0 is the note itself').toHaveLength(4)
  })

  it('⭐ a fan JOINED to a group is ONE block with it — the prefix\'s notes inside, and the fan', () => {
    const scene = draw(joinedFan())
    const blocks = sceneGroups(scene, SPINE_BLOCK_CLASS).filter(b => sceneGroups(b, FAN).length)
    expect(blocks).toHaveLength(1)
    expect(sceneGroups(blocks[0], SPINE_NOTE_CLASS), 'the four sixteenths and the owner').toHaveLength(5)
  })

  it('⭐ on a CIRCLE the members ride the path (lowered); on a STRAIGHT spine nothing is', () => {
    expect(sceneGroups(draw(loneFan()), FAN_DROP).length).toBeGreaterThan(0)
    expect(sceneGroups(draw(loneFan(), straightSpine(0, 200, 1600)), FAN_DROP)).toHaveLength(0)
  })

  it('⭐ on a CIRCLE each member TURNS with the path, like a note (his report); on a STRAIGHT spine none does', () => {
    expect(sceneGroups(draw(loneFan()), 'fantilt').length).toBeGreaterThan(0)
    expect(sceneGroups(draw(loneFan(), straightSpine(0, 200, 1600)), 'fantilt')).toHaveLength(0)
  })

  it('⭐ a joined fan\'s OWNER stays upright in its block — its stem must meet the straight ramp', () => {
    const scene = draw(joinedFan())
    const block = sceneGroups(scene, SPINE_BLOCK_CLASS).find(b => sceneGroups(b, FAN).length)!
    const noteGroups = sceneGroups(block, SPINE_NOTE_CLASS)
    const owner = noteGroups[noteGroups.length - 1]
    expect(isTranslation(owner.placement) || (owner.placement.a === 1 && owner.placement.b === 0)).toBe(true)
  })
})

describe('⭐⭐ more than one STAFF (port map #12) — the same path, further in', () => {
  const CENTRE = 400
  const RADIUS = 250
  /** Blocks whose ink is strokes only — the plain barlines — as (radius, angle) of their placed origin. */
  const barlinesOf = (m: ScoreModel) =>
    blocksOf(m, circleSpine(CENTRE, CENTRE, RADIUS))
      .filter(block => inkOf(block).length > 0 && inkOf(block).every(p => p.kind === 'rect'))
      .map(block => ({
        radius: Math.hypot(block.placement.e - CENTRE, block.placement.f - CENTRE),
        angle: Math.atan2(block.placement.f - CENTRE, block.placement.e - CENTRE),
      }))

  /** s = 0 — twelve o'clock, where the system's START signs stand. */
  const START_ANGLE = -Math.PI / 2
  const atStart = (line: { angle: number }) => Math.abs(line.angle - START_ANGLE) < 1e-6

  it('⭐ each staff draws its own bars — the second on the INNER ring, one staff stride in', () => {
    const m = model(3)
    m.addStaffBelow(0)
    const lines = barlinesOf(m).filter(line => !atStart(line))
    const outer = lines.filter(line => Math.abs(line.radius - RADIUS) < 1e-6)
    const inner = lines.filter(line => Math.abs(line.radius - (RADIUS - staffStridePx(1))) < 1e-6)
    expect(outer).toHaveLength(3)
    expect(inner).toHaveLength(3)
    // ⭐ …and a boundary stands on ONE radius on both staves: the columns are the system's.
    outer.forEach((line, i) => expect(inner[i].angle).toBeCloseTo(line.angle, 9))
  })

  /** A brace over the two staves — through the model, as the palette's does. */
  const brace = (m: ScoreModel) => applyGroupSymbol(m.getScore(), m.getScore().staves!.map(staff => staff.id), 'brace')

  /** The strokes (rects) of the blocks standing at s = 0 — the systemic line, when it is drawn. */
  const startStrokes = (m: ScoreModel) =>
    blocksOf(m, circleSpine(CENTRE, CENTRE, RADIUS))
      .filter(block => atStart({ angle: Math.atan2(block.placement.f - CENTRE, block.placement.e - CENTRE) }))
      .flatMap(block => scenePrimitives(block).filter(p => p.kind === 'rect'))

  it('⭐ the SYSTEMIC line stands at s = 0 only with a BRACE or BRACKET — his rule for the spine', () => {
    const one = model(2)
    expect(startStrokes(one)).toHaveLength(0)
    const two = model(2)
    two.addStaffBelow(0)
    expect(startStrokes(two), 'two staves, nothing at the start: no line').toHaveLength(0)
    setBarlineJoinBelow(two.getScore(), two.getScore().staves![0].id, true)
    expect(startStrokes(two), 'joined barlines bring no line').toHaveLength(0)
    brace(two)
    expect(startStrokes(two), 'a brace brings it').toHaveLength(1)
  })

  it('⭐ a JOINED gap draws the barline through it, at every boundary; unjoined, none', () => {
    const m = model(3)
    m.addStaffBelow(0)
    const count = () => barlinesOf(m).filter(line => !atStart(line)).length
    const apart = count()
    setBarlineJoinBelow(m.getScore(), m.getScore().staves![0].id, true)
    expect(count() - apart).toBe(3)
  })

  /** Does every staff line END where it began — the loop closed? (The lines are the scene's stroked paths.) */
  const linesClosed = (m: ScoreModel) => {
    const recorder = new SceneRecorder()
    drawScoreOnSpine(recorder, m.getScore(), circleSpine(CENTRE, CENTRE, RADIUS))
    const lines = scenePrimitives(recorder.scene).filter(p => p.kind === 'path' && p.painted === 'stroke')
    return lines.map(line => {
      const ops = line.kind === 'path' ? line.ops : []
      const first = ops[0] as { x: number; y: number }
      const last = ops[ops.length - 1] as { x: number; y: number }
      return Math.hypot(first.x - last.x, first.y - last.y) < 1e-6
    })
  }

  it('⭐ the loop stays CLOSED — joined barlines too — and only a brace or bracket opens a seam (his words, 2026-09-27)', () => {
    const m = model(2)
    m.addStaffBelow(0)
    expect(linesClosed(m)).toEqual(Array(10).fill(true))
    setBarlineJoinBelow(m.getScore(), m.getScore().staves![0].id, true)
    expect(linesClosed(m), 'joined barlines: still closed').toEqual(Array(10).fill(true))
    brace(m)
    expect(linesClosed(m), 'a brace: open').toEqual(Array(10).fill(false))
  })

  it('a lower staff\'s notes are its own — a note entered on staff 2 draws on the inner ring', () => {
    const m = model(1)
    m.addStaffBelow(0)
    const before = blocksOf(m).length
    m.addNote({ step: 'C', octave: 3, duration: 'q', measure: 1, beat: { num: 0, den: 1 }, staff: 1 })
    expect(blocksOf(m).length).toBeGreaterThan(before)
  })
})
