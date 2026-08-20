import { describe, it, expect } from 'vitest'
import { hairpinLaneBoundaries, hairpinBoundaryX, hairpinStartAddress } from './hairpinLane'
import { ElementRegistry, type ElementInfo } from '../engine/ElementRegistry'
import type { Score } from '../types/music'

/**
 * ⭐⭐ WHERE A HAIRPIN'S LANE WAS DRAWN — the list both of the wedge's devices measure against.
 *
 * Subject: {@link hairpinLane}, sitting beside this file. Extracted from the drag on 2026-08-20 when
 * the left square's keyboard WALK (`./hairpinStartWalk`) needed the same geometry; these are the
 * claims that came with it, since they are facts about the LANE rather than about snapping a cursor
 * (which `elements/hairpinHandles.test.ts` still owns).
 *
 * ⭐⭐ **The candidates are LEFT EDGES.** A wedge's tips are drawn at a note's left edge
 * (`HairpinRenderer.spanX`), never on its head — the difference is half a notehead, and it is the
 * whole accuracy of both gestures.
 *
 * The REGISTRY is the fixture: the drawn boxes are what a render measured, and jsdom measures no
 * glyphs (`reference_jsdom_cannot_measure_glyphs`).
 */
function laneEngine(notes: Array<{
  id: string; left: number; y: number; measure: number; beat: number; voice?: number; staff?: number; width?: number
}>) {
  const registry = new ElementRegistry()
  for (const n of notes) {
    registry.add({
      type: 'note', id: n.id, staff: n.staff ?? 0,
      bbox: { x: n.left, y: n.y - 5, width: n.width ?? 12, height: 10 },
    } as ElementInfo)
  }
  return {
    getScore: () => ({ staves: [{ id: 's0' }, { id: 's1' }] }),
    getElementRegistry: () => registry,
    getNote: (id: string) => {
      const n = notes.find(x => x.id === id)
      return n ? { id, measure: n.measure, beat: { num: n.beat, den: 1 }, voice: n.voice, staff: n.staff } : null
    },
  } as unknown as Parameters<typeof hairpinLaneBoundaries>[0]
}

/** A wedge, as much of one as the lane reads: its staff, and its scope (which the lane ⛔ ignores). */
const wedge = (over: { voice?: 0 | 1 | 2 | 3; staffId?: string } = {}) =>
  ({ id: 'H1', type: 'cresc', beat: { num: 0, den: 1 }, length: { num: 1, den: 1 }, ...over }) as never

describe('hairpinLaneBoundaries', () => {
  it('⭐⭐ answers each onset at its LEFT EDGE — where a tip is drawn, not where the head is', () => {
    const engine = laneEngine([
      { id: 'n1', left: 100, y: 50, measure: 1, beat: 0 },
      { id: 'n2', left: 200, y: 50, measure: 1, beat: 1 },
    ])
    expect(hairpinLaneBoundaries(engine, wedge()).map(b => b.x)).toEqual([100, 200])
  })

  it('takes its boundaries from the wedge’s STAFF — every voice of it', () => {
    const engine = laneEngine([
      { id: 'mine', left: 180, y: 50, measure: 1, beat: 0, voice: 0 },
      { id: 'theirs', left: 174, y: 50, measure: 1, beat: 2, voice: 1 },
    ])
    expect(hairpinBoundaryX(engine, wedge(), { measure: 1, beat: { num: 2, den: 1 } })).toBe(174)
  })

  it('⭐⭐ …and a wedge NARROWED to a voice reaches the SAME boundaries', () => {
    // Scope is about loudness; a tip is drawn onto a COLUMN, and a column belongs to the staff
    // (`utils/dynamicScope.onSameStaff`, his call 2026-08-19).
    const engine = laneEngine([
      { id: 'mine', left: 180, y: 50, measure: 1, beat: 0, voice: 0 },
      { id: 'theirs', left: 174, y: 50, measure: 1, beat: 2, voice: 1 },
    ])
    expect(hairpinBoundaryX(engine, wedge({ voice: 0 }), { measure: 1, beat: { num: 2, den: 1 } })).toBe(174)
  })

  it('…but only its OWN staff', () => {
    const engine = laneEngine([
      { id: 'mine', left: 180, y: 50, measure: 1, beat: 0, staff: 1 },
      { id: 'other', left: 174, y: 50, measure: 1, beat: 2, staff: 0 },
    ])
    expect(hairpinLaneBoundaries(engine, wedge({ staffId: 's1' })).map(b => b.x)).toEqual([180])
  })

  it('a CHORD is ONE boundary — its leftmost head, which is the edge the wedge is drawn against', () => {
    const engine = laneEngine([
      { id: 'low', left: 200, y: 50, measure: 1, beat: 1 },
      { id: 'high', left: 208, y: 40, measure: 1, beat: 1 },
    ])
    const lane = hairpinLaneBoundaries(engine, wedge())
    expect(lane).toHaveLength(1)
    expect(lane[0].x, 'the leftmost head').toBe(200)
    expect(lane[0].right, 'and the rightmost ink, which is what covering it reaches').toBe(220)
  })

  it('answers null for a slot the last render drew nothing at — ⛔ never a guess', () => {
    const engine = laneEngine([{ id: 'n1', left: 100, y: 50, measure: 1, beat: 0 }])
    expect(hairpinBoundaryX(engine, wedge(), { measure: 4, beat: { num: 0, den: 1 } })).toBeNull()
  })
})

describe('hairpinStartAddress', () => {
  const score = {
    measures: [
      { id: 'm1', number: 1, slots: [], tuplets: [], timeSignature: { numerator: 4, denominator: 4 } },
      {
        id: 'm2', number: 2, slots: [], tuplets: [], timeSignature: { numerator: 4, denominator: 4 },
        hairpins: [{ id: 'H1', type: 'cresc', beat: { num: 2, den: 1 }, length: { num: 1, den: 1 } }],
      },
    ],
  } as unknown as Score

  it('⭐ names the MEASURE as well as the beat — the wedge object carries only half the address', () => {
    expect(hairpinStartAddress(score, 'H1')).toEqual({ measure: 2, beat: { num: 2, den: 1 } })
  })

  it('answers null for an id no longer in the score', () => {
    expect(hairpinStartAddress(score, 'gone')).toBeNull()
  })
})
