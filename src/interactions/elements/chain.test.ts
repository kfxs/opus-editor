/**
 * The two tables in {@link chain} — what they say about the fourteen selectable kinds.
 *
 * These are not decorative assertions. {@link ELEMENT_HIT_ORDER} is an ARRAY whose ORDER IS THE
 * CONTENT: it decides who wins a press two glyphs both cover, and that order was argued for one pair
 * at a time (the dot before the note, the tremolo before the stem, the barline last of all). Nothing
 * in the type system pins it — a reorder compiles and quietly makes the stem unclickable on a
 * tremolo'd note. So the order is written down twice, here and there, and this file is what makes a
 * change to it deliberate.
 */
import { describe, it, expect } from 'vitest'
import { ELEMENT_HIT_ORDER, ELEMENT_SPECS } from './chain'
import type { SelectedElement } from '../EditorState'

/** Every kind in the union, as `SelectedElement['kind']` — the list `assertNeverElement` polices. */
const ALL_KINDS: SelectedElement['kind'][] = [
  'clef', 'timeSignature', 'tempo', 'dynamic', 'tie', 'slur', 'hairpin', 'accidental',
  'articulation', 'dot', 'tremolo', 'stem', 'barline', 'tuplet', 'measureRange',
]

describe('ELEMENT_SPECS — total over the union', () => {
  it('answers for all fifteen kinds, and nothing else', () => {
    expect(Object.keys(ELEMENT_SPECS).sort()).toEqual([...ALL_KINDS].sort())
  })

  it('every spec agrees with the key it is filed under', () => {
    // The `kind` field is a copy of the key — this is what stops the copy drifting.
    for (const key of ALL_KINDS) expect(ELEMENT_SPECS[key].kind).toBe(key)
  })

  it('every kind says how it paints — a sixteenth cannot be added without deciding', () => {
    for (const key of ALL_KINDS) expect(typeof ELEMENT_SPECS[key].highlight).toBe('function')
  })
})

describe('ELEMENT_HIT_ORDER — the priority chain', () => {
  it('⭐ is exactly this order, and the order is the argument', () => {
    expect(ELEMENT_HIT_ORDER.map(e => e.kind)).toEqual([
      // The big glyphs in their own columns first — nothing competes for those pixels.
      'clef', 'timeSignature',
      // Then the marks above and below the staff, each guarded against stealing a note press.
      'tempo', 'dynamic',
      // Then the curves, then the sub-elements hanging off a notehead.
      // The hairpin sits with the slur: both are spanners hit by proximity to their own ink, and
      // where they overlap the thinner, closer-to-the-notes ARC wins.
      'tie', 'slur', 'hairpin', 'accidental', 'articulation',
      // Dots after the other sub-elements: they sit right beside the head.
      'dot',
      // The tremolo immediately before the stem it is drawn ON, so it wins only inside its own ink.
      'tremolo', 'stem',
      // The barline last: its pad reaches into the bar's last column.
      'barline',
    ])
  })

  it('the two PRE-STEP kinds are deliberately absent from it', () => {
    // A tuplet bracket press and a Ctrl+Shift measure box run BEFORE the selection is cleared —
    // they are gestures, not glyphs in the chain. They are still in ELEMENT_SPECS, for the paint.
    const inChain = ELEMENT_HIT_ORDER.map(e => e.kind)
    expect(inChain).not.toContain('tuplet')
    expect(inChain).not.toContain('measureRange')
    expect(ELEMENT_SPECS.tuplet.hit).toBeUndefined()
    expect(ELEMENT_SPECS.measureRange.hit).toBeUndefined()
  })

  it('every entry is the same object the specs table holds — one source per kind', () => {
    for (const entry of ELEMENT_HIT_ORDER) expect(ELEMENT_SPECS[entry.kind]).toBe(entry)
  })

  it('and every other kind has a hit-test', () => {
    const inChain = new Set(ELEMENT_HIT_ORDER.map(e => e.kind))
    for (const key of ALL_KINDS) {
      if (key === 'tuplet' || key === 'measureRange') continue
      expect(inChain.has(key), `${key} is in the chain`).toBe(true)
      expect(typeof ELEMENT_SPECS[key].hit).toBe('function')
    }
  })
})
