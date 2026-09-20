/**
 * ⭐ **NOTE ENTRY MEASURES FROM THE HEAD, ⛔ NOT FROM THE BOX** — the first reader moved off the note's
 * union rectangle (`docs/plans/own-engraving-engine.md` §5 P6).
 *
 * A note's registry `bbox` is VexFlow's union of every modifier, so a left-hanging accidental drags
 * its centre a few pixels LEFT of the head the user is looking at. Clicking and `pixelXToBeat`
 * already measured from `headX`; the entry lookups still measured from the box. ⇒ every fixture
 * below has a sharp hanging left, and each case is built so the box centre and the head disagree
 * about the answer — the break-test is the fixture itself.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { ElementRegistry, headCentreX, type ElementInfo } from './ElementRegistry'

/** A note at beat 0 carrying a sharp: box 80..120 (centre 100), head centred at 110. */
const sharpNote: ElementInfo = {
  type: 'note', id: 'sharp', measure: 1, staff: 0, beat: 0, pitch: 67,
  bbox: { x: 80, y: 40, width: 40, height: 30 },
  headX: 110,
}

/** A rest at beat 1, whose box IS its own glyph (`addGlyph`) and which has no `headX`. */
const rest: ElementInfo = {
  type: 'rest', id: 'rest', measure: 1, staff: 0, beat: 1,
  bbox: { x: 120, y: 45, width: 10, height: 20 },
}

describe('headCentreX', () => {
  it('⭐ a note with a head answers the HEAD — ⛔ not the box widened by its sharp', () => {
    expect(headCentreX(sharpNote)).toBe(110)
  })

  it('a rest — no head — answers its own box’s centre', () => {
    expect(headCentreX(rest)).toBe(125)
  })

  it('a note registered without a head (a ghost’s plain `StaveNote`) falls back to the box', () => {
    const { headX: _, ...headless } = sharpNote
    expect(headCentreX(headless)).toBe(100)
  })
})

describe('the note-entry lookups', () => {
  let registry: ElementRegistry

  beforeEach(() => {
    registry = new ElementRegistry()
    registry.add(sharpNote)
    registry.add(rest)
  })

  it('🚨 findNotesLeftRight — a click between the box centre and the head is LEFT of the note', () => {
    // x = 105: the box centre (100) says the note is to the LEFT; the head (110) is to the right.
    const { nearestRight, rightDistance } = registry.findNotesLeftRight(105, 1, 0)
    expect(nearestRight?.id).toBe('sharp')
    expect(rightDistance).toBe(5)
  })

  it('🚨 findNearestNoteOrRest — the sharp does not push its note away from a click on its head', () => {
    // x = 116: box centre 100 is 16 away, the rest 9 — the REST would win. The head is 6 away.
    expect(registry.findNearestNoteOrRest(116, 1, 0)?.id).toBe('sharp')
  })

  it('findNotesNearX measures the same distance', () => {
    const near = registry.findNotesNearX(116, 1, 8)
    expect(near.map(el => el.id)).toEqual(['sharp'])
  })

  it('findClosestNote measures the same distance', () => {
    // Tolerance 8 around x = 116: the head (6 away) is inside it, the box centre (16 away) is not.
    expect(registry.findClosestNote(116, 55, 1, 8)?.id).toBe('sharp')
  })
})
