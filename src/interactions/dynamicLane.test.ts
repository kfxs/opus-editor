/**
 * ⭐ {@link dynamicLane} — every slot a dynamic can sit on, as the last render DREW them.
 *
 * The registry is the fixture: the drawn note boxes are what the render measured, so "where is this
 * slot" is arithmetic and belongs in a unit test (no glyph is measured here — see
 * `reference_jsdom_cannot_measure_glyphs`).
 *
 * ⭐⭐ The claims are about WHICH x's exist at all, and they are the reason this is one function
 * rather than a copy in the walk and another in the drag: a mark is drawn CENTRED on its notehead
 * (`rendering/dynamicMarkAnchor.ts`), a chord is ONE slot, a rest is a slot, and nothing outside the
 * mark's own lane is one.
 */
import { describe, it, expect } from 'vitest'
import { dynamicAddress, dynamicLaneHeads, systemSlotFor, type LaneEngine } from './dynamicLane'
import { ElementRegistry, type ElementInfo } from '../engine/ElementRegistry'
import type { Dynamic, Score } from '../types/music'

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
    // ⛔ NOT the left edges the hairpin's tip is drawn at (`hairpinDragTargetAt`). Get the two the
    // same way round and every gap this feeds is half a notehead out.
    expect(dynamicLaneHeads(laneEngine(THREE), mark()).map(h => h.x)).toEqual([106, 206, 306])
  })

  it('stays in the mark\'s own LANE — another voice is not a slot it can reach', () => {
    const engine = laneEngine([
      { id: 'mine', left: 180, y: 50, measure: 1, beat: 0, voice: 0 },
      { id: 'theirs', left: 174, y: 50, measure: 1, beat: 2, voice: 1 },
    ])
    expect(dynamicLaneHeads(engine, mark()).map(h => h.target.beat.num)).toEqual([0])
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
 * ⭐⭐ {@link systemSlotFor} — which system the mark now BELONGS to.
 *
 * His call, 2026-08-19, after trying the staff's five lines as the boundary: *"crossing the stave is
 * not a good limit… a more organic limit vertically"*. The rule under test is **where this mark
 * would look at home**: its natural distance from its own staff, measured off the render with its
 * own lift taken back out, applied to every other staff — nearest wins, so the switch falls exactly
 * halfway between where it sits and where it would sit.
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
   * below its staff's bottom line, which is its natural home. Its twin position on the second staff
   * is therefore 410, and the switch sits halfway between: **260**.
   */
  const engine = (inkAt = 110, notes = TWO_SYSTEMS, bands = BANDS, lift = 0) => {
    const base = laneEngine(notes)
    const registry = base.getElementRegistry()
    registry.add({ type: 'dynamic', id: 'D1', staff: 0,
      bbox: { x: 100, y: inkAt - 5, width: 12, height: 10 } } as ElementInfo)
    ;(registry as unknown as { staffBands: () => unknown }).staffBands = () => bands
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

  it('⭐⭐ hands the mark over HALFWAY to where it would sit on the next system', () => {
    // ⛔ Not at the staff's lines (340): that is late and lopsided. One pixel either side of 260.
    expect(systemSlotFor(engine(), mark(), 290, 259, 10)).toBeNull()
    expect(systemSlotFor(engine(), mark(), 290, 261, 10))
      .toEqual({ measure: 5, beat: { num: 1, den: 1 } })
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

  it('🚨 the mark\'s own LIFT is taken back out before the halfway point is worked out', () => {
    // The bug this rule replaced (`y: 44.86`, a guide line over three staves): with the lift left in,
    // the mark\'s "natural" home follows it down for ever and the switch never arrives. Here the mark
    // is drawn at 260 because the user has already dragged it 15 spaces (150 px) down — its natural
    // home is still 110, so it is exactly at the boundary and one pixel more hands it over.
    expect(systemSlotFor(engine(260, TWO_SYSTEMS, BANDS, 15), mark(), 290, 261, 10))
      .toEqual({ measure: 5, beat: { num: 1, den: 1 } })
  })

  it('⭐ an ABOVE mark measures from the staff\'s TOP line, so the rule mirrors', () => {
    // Drawn 30 px ABOVE its own staff (10), its twin on the second staff is 310, halfway is 160.
    const above = mark({ placement: 'above' })
    expect(systemSlotFor(engine(10), above, 290, 159, 10)).toBeNull()
    expect(systemSlotFor(engine(10), above, 290, 161, 10)).toMatchObject({ measure: 5 })
  })

  it('⛔ null when the system it now belongs to carries no music in this lane', () => {
    // Nothing to anchor to, so the frame stays a plain ink move and the hand can carry on.
    expect(systemSlotFor(engine(110, TWO_SYSTEMS.slice(0, 2)), mark(), 290, 300, 10)).toBeNull()
  })

  it('⛔ null when there is only one staff on the page — nothing to belong to', () => {
    expect(systemSlotFor(engine(110, TWO_SYSTEMS, [BANDS[0]]), mark(), 290, 400, 10)).toBeNull()
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
