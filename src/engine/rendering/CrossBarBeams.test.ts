// @vitest-environment jsdom
/**
 * **Cross-barline beams** (docs/cross-barline-beaming-plan.md) — P1.
 *
 * The join is observable without any test-only API: the one `Beam` that spans two bars is drawn
 * OUTSIDE both measure groups, so it is a direct child of the `<svg>` (`g.vf-beam`), exactly where a
 * tie or a slur lives. A bar's own beams are inside its `<g class="vf-measure">` and never show up
 * there.
 *
 * The tests below are in the order the feature can fail: does it join at all, does it survive the
 * passes that reuse both bars, does it stay off when nothing marked it, and does the bar next door
 * get redrawn when the mark changes.
 */
import { describe, it, expect } from 'vitest'
import { ScoreModel } from '../models/ScoreModel'
import { VexFlowRenderer } from './VexFlowRenderer'
import { planCrossBarBeams, computeSides, type CrossBarBar, type CrossBarJoinMember } from './CrossBarBeams'
import { measureShapeKey } from './MeasureRedrawKey'
import { fracCreate as frac } from '@/utils/fraction'
import type { Measure } from '@/types/music'

// --- integration: the drawn picture -----------------------------------------

function makeRenderer() {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const renderer = new VexFlowRenderer(container)
  renderer.initialize(1200, 800)
  return renderer
}

/** Two bars of eight eighths in 4/4 — beamed 2+2+2+2 each, with no mark anywhere. */
function twoBarsOfEighths(): ScoreModel {
  const model = new ScoreModel()
  model.addMeasure()
  for (const measure of [1, 2]) {
    for (let i = 0; i < 8; i++) {
      model.addNote({ step: 'C', octave: 4, duration: '8', measure, beat: frac(i, 2) })
    }
  }
  return model
}

/** The beams drawn OUTSIDE every measure group — i.e. the ones that cross a barline. */
function crossBarBeamNodes(renderer: VexFlowRenderer): Element[] {
  const svg = renderer.getSVGElement()!
  return [...svg.children].filter(el => el.getAttribute('class') === 'vf-beam')
}

/** The LAST note of a bar in one voice, by its pitch id — `slots` interleaves the voices. */
function lastNoteIdOf(model: ScoreModel, measure: number, voice = 0): string {
  const chords = model.getScore().measures[measure - 1].slots
    .filter(s => s.type === 'chord' && (s.voice ?? 0) === voice)
  const last = chords[chords.length - 1]
  if (!last || last.type !== 'chord') throw new Error('no note in that voice')
  return last.notes[0].id
}

/** The nth note of a bar, in beat order, by its pitch id. */
function noteIdAt(model: ScoreModel, measure: number, index: number): string {
  const slot = model.getScore().measures[measure - 1].slots[index]
  if (slot.type !== 'chord') throw new Error('not a chord')
  return slot.notes[0].id
}

describe('cross-barline beams — the drawn beam', () => {
  it('nothing crosses a barline until something says so', () => {
    const model = twoBarsOfEighths()
    const renderer = makeRenderer()
    renderer.renderScore(model.getScore())

    expect(crossBarBeamNodes(renderer)).toHaveLength(0)
  })

  it("`continue` on the last note of bar 1 draws ONE beam outside both measure groups", () => {
    const model = twoBarsOfEighths()
    const renderer = makeRenderer()
    model.updateNote(noteIdAt(model, 1, 7), { beam: 'continue' })
    renderer.renderScore(model.getScore())

    expect(crossBarBeamNodes(renderer)).toHaveLength(1)
  })

  it('the join survives a render that REUSES both bars — the whole reason it is a post-measure pass', () => {
    // Top-level content is torn down every render while measure groups are reused. A beam rebuilt
    // only when its bars are re-engraved would vanish on the next unrelated render, leaving both
    // bars' notes standing with no flag AND no stem.
    const model = twoBarsOfEighths()
    const renderer = makeRenderer()
    model.updateNote(noteIdAt(model, 1, 7), { beam: 'continue' })
    renderer.renderScore(model.getScore())
    const groups = [renderer.getMeasureSVGGroup(1, 0), renderer.getMeasureSVGGroup(2, 0)]

    renderer.renderScore(model.getScore())

    expect([renderer.getMeasureSVGGroup(1, 0), renderer.getMeasureSVGGroup(2, 0)], 'both bars reused')
      .toEqual(groups)
    expect(crossBarBeamNodes(renderer), 'and the beam is still drawn').toHaveLength(1)
  })

  it('the mark redraws the bar NEXT DOOR too — its notes lose their flags as well', () => {
    const model = twoBarsOfEighths()
    const renderer = makeRenderer()
    renderer.renderScore(model.getScore())
    const before = [renderer.getMeasureSVGGroup(1, 0), renderer.getMeasureSVGGroup(2, 0)]

    model.updateNote(noteIdAt(model, 1, 7), { beam: 'continue' })
    renderer.renderScore(model.getScore())

    const after = [renderer.getMeasureSVGGroup(1, 0), renderer.getMeasureSVGGroup(2, 0)]
    expect(after[0], 'bar 1 re-engraved').not.toBe(before[0])
    expect(after[1], 'bar 2 re-engraved — the shape key must carry the join').not.toBe(before[1])
  })

  it('removing the mark takes the beam away again', () => {
    const model = twoBarsOfEighths()
    const renderer = makeRenderer()
    model.updateNote(noteIdAt(model, 1, 7), { beam: 'continue' })
    renderer.renderScore(model.getScore())

    model.updateNote(noteIdAt(model, 1, 7), { beam: 'auto' })
    renderer.renderScore(model.getScore())

    expect(crossBarBeamNodes(renderer)).toHaveLength(0)
  })

  it('a bar that is not painted closes its barline — no half-joined group', () => {
    // The placeholder is the danger: a note whose beam never arrives draws with no flag and no stem.
    const model = twoBarsOfEighths()
    const renderer = makeRenderer()
    model.updateNote(noteIdAt(model, 1, 7), { beam: 'continue' })
    renderer.setDrawFilter(p => p.measureNumber !== 2)
    renderer.renderScore(model.getScore())

    expect(crossBarBeamNodes(renderer)).toHaveLength(0)
  })

  it('joins a LONE note each side — `♪ | ♪`, the case a real placeholder Beam cannot carry', () => {
    // `new Beam()` throws on one note, so a bar whose only joined note is its last cannot hold a
    // Beam-shaped placeholder. Bar 1 is three quarters, an eighth rest, then the marked eighth.
    const model = new ScoreModel()
    model.addMeasure()
    for (let q = 0; q < 3; q++) model.addNote({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: frac(q, 1) })
    model.addNote({ step: 'C', octave: 4, duration: '8', measure: 1, beat: frac(7, 2) })
    model.addNote({ step: 'C', octave: 4, duration: '8', measure: 2, beat: frac(0, 1) })
    for (let q = 1; q < 4; q++) model.addNote({ step: 'C', octave: 4, duration: 'q', measure: 2, beat: frac(q, 1) })

    model.updateNote(lastNoteIdOf(model, 1), { beam: 'continue' })

    const renderer = makeRenderer()
    renderer.renderScore(model.getScore())

    expect(crossBarBeamNodes(renderer)).toHaveLength(1)
  })

  it('joins inside VOICE 2, where the stem side is the bar’s to force', () => {
    const model = twoBarsOfEighths()
    for (const measure of [1, 2]) {
      for (let i = 0; i < 8; i++) {
        model.addNote({ step: 'A', octave: 3, duration: '8', measure, beat: frac(i, 2), voice: 1 })
      }
    }
    model.updateNote(lastNoteIdOf(model, 1, 1), { beam: 'continue' })

    const renderer = makeRenderer()
    renderer.renderScore(model.getScore())

    expect(crossBarBeamNodes(renderer)).toHaveLength(1)
  })

  it("the palette agrees with the staff: the joined note reads `continue`, not `end`", () => {
    const model = twoBarsOfEighths()
    model.updateNote(noteIdAt(model, 1, 7), { beam: 'continue' })

    expect(model.getBeamRole(noteIdAt(model, 1, 7))).toBe('continue')
    expect(model.getBeamRole(noteIdAt(model, 1, 6))).toBe('begin')
    expect(model.getBeamRole(noteIdAt(model, 2, 1))).toBe('end')
  })
})

// --- unit: the planner ------------------------------------------------------

describe('cross-barline beams — the planner', () => {
  const STEM_UP = 1
  const stubStem = () => STEM_UP

  /** One staff's bar from a model, wrapped as the planner sees it. */
  const asBar = (view: Measure, over: Partial<CrossBarBar> = {}): CrossBarBar => ({
    measureNumber: view.number,
    staffIndex: 0,
    line: 0,
    drawn: true,
    view,
    clef: 'treble',
    ...over,
  })

  const joined = (model: ScoreModel, over: (i: number) => Partial<CrossBarBar> = () => ({})) =>
    planCrossBarBeams(model.getScore().measures.map((m, i) => asBar(m, over(i))), stubStem)

  it('a join names both bars, in order, with every member of the group', () => {
    const model = twoBarsOfEighths()
    model.updateNote(noteIdAt(model, 1, 7), { beam: 'continue' })

    const { joins } = joined(model)
    expect(joins).toHaveLength(1)
    // A same-line join is one whole side; the group's measures and members live there now.
    expect(joins[0].sides).toHaveLength(1)
    expect(joins[0].sides[0].measures).toEqual([1, 2])
    expect(joins[0].sides[0].members.map(m => m.measureNumber)).toEqual([1, 1, 2, 2])
    expect(joins[0].stemDirection).toBe(STEM_UP)
  })

  it('the crossing slots are taken OUT of their bars own groups', () => {
    const model = twoBarsOfEighths()
    model.updateNote(noteIdAt(model, 1, 7), { beam: 'continue' })

    const { lanes } = joined(model)
    const bar1 = lanes.get('1:0:v0')!
    expect(bar1.inBar, 'bar 1 keeps its first three pairs').toEqual([[0, 1], [2, 3], [4, 5]])
    expect(bar1.crossing).toEqual([{ slots: [6, 7], stemDirection: STEM_UP }])
    expect(lanes.get('2:0:v0')!.crossing).toEqual([{ slots: [0, 1], stemDirection: STEM_UP }])
  })

  it('a SYSTEM BREAK now SPLITS the join into two sides — the half-beam, not a wall (P3)', () => {
    const model = twoBarsOfEighths()
    model.updateNote(noteIdAt(model, 1, 7), { beam: 'continue' })

    const { joins, lanes } = joined(model, i => ({ line: i })) // bar 2 opens a new system
    expect(joins).toHaveLength(1)
    const [sideA, sideB] = joins[0].sides
    expect([sideA.measures, sideB.measures], 'one fragment per line').toEqual([[1], [2]])
    expect([sideA.openRight, sideB.openLeft], 'each opens toward the break').toEqual([true, true])
    // and the crossing slots are still taken out of bar 1's own in-bar groups.
    expect(lanes.get('1:0:v0')!.crossing).toEqual([{ slots: [6, 7], stemDirection: STEM_UP }])
    expect(lanes.get('1:0:v0')!.inBar).toEqual([[0, 1], [2, 3], [4, 5]])
  })

  /**
   * ⭐ A crossing group holding a FAN is the fan's beam, not a `Beam` (docs/fan-beam-join-plan.md P3).
   * It is routed to `fanJoins`, its owner keeps its stem, and a group that landed on two systems is
   * refused outright rather than split.
   */
  describe('a crossing group whose beam is a FAN’s', () => {
    /** Bar 1 ends on an eighth; bar 2 opens with a fanned eighth carrying the join. */
    function fanAcrossBarline(): ScoreModel {
      const model = twoBarsOfEighths()
      const fanned = noteIdAt(model, 2, 0)
      model.setFan(fanned, { direction: 'accel', count: 6, beams: 3 })
      model.updateNote(fanned, { beam: 'continue' })
      return model
    }

    it('goes to `fanJoins`, never to `joins` — no `Beam` is built over it', () => {
      const { joins, fanJoins } = joined(fanAcrossBarline())
      expect(joins).toHaveLength(0)
      expect(fanJoins).toHaveLength(1)
      expect(fanJoins[0].members.map(m => m.measureNumber)).toEqual([1, 1, 2])
      expect(fanJoins[0].members.map(m => m.fan)).toEqual([false, false, true])
      expect(fanJoins[0].stemDirection).toBe(STEM_UP)
    })

    it('⭐ the OWNER is kept out of `crossing` — a placeholder would delete its stem', () => {
      const { lanes } = joined(fanAcrossBarline())
      // The prefix half, in bar 1, is suppressed exactly as an ordinary crossing group's is…
      expect(lanes.get('1:0:v0')!.crossing).toEqual([{ slots: [6, 7], stemDirection: STEM_UP }])
      expect(lanes.get('1:0:v0')!.fanned).toEqual([])
      // …while the fan itself takes the direction and nothing else.
      expect(lanes.get('2:0:v0')!.crossing).toEqual([])
      expect(lanes.get('2:0:v0')!.fanned).toEqual([{ slots: [0], stemDirection: STEM_UP }])
    })

    it('carries what a two-bar lane cannot answer in one voice — clef, signs, the NEXT note', () => {
      const model = fanAcrossBarline()
      const [, , fan] = joined(model).fanJoins[0].members
      expect(fan.clef).toBe('treble')
      expect(fan.laneSlots).toEqual(model.getScore().measures[1].slots.filter(s => (s.voice ?? 0) === 0))
      // ⚠️ The next note in the fan's OWN bar — the ramp must not spread over it.
      expect(fan.nextLookupId).toBe(noteIdAt(model, 2, 1))
    })

    it('⛔ a group that landed on TWO systems is refused, and the prefix is handed back', () => {
      const { joins, fanJoins, lanes } = joined(fanAcrossBarline(), i => ({ line: i }))
      expect([joins, fanJoins]).toEqual([[], []])
      // Bar 1's two notes beam as their own group rather than standing flagless for a beam that
      // never comes — the worst of the three outcomes is a placeholder with no partner.
      expect(lanes.get('1:0:v0')!.crossing).toEqual([])
      expect(lanes.get('1:0:v0')!.inBar).toEqual([[0, 1], [2, 3], [4, 5], [6, 7]])
      expect(lanes.get('2:0:v0')!.crossing).toEqual([])
      expect(lanes.get('2:0:v0')!.fanned).toEqual([])
    })
  })

  it('a side whose own bar is undrawn does not draw, while its partner side still does (P3)', () => {
    // The regression bar: side A (line 0, painted) must form and draw its fragment whether or not
    // the next system is culled — the join is the same, so the shape-key descriptor stays stable.
    const model = twoBarsOfEighths()
    model.updateNote(noteIdAt(model, 1, 7), { beam: 'continue' })

    const { joins } = joined(model, i => ({ line: i, drawn: i === 0 }))
    expect(joins, 'the join still forms — the planner is drawn-blind across the break').toHaveLength(1)
    const [sideA, sideB] = joins[0].sides
    expect(sideA.drawable, 'the painted side draws').toBe(true)
    expect(sideB.drawable, 'the culled side does not').toBe(false)
  })

  it('an UNPAINTED bar is a wall too — but only WITHIN a line (P3)', () => {
    const model = twoBarsOfEighths()
    model.updateNote(noteIdAt(model, 1, 7), { beam: 'continue' })

    // Same line, bar 2 unpainted: a real Beam needs both bars' notes, so the run still walls here.
    const { joins, lanes } = joined(model, i => ({ drawn: i === 0 }))
    expect(joins).toHaveLength(0)
    expect(lanes.get('1:0:v0')!.crossing).toEqual([])
  })

  it('the shape-key descriptor is carried by BOTH bars, and moves when the group does', () => {
    const model = twoBarsOfEighths()
    model.updateNote(noteIdAt(model, 1, 7), { beam: 'continue' })
    const plan = joined(model)

    const bar1 = plan.descriptorFor(1, 0)
    expect(bar1).not.toBe('')
    expect(plan.descriptorFor(2, 0), 'the same join, stated in both bars').toBe(bar1)
    expect(plan.descriptorFor(1, 1), 'another staff is untouched').toBe('')

    // Widen the group from the other side: bar 2's first note now joins backwards as well, which
    // changes nothing in bar 1's own slots — and must still move bar 1's key, because the beam it
    // draws flagless is a different one.
    model.updateNote(noteIdAt(model, 2, 2), { beam: 'continue' })
    expect(joined(model).descriptorFor(1, 0)).not.toBe(bar1)
  })

  it('the descriptor reaches the shape key', () => {
    const model = twoBarsOfEighths()
    const view = model.getScore().measures[0]
    const inputs = { view, staffIndex: 0, width: 300, isFirstInLine: true, scale: 1, clef: 'treble' as const, hasClefChange: false }

    const plain = measureShapeKey(model.getScore(), inputs, null, null)
    const joinedKey = measureShapeKey(model.getScore(), { ...inputs, crossBarBeams: 'v0/1/a,b' }, null, null)
    expect(joinedKey).not.toBe(plain)
  })

  it('a two-voice bar forces the join’s stem side, even joining a one-voice bar', () => {
    // The stem direction is ONE answer for the whole group, and a bar with two voices has already
    // decided it for its lane (odd voices up, even down). Voice parity is the same in both bars, so
    // the two can never disagree — but only one of them may be the bar that has an opinion.
    const model = twoBarsOfEighths()
    for (let i = 0; i < 8; i++) {
      model.addNote({ step: 'A', octave: 3, duration: '8', measure: 1, beat: frac(i, 2), voice: 1 })
    }
    model.updateNote(lastNoteIdOf(model, 1), { beam: 'continue' }) // voice 1 (model 0), stems up

    const seen: (number | undefined)[] = []
    planCrossBarBeams(
      model.getScore().measures.map(m => asBar(m)),
      (_slots, _first, forced) => { seen.push(forced); return forced ?? STEM_UP },
    )
    expect(seen, 'bar 1 has two voices and forces V1 up; bar 2 has no opinion and takes it').toEqual([1])
  })

  it('an untouched score plans no joins at all', () => {
    expect(joined(twoBarsOfEighths()).joins).toEqual([])
  })

  it("today's join is whole — one side, open at neither end, drawable", () => {
    const model = twoBarsOfEighths()
    model.updateNote(noteIdAt(model, 1, 7), { beam: 'continue' })

    const { joins } = joined(model)
    expect(joins[0].sides).toHaveLength(1)
    const [side] = joins[0].sides
    expect(side.openLeft).toBe(false)
    expect(side.openRight).toBe(false)
    expect(side.crossingLeft).toBeNull()
    expect(side.crossingRight).toBeNull()
    expect(side.drawable).toBe(true)
    expect(side.members.map(m => m.measureNumber)).toEqual([1, 1, 2, 2])
  })
})

// --- unit: sides, the per-system split (docs/cross-barline-beaming-plan.md) ---

describe('cross-system beam fragments — computeSides', () => {
  // Synthetic members: the wall still keeps real joins single-line, so the split is exercised here,
  // where lines can be handed in freely. `m` is the measure the member sits in; `beamCount` its levels.
  const member = (m: number, i: number, beamCount = 1): CrossBarJoinMember =>
    ({ measureNumber: m, slotId: `s${m}.${i}`, lookupId: `s${m}.${i}`, beamCount })

  it('a split lands exactly where the line changes', () => {
    const members = [member(1, 0), member(1, 1), member(2, 0), member(2, 1)]
    const sides = computeSides(members, [0, 0, 1, 1], [true, true, true, true], [])

    expect(sides).toHaveLength(2)
    expect(sides[0].members.map(m => m.slotId)).toEqual(['s1.0', 's1.1'])
    expect(sides[1].members.map(m => m.slotId)).toEqual(['s2.0', 's2.1'])
    expect(sides[0]).toMatchObject({ openLeft: false, openRight: true, measures: [1] })
    expect(sides[1]).toMatchObject({ openLeft: true, openRight: false, measures: [2] })
  })

  it('a three-system group yields three sides, the middle one open at BOTH ends', () => {
    const members = [member(1, 0), member(1, 1), member(2, 0), member(2, 1), member(3, 0), member(3, 1)]
    const sides = computeSides(members, [0, 0, 1, 1, 2, 2], Array(6).fill(true), [])

    expect(sides).toHaveLength(3)
    expect(sides.map(s => [s.openLeft, s.openRight])).toEqual([
      [false, true], [true, true], [true, false],
    ])
    expect(sides.map(s => s.measures)).toEqual([[1], [2], [3]])
  })

  it('one note per side — `♪ | ♪` across the break', () => {
    const members = [member(1, 0), member(2, 0)]
    const sides = computeSides(members, [0, 1], [true, true], [])

    expect(sides).toHaveLength(2)
    expect(sides[0].members).toHaveLength(1)
    expect(sides[1].members).toHaveLength(1)
  })

  it('sides re-base their secondary breaks, and a break AT the split is dropped', () => {
    // Group-local breaks [0, 2, 3] over lines [0,0,0,1,1]: break 0 sits inside side A; break 2
    // straddles the split (it IS the crossing) and drops; break 3 sits inside side B, re-based to 0.
    const members = [member(1, 0, 2), member(1, 1, 2), member(1, 2, 2), member(2, 0, 2), member(2, 1, 2)]
    const sides = computeSides(members, [0, 0, 0, 1, 1], Array(5).fill(true), [0, 2, 3])

    expect(sides[0].secondaryBreaks).toEqual([0])
    expect(sides[1].secondaryBreaks).toEqual([0])
  })

  it('the crossing count is the lines common to both sides — min, or 1 when the split is broken', () => {
    // 𝅘𝅥𝅯 (2) | ♪ (1): only the primary crosses, so the count is 1.
    const share = computeSides([member(1, 0, 2), member(2, 0, 1)], [0, 1], [true, true], [])
    expect(share[0].crossingRight).toBe(1)
    expect(share[1].crossingLeft).toBe(1)

    // 𝅘𝅥𝅯 (2) | 𝅘𝅥𝅯 (2), unbroken: both lines cross.
    const both = computeSides([member(1, 0, 2), member(2, 0, 2)], [0, 1], [true, true], [])
    expect(both[0].crossingRight).toBe(2)

    // 𝅘𝅥𝅯 (2) | 𝅘𝅥𝅯 (2), but a secondary break sits AT the split: only the primary crosses.
    const cut = computeSides([member(1, 0, 2), member(2, 0, 2)], [0, 1], [true, true], [0])
    expect(cut[0].crossingRight).toBe(1)
  })

  it('a side is drawable only when every one of its own bars is painted', () => {
    const members = [member(1, 0), member(1, 1), member(2, 0), member(2, 1)]
    const sides = computeSides(members, [0, 0, 1, 1], [true, true, false, false], [])

    expect(sides[0].drawable, 'side A is fully painted').toBe(true)
    expect(sides[1].drawable, 'side B has an unpainted bar').toBe(false)
  })
})
