import { describe, it, expect } from 'vitest'
import { ottavaLaneOnsets, ottavaEdgeX, ottavaStartAddress, ottavaStaffSpacePx } from './ottavaLane'
import { ElementRegistry, type ElementInfo } from '../engine/ElementRegistry'
import type { Score } from '../types/music'

/**
 * ⭐⭐ WHERE AN OCTAVE BRACKET'S LANE WAS DRAWN — the list both of its devices measure against.
 *
 * Subject: {@link ottavaLane}, sitting beside this file. Extracted from the drag on 2026-08-21 when
 * the two squares' keyboard WALK (`./ottavaWalk`) needed the same geometry; these are the claims
 * that came with it, since they are facts about the LANE rather than about snapping a cursor (which
 * `elements/ottavaHandles.test.ts` still owns).
 *
 * ⭐⭐ **The two ends read DIFFERENT edges of one onset** — the numeral at the first covered head's
 * left, the hook at the last covered head's right (Gould's rule 2, ⛔ the opposite of the wedge,
 * whose tips are both drawn on left edges).
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
  } as unknown as Parameters<typeof ottavaLaneOnsets>[0]
}

/** A bracket, as much of one as the lane reads: its staff. */
const bracket = (over: { staffId?: string } = {}) =>
  ({ id: 'O1', shift: 1, beat: { num: 0, den: 1 }, length: { num: 1, den: 1 }, ...over }) as never

const at = (measure: number, beat: number) => ({ measure, beat: { num: beat, den: 1 } })

describe('ottavaLaneOnsets', () => {
  it('answers each onset with BOTH edges — the pair the bracket is drawn against', () => {
    const engine = laneEngine([
      { id: 'n1', left: 100, y: 50, measure: 1, beat: 0 },
      { id: 'n2', left: 200, y: 50, measure: 1, beat: 1 },
    ])
    expect(ottavaLaneOnsets(engine, bracket()).map(o => [o.left, o.right]))
      .toEqual([[100, 112], [200, 212]])
  })

  it('⭐⭐ the lane is the STAFF, every voice — an octave line has none of its own', () => {
    // ⛔ No voice filter, `ottavaOps.resizeOttavaBySlot`'s rule: stepping through one voice's onsets
    // would walk PAST a note in the other that the bracket then silently displaces.
    const engine = laneEngine([
      { id: 'mine', left: 180, y: 50, measure: 1, beat: 0, voice: 0 },
      { id: 'theirs', left: 174, y: 50, measure: 1, beat: 2, voice: 1 },
    ])
    expect(ottavaEdgeX(engine, bracket(), at(1, 2), 'start')).toBe(174)
  })

  it('…but only its OWN staff', () => {
    const engine = laneEngine([
      { id: 'mine', left: 180, y: 50, measure: 1, beat: 0, staff: 1 },
      { id: 'other', left: 174, y: 50, measure: 1, beat: 2, staff: 0 },
    ])
    expect(ottavaLaneOnsets(engine, bracket({ staffId: 's1' })).map(o => o.left)).toEqual([180])
  })

  it('a CHORD is ONE onset — leftmost head, rightmost ink', () => {
    const engine = laneEngine([
      { id: 'low', left: 200, y: 50, measure: 1, beat: 1 },
      { id: 'high', left: 208, y: 40, measure: 1, beat: 1 },
    ])
    const lane = ottavaLaneOnsets(engine, bracket())
    expect(lane).toHaveLength(1)
    expect(lane[0].left, 'where the numeral would stand').toBe(200)
    expect(lane[0].right, 'and where the hook would close').toBe(220)
  })

  it('⭐⭐ the two ends read DIFFERENT edges of the same onset', () => {
    const engine = laneEngine([{ id: 'n1', left: 100, y: 50, measure: 1, beat: 0, width: 12 }])
    expect(ottavaEdgeX(engine, bracket(), at(1, 0), 'start')).toBe(100)
    expect(ottavaEdgeX(engine, bracket(), at(1, 0), 'end')).toBe(112)
  })

  it('answers null for a slot the last render drew nothing at — ⛔ never a guess', () => {
    const engine = laneEngine([{ id: 'n1', left: 100, y: 50, measure: 1, beat: 0 }])
    expect(ottavaEdgeX(engine, bracket(), at(4, 0), 'start')).toBeNull()
  })
})

describe('ottavaStaffSpacePx', () => {
  /** A registry holding one drawn fragment of the bracket, plus the staff it was drawn on. */
  const registryWith = (piece?: Partial<ElementInfo>, lineSpacing = 10) => {
    const registry = new ElementRegistry()
    if (piece) {
      registry.add({
        type: 'ottava', id: 'O1', staff: 0, measure: 1,
        bbox: { x: 100, y: 20, width: 200, height: 10 }, ...piece,
      } as ElementInfo)
    }
    registry.setStaffGeometry({
      measure: 1, staff: 0, lineSpacing, lineYPositions: [40, 50, 60, 70, 80],
      noteStartX: 90, noteEndX: 430, clef: 'treble',
    })
    return registry
  }

  it('⛔ never a constant — it reads the staff the bracket was DRAWN on', () => {
    expect(ottavaStaffSpacePx(registryWith({}, 7.5), 'O1')).toBe(7.5)
  })

  it('answers null when the bracket drew nothing', () => {
    expect(ottavaStaffSpacePx(registryWith(), 'O1')).toBeNull()
  })

  it('answers null when the fragment names no measure — the honest "cannot say"', () => {
    expect(ottavaStaffSpacePx(registryWith({ measure: undefined }), 'O1')).toBeNull()
  })
})

describe('ottavaStartAddress', () => {
  const score = {
    measures: [
      { id: 'm1', number: 1, slots: [], tuplets: [], timeSignature: { numerator: 4, denominator: 4 } },
      {
        id: 'm2', number: 2, slots: [], tuplets: [], timeSignature: { numerator: 4, denominator: 4 },
        ottavas: [{ id: 'O1', shift: 1, beat: { num: 2, den: 1 }, length: { num: 1, den: 1 } }],
      },
    ],
  } as unknown as Score

  it('⭐ names the MEASURE as well as the beat — the bracket object carries only half the address', () => {
    expect(ottavaStartAddress(score, 'O1')).toEqual({ measure: 2, beat: { num: 2, den: 1 } })
  })

  it('answers null for an id no longer in the score', () => {
    expect(ottavaStartAddress(score, 'gone')).toBeNull()
  })
})
