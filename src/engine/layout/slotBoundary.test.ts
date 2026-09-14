/**
 * ⭐ **A SLOT BEGINS WHERE ITS INK BEGINS — asked of the parts, ⛔ not of the note's union box.**
 *
 * Every note fixture below carries a deliberately WRONG `bbox.x` (0): the old ruler read it, the new
 * one must not. The accidental case is built so a head-only edge would give the other answer — the
 * sharp is part of its slot, which is the rule `588b817` shipped.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { ElementRegistry, type ElementInfo, type StaffGeometry } from '@/engine/ElementRegistry'
import { noteheadInk } from '@/engine/fonts/fontMetrics'
import { nearestSlotBoundaryBeat } from './slotBoundary'

const geometry: StaffGeometry = {
  measure: 1, staff: 0, lineYPositions: [40, 50, 60, 70, 80], lineSpacing: 10,
  noteStartX: 20, noteEndX: 400, clef: 'treble',
}

/** Half a quarter-note head at this staff's size, in px. */
const HALF_HEAD = (noteheadInk('q') * geometry.lineSpacing) / 2

const WRONG_BOX = { x: 0, y: 40, width: 1, height: 1 }

const note = (id: string, beat: number, headX: number): ElementInfo => ({
  type: 'note', id, measure: 1, staff: 0, beat, pitch: 67, duration: 'q', headX, bbox: WRONG_BOX,
})

describe('nearestSlotBoundaryBeat', () => {
  let registry: ElementRegistry

  beforeEach(() => {
    registry = new ElementRegistry()
    registry.setStaffGeometry(geometry)
  })

  it('⭐ a note’s slot begins at its head’s left edge — from `headX` and the font, ⛔ not the box', () => {
    registry.add(note('a', 0, 50))
    registry.add(note('b', 1, 110))
    // Head lefts: 50 − HALF_HEAD ≈ 44.1 and 110 − HALF_HEAD ≈ 104.1. A click at 70 is nearer A's.
    expect(nearestSlotBoundaryBeat(registry, 70, 1)).toBe(0)
    expect(nearestSlotBoundaryBeat(registry, 110 - HALF_HEAD + 1, 1)).toBe(1)
  })

  it('🚨 an accidental is PART of its slot — the sharp moves the boundary left', () => {
    registry.add(note('a', 0, 50))
    registry.add(note('b', 1, 110))
    // x = 63: A's head edge is ≈18.9 away; B's head edge ≈41.1 — but B's sharp starts at 80, 17 away.
    expect(nearestSlotBoundaryBeat(registry, 63, 1), 'head-only edges would pick beat 0').toBe(0)
    registry.add({
      type: 'accidental', noteId: 'b', measure: 1, staff: 0, beat: 1, pitch: 67, accidentalType: '#',
      bbox: { x: 80, y: 45, width: 10, height: 28 },
    })
    expect(nearestSlotBoundaryBeat(registry, 63, 1)).toBe(1)
  })

  it('a rest’s slot begins at its own glyph box', () => {
    registry.add({ type: 'rest', id: 'r', measure: 1, staff: 0, beat: 2, bbox: { x: 200, y: 50, width: 10, height: 20 } })
    registry.add(note('a', 0, 50))
    expect(nearestSlotBoundaryBeat(registry, 190, 1)).toBe(2)
  })

  it('a note with no head position falls back to its box — the ruler that shipped until now', () => {
    const { headX: _, ...headless } = note('ghost', 3, 0)
    registry.add({ ...headless, bbox: { x: 300, y: 40, width: 20, height: 30 } })
    expect(nearestSlotBoundaryBeat(registry, 298, 1)).toBe(3)
  })

  it('an empty bar has no slot to name', () => {
    expect(nearestSlotBoundaryBeat(registry, 100, 1)).toBeNull()
  })
})
