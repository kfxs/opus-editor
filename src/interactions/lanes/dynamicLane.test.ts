/**
 * ⭐ {@link dynamicLane} — every slot a dynamic can sit on, as the last render DREW them.
 *
 * The registry is the fixture: the drawn note boxes are what the render measured, so "where is this
 * slot" is arithmetic and belongs in a unit test (no glyph is measured here — see
 * `reference_jsdom_cannot_measure_glyphs`).
 *
 * ⭐⭐ The claims are about WHICH x's exist at all, and they are the reason this is one function
 * rather than a copy in the walk and another in the drag: a mark is drawn CENTRED on its notehead
 * (`rendering/marks/dynamics/dynamicMarkAnchor.ts`), a chord is ONE slot, a rest is a slot, and nothing outside the
 * mark's own lane is one.
 */
import { describe, it, expect } from 'vitest'
import { dynamicAddress, dynamicLaneHeads, dynamicStaffLaneHeads, systemSlotFor, type LaneEngine } from './dynamicLane'
import { ElementRegistry, type ElementInfo } from '../../engine/ElementRegistry'
import type { Dynamic, Score } from '../../types/music'

function laneEngine(notes: Array<{
  id: string; left: number; y: number; measure: number; beat: number
  voice?: number; staff?: number; rest?: boolean
}>): LaneEngine {
  const registry = new ElementRegistry()
  for (const n of notes) {
    registry.add({
      type: n.rest ? 'rest' : 'note', id: n.id, staff: n.staff ?? 0,
      bbox: { x: n.left, y: n.y - 5, width: 12, height: 10 },
    } as ElementInfo)
  }
  return {
    getScore: () => ({ staves: [{ id: 's0' }, { id: 's1' }], measures: [] }) as unknown as Score,
    getElementRegistry: () => registry,
    getNote: (id: string) => {
      const n = notes.find(x => x.id === id)
      return n ? { id, measure: n.measure, beat: { num: n.beat, den: 1 }, voice: n.voice, staff: n.staff } : null
    },
  } as unknown as LaneEngine
}

const mark = (over: Partial<Dynamic> = {}): Dynamic =>
  ({ id: 'D1', beat: { num: 0, den: 1 }, text: 'p', ...over }) as Dynamic

/** Three quarters whose heads are 12px wide at x = 100 / 200 / 300 — centres at 106 / 206 / 306. */
const THREE = [
  { id: 'n1', left: 100, y: 50, measure: 1, beat: 0 },
  { id: 'n2', left: 200, y: 50, measure: 1, beat: 1 },
  { id: 'n3', left: 300, y: 50, measure: 1, beat: 2 },
]

describe('dynamicLaneHeads', () => {
  it('⭐⭐ answers with notehead CENTRES — a dynamic is drawn centred on its column', () => {
    // ⛔ NOT the left edges the hairpin's tip is drawn at (`hairpinLane`). Get the two the
    // same way round and every gap this feeds is half a notehead out.
    expect(dynamicLaneHeads(laneEngine(THREE), mark()).map(h => h.x)).toEqual([106, 206, 306])
  })

  it('reaches every slot of the mark’s STAFF, in any voice', () => {
    const engine = laneEngine([
      { id: 'mine', left: 180, y: 50, measure: 1, beat: 0, voice: 0 },
      { id: 'theirs', left: 174, y: 50, measure: 1, beat: 2, voice: 1 },
    ])
    expect(dynamicLaneHeads(engine, mark()).map(h => h.target.beat.num)).toEqual([0, 2])
  })

  it('⭐⭐ …and a mark NARROWED to a voice sees exactly the same heads', () => {
    // His call, 2026-08-19: the voice controls the REPRODUCTION, not where the mark may be dragged.
    const engine = laneEngine([
      { id: 'mine', left: 180, y: 50, measure: 1, beat: 0, voice: 0 },
      { id: 'theirs', left: 174, y: 50, measure: 1, beat: 2, voice: 1 },
    ])
    expect(dynamicLaneHeads(engine, mark({ voice: 0 })).map(h => h.target.beat.num)).toEqual([0, 2])
    expect(dynamicLaneHeads(engine, mark({ voice: 3 })).map(h => h.target.beat.num)).toEqual([0, 2])
  })

  it('⚠️ ONE head per ADDRESS — two voices striking a beat are one place to stand', () => {
    const engine = laneEngine([
      { id: 'v0', left: 180, y: 50, measure: 1, beat: 0, voice: 0 },
      { id: 'v1', left: 180, y: 90, measure: 1, beat: 0, voice: 1 },
    ])
    expect(dynamicLaneHeads(engine, mark())).toHaveLength(1)
  })

  it('…and its own STAFF', () => {
    const engine = laneEngine([
      { id: 'mine', left: 180, y: 50, measure: 1, beat: 0, staff: 1 },
      { id: 'other', left: 174, y: 50, measure: 1, beat: 2, staff: 0 },
    ])
    expect(dynamicLaneHeads(engine, mark({ staffId: 's1' })).map(h => h.target.beat.num)).toEqual([0])
  })

  it('⭐ a REST is a slot — a mark at the top of a bar that begins with one is ordinary', () => {
    const engine = laneEngine([
      { id: 'r1', left: 100, y: 50, measure: 1, beat: 0, rest: true },
      { id: 'n2', left: 200, y: 50, measure: 1, beat: 1 },
    ])
    // ⚠️ Sorted here, not there: the list is notes-then-rests (the registry's two buckets), and no
    // caller reads it in order — the walk looks a slot up by ADDRESS. Assert the membership.
    expect(dynamicLaneHeads(engine, mark()).map(h => h.target.beat.num).sort()).toEqual([0, 1])
  })

  it('a CHORD is ONE slot — the mark is centred on the column, not on a head of it', () => {
    const engine = laneEngine([
      { id: 'low', left: 200, y: 50, measure: 1, beat: 1 },
      { id: 'high', left: 200, y: 30, measure: 1, beat: 1 },
    ])
    expect(dynamicLaneHeads(engine, mark())).toHaveLength(1)
  })
})

/**
 * ⭐⭐ {@link dynamicStaffLaneHeads} — the VERTICAL drag's candidates, which are every painted
 * staff's. His report, 2026-08-21: on a grand staff a dragged dynamic *"just land in the next
 * system"*, because the staff below held nothing it could land on.
 */
describe('dynamicStaffLaneHeads', () => {
  it('⭐⭐ answers for EVERY staff, each head naming the staff it stands on', () => {
    const engine = laneEngine([
      { id: 'up', left: 100, y: 50, measure: 1, beat: 0, staff: 0 },
      { id: 'down', left: 100, y: 250, measure: 1, beat: 0, staff: 1 },
    ])
    expect(dynamicStaffLaneHeads(engine).map(h => h.target.staffId)).toEqual([undefined, 's1'])
  })

  it('⚠️ the first staff is spelled ABSENT — the model\'s write convention, resolved here', () => {
    // `staffIdForIndex`'s rule: staff 0 stamps no id. A real id would be a second spelling of one
    // staff, and `onSameStaff` is the only reader that could tell them apart.
    const engine = laneEngine([{ id: 'up', left: 100, y: 50, measure: 1, beat: 0, staff: 0 }])
    expect(dynamicStaffLaneHeads(engine)[0].target.staffId).toBeUndefined()
  })

  it('🚨 the dedupe is keyed on the STAFF too — one beat struck on both is TWO places', () => {
    const engine = laneEngine([
      { id: 'up', left: 100, y: 50, measure: 1, beat: 0, staff: 0 },
      { id: 'down', left: 100, y: 250, measure: 1, beat: 0, staff: 1 },
      { id: 'up-v2', left: 100, y: 70, measure: 1, beat: 0, staff: 0, voice: 1 },
    ])
    // Three heads in, two places out: the second voice of staff 0 collapses, the lower staff does not.
    expect(dynamicStaffLaneHeads(engine)).toHaveLength(2)
  })
})

/**
 * ⭐⭐ {@link systemSlotFor} — which system the mark now BELONGS to.
 *
 * His call, 2026-08-19, after trying the staff's five lines as the boundary: *"crossing the stave is
 * not a good limit… a more organic limit vertically"*.
 *
 * ⚠️⚠️ **EXPLORATORY (2026-08-31) — THE RULE UNDER TEST CHANGED, and this spec follows it.** It was
 * *where this mark would look at home* (its natural distance from its own staff, lift taken back
 * out, applied to every other staff — the switch halfway between where it sits and where it would
 * sit). His report on the dynamic's drag: *"is reanchor very late… it should take into account the
 * elements y of the staff similar to what we do with hairpin"* — measured on the Prelude, the
 * hand-over fired at ink 458 with the two staves' music ending at 366 and beginning at 404, i.e. the
 * whole white space crossed first. It is now the wedge's rule, `betweenTheMusic`: **the middle of
 * the white space between the two staves' own MUSIC**, one line read the same in both directions.
 */
describe('systemSlotFor', () => {
  /** Two staves, 40–80 and 340–380, with two lane slots drawn on each. */
  const BANDS = [{ top: 40, bottom: 80 }, { top: 340, bottom: 380 }]
  const TWO_SYSTEMS = [
    { id: 'a', left: 100, y: 60, measure: 1, beat: 0 },
    { id: 'b', left: 300, y: 60, measure: 1, beat: 1 },
    { id: 'c', left: 100, y: 360, measure: 5, beat: 0 },
    { id: 'd', left: 300, y: 360, measure: 5, beat: 1 },
  ]

  /**
   * The mark is anchored at 1@0 (the TOP system) and DRAWN at `inkAt` — 110 by default, i.e. 30 px
   * below its staff's bottom line. ⚠️ Neither that nor its lift decides any more: these runs draw no
   * music, so their five lines answer for it and the switch sits at **(80 + 340) / 2 = 210**.
   */
  const engine = (inkAt = 110, notes = TWO_SYSTEMS, bands = BANDS, lift = 0) => {
    const base = laneEngine(notes)
    const registry = base.getElementRegistry()
    registry.add({ type: 'dynamic', id: 'D1', staff: 0,
      bbox: { x: 100, y: inkAt - 5, width: 12, height: 10 } } as ElementInfo)
    ;(registry as unknown as { staffBands: () => unknown }).staffBands = () => bands
    ;(registry as unknown as { staffRuns: () => unknown }).staffRuns = () =>
      (bands).map(b => ({ ...b, left: -Infinity, right: Infinity }))
    return {
      ...base,
      getElementRegistry: () => registry,
      getScore: () => ({
        staves: [{ id: 's0' }],
        measures: [{ number: 1, dynamics: [{ id: 'D1', beat: { num: 0, den: 1 } }] }],
        ...(lift ? { engravingOverrides: { D1: [{ kind: 'dynamicOffset', x: 0, y: lift }] } } : {}),
      }) as unknown as Score,
    } as LaneEngine
  }

  it('⭐⭐ hands the mark over at the MIDDLE OF THE WHITE SPACE between the two staves', () => {
    // ⛔ Not at the staff's lines (340), which is late and lopsided, and ⚠️ no longer halfway to
    // where the mark would sit down there (260), which is late for a mark hanging on the far side of
    // its own staff. One pixel either side of 210.
    expect(systemSlotFor(engine(), mark(), 290, 209, 10)).toBeNull()
    expect(systemSlotFor(engine(), mark(), 290, 211, 10))
      .toEqual({ measure: 5, beat: { num: 1, den: 1 } })
  })

  it('⭐⭐ …and it is the MUSIC that says where that middle is — ⛔ not the five lines', () => {
    // ⚠️⚠️ EXPLORATORY (2026-08-31) — the whole of what he asked for: *"it should take into account
    // the elements y of the staff"*. The upper run's stems reach to 240 where its lines stop at 80,
    // so the white space a reader sees is 240…340 and its middle moves down with them: 290, ⛔ not
    // 210. (`ElementRegistry.staffRuns` carries the run's own notes and rests.)
    const withInk = [{ ...BANDS[0], inkTop: 40, inkBottom: 240 }, { ...BANDS[1] }]
    expect(systemSlotFor(engine(110, TWO_SYSTEMS, withInk), mark(), 290, 289, 10)).toBeNull()
    expect(systemSlotFor(engine(110, TWO_SYSTEMS, withInk), mark(), 290, 291, 10))
      .toMatchObject({ measure: 5 })
  })

  it('⭐ the x picks the slot within the system it landed on', () => {
    expect(systemSlotFor(engine(), mark(), 110, 300, 10))
      .toEqual({ measure: 5, beat: { num: 0, den: 1 } })
  })

  it('⛔ …and NOTHING while the mark still belongs where it is', () => {
    expect(systemSlotFor(engine(), mark(), 290, 150, 10)).toBeNull()
    // Dragged UP through its own staff and above it: still the top system's mark, since the only
    // other home is 300 px the other way.
    expect(systemSlotFor(engine(), mark(), 290, 20, 10)).toBeNull()
  })

  it('🚨 the mark\'s own LIFT no longer enters the decision — WHERE THE INK IS is the whole of it', () => {
    // ⚠️⚠️ EXPLORATORY (2026-08-31). The rule this replaced had to take the lift back out to find the
    // mark's natural home, or the mark carried its own boundary down with it for ever and the switch
    // never arrived (`y: 44.86`, a guide line over three staves). A territory is a place, so the same
    // ink answers the same whether a lift or an engraver put it there.
    expect(systemSlotFor(engine(260, TWO_SYSTEMS, BANDS, 15), mark(), 290, 261, 10))
      .toEqual({ measure: 5, beat: { num: 1, den: 1 } })
    expect(systemSlotFor(engine(260), mark(), 290, 261, 10), 'no lift, same ink, same answer')
      .toEqual({ measure: 5, beat: { num: 1, den: 1 } })
  })

  it('⭐⭐ …and a mark ABOVE its staff reads the SAME line — one line, both rungs', () => {
    // ⚠️⚠️ EXPLORATORY (2026-08-31). The rule this replaced measured off the mark's own side (the TOP
    // line for a mark above), giving the two rungs of one staff two different boundaries. A dynamic
    // has both rungs — *below staff N* and *above staff N+1* are one strip of paper — so the line
    // that separates them is INSIDE that strip and is the same for both.
    const above = mark({ placement: 'above' })
    expect(systemSlotFor(engine(10), above, 290, 209, 10)).toBeNull()
    expect(systemSlotFor(engine(10), above, 290, 211, 10)).toMatchObject({ measure: 5 })
  })

  it('⛔ null when the system it now belongs to carries no music in this lane', () => {
    // Nothing to anchor to, so the frame stays a plain ink move and the hand can carry on.
    expect(systemSlotFor(engine(110, TWO_SYSTEMS.slice(0, 2)), mark(), 290, 300, 10)).toBeNull()
  })

  it('⛔ null when there is only one staff on the page — nothing to belong to', () => {
    expect(systemSlotFor(engine(110, TWO_SYSTEMS, [BANDS[0]]), mark(), 290, 400, 10)).toBeNull()
  })
})

/**
 * ⭐⭐ **THE STAFF BELOW COUNTS, NOT ONLY THE SYSTEM BELOW** — his report, 2026-08-21: on a grand
 * staff the dragged mark *"just land in the next system"*, and *"the user want to place elements
 * vertically"*.
 *
 * The rule above never had to change: it was always choosing between PAINTED STAVES, and the other
 * hand of a grand staff was in the running with no candidate on it. What is asserted here is that
 * the halfway line now falls between the two hands, and that the landing names the staff.
 */
describe('systemSlotFor — the other hand of a grand staff', () => {
  /** ONE system, two staves: 40–80 and 160–200. Both hands strike beats 0 and 1 of bar 1. */
  const BANDS = [{ top: 40, bottom: 80 }, { top: 160, bottom: 200 }]
  const GRAND = [
    { id: 'rh0', left: 100, y: 60, measure: 1, beat: 0, staff: 0 },
    { id: 'rh1', left: 300, y: 60, measure: 1, beat: 1, staff: 0 },
    { id: 'lh0', left: 100, y: 180, measure: 1, beat: 0, staff: 1 },
    { id: 'lh1', left: 300, y: 180, measure: 1, beat: 1, staff: 1 },
  ]

  /** The mark is anchored 1@0 on the TOP staff and drawn at `inkAt` — 110 by default, 30 px below
   *  its staff's bottom line. ⚠️ EXPLORATORY (2026-08-31): the switch is the middle of the white
   *  space between the two hands' music, and these runs draw none, so **(80 + 160) / 2 = 120**. */
  const engine = (inkAt = 110) => {
    const base = laneEngine(GRAND)
    const registry = base.getElementRegistry()
    registry.add({ type: 'dynamic', id: 'D1', staff: 0,
      bbox: { x: 100, y: inkAt - 5, width: 12, height: 10 } } as ElementInfo)
    ;(registry as unknown as { staffBands: () => unknown }).staffBands = () => BANDS
    ;(registry as unknown as { staffRuns: () => unknown }).staffRuns = () =>
      (BANDS).map(b => ({ ...b, left: -Infinity, right: Infinity }))
    return {
      ...base,
      getElementRegistry: () => registry,
      getScore: () => ({
        staves: [{ id: 's0' }, { id: 's1' }],
        measures: [{ number: 1, dynamics: [{ id: 'D1', beat: { num: 0, den: 1 } }] }],
      }) as unknown as Score,
    } as LaneEngine
  }

  it('⭐⭐ hands the mark to the LEFT HAND in the middle of the white space between the hands', () => {
    // ⛔ Not at the lower staff's lines (160), and ⛔ not at the next system either — the answer that
    // sailed past the left hand entirely. One pixel either side of 120.
    expect(systemSlotFor(engine(), mark(), 290, 119, 10)).toBeNull()
    expect(systemSlotFor(engine(), mark(), 290, 121, 10))
      .toEqual({ measure: 1, beat: { num: 1, den: 1 }, staffId: 's1' })
  })

  it('⭐ the landing NAMES the staff — that is what makes it a move between hands', () => {
    // The address alone would be a no-op here: the mark is already at 1@0. `setDynamicAtStaffSlot`
    // reads the staff, so this frame is a real move and not a refused one.
    expect(systemSlotFor(engine(), mark(), 110, 200, 10))
      .toEqual({ measure: 1, beat: { num: 0, den: 1 }, staffId: 's1' })
  })

  it('⭐ and back UP: a mark on the lower staff belongs to the upper one past the same line', () => {
    const onLower = mark({ staffId: 's1' })
    // ⭐ ONE line, read the same in both directions, so there is no dead zone between the hand-over
    // down and the hand-over back up — the pixel that gives the mark away is the pixel that gives it
    // back.
    expect(systemSlotFor(engine(230), onLower, 110, 121, 10)).toBeNull()
    expect(systemSlotFor(engine(230), onLower, 110, 119, 10))
      .toEqual({ measure: 1, beat: { num: 0, den: 1 }, staffId: undefined })
  })
})

describe('dynamicAddress', () => {
  const score = {
    measures: [
      { number: 1, dynamics: [{ id: 'D1', beat: { num: 2, den: 1 } }] },
      { number: 2, dynamics: [{ id: 'D2', beat: { num: 0, den: 1 } }] },
    ],
  } as unknown as Score

  it('⭐ reads the MEASURE off the list the mark is stored in — its `beat` is only half an address', () => {
    expect(dynamicAddress(score, 'D2')).toEqual({ measure: 2, beat: { num: 0, den: 1 } })
  })

  it('⛔ null for an id no longer in the score', () => {
    expect(dynamicAddress(score, 'nope')).toBeNull()
  })
})
