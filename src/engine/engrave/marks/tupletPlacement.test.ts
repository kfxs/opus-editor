import { describe, it, expect } from 'vitest'
import { tupletMarkY, TUPLET_AIR, TUPLET_NESTING_STEP, type TupletNoteReach, type TupletPlacement } from './tupletPlacement'
import type { StaffFrame } from '../staff/staffFrame'

/**
 * ⚠️ The agreement with VexFlow was proved by a throwaway probe (S8: ~520 placements across both
 * sides, both stem directions, four durations, two clefs, three staff positions, chords, rests,
 * whole notes, unbracketed groups and stacked articulations — every answer identical to
 * `Tuplet.prototype.getYPosition` run against the same object). 🚨 Its coverage counters were checked
 * non-zero first: the ABOVE modifier-text branch fired on 108 notes, and the BELOW line check had to
 * have its state set by hand because nothing in this editor reaches it (`state.textLine` is written
 * only by a BOTTOM `Annotation`, and jsdom's zero metrics keep it at 0).
 */
const SPACE = 10
const frame: StaffFrame = { topLineY: 100, spacePx: SPACE, lineCount: 5 }

const note = (over: Partial<TupletNoteReach> = {}): TupletNoteReach => ({
  reaches: true, stemDirection: 1, stemTipY: 60, stemBaseY: 130, textLines: 0, textTopY: 0, ...over,
})

const place = (over: Partial<TupletPlacement> = {}): TupletPlacement => ({
  side: 1, frame, notes: [note()], nestedDepth: 0, yOffset: 0, lowestTextLine: 4, ...over,
})

describe('tupletMarkY — above', () => {
  it('clears the staff’s top line when nothing reaches higher', () => {
    const low = note({ stemTipY: 200, stemBaseY: 260 })
    expect(tupletMarkY(place({ notes: [low] }))).toBe(100 - TUPLET_AIR.staffAbove * SPACE)
  })

  it('is pushed up by a stem TIP, with less air than a notehead gets', () => {
    expect(tupletMarkY(place({ notes: [note({ stemTipY: 40 })] })))
      .toBe(40 - TUPLET_AIR.stemTip * SPACE)
    // …and a stem pointing DOWN offers its top NOTEHEAD instead, which keeps more air.
    expect(tupletMarkY(place({ notes: [note({ stemDirection: -1, stemBaseY: 40 })] })))
      .toBe(40 - TUPLET_AIR.notehead * SPACE)
  })

  it('⭐ takes the note that reaches FURTHEST, and is unmoved by the rest', () => {
    const notes = [note({ stemTipY: 80 }), note({ stemTipY: 20 }), note({ stemTipY: 75 })]
    expect(tupletMarkY(place({ notes }))).toBe(20 - TUPLET_AIR.stemTip * SPACE)
    // ⛔ a MAXIMUM, not a sum — adding more notes no higher than the highest changes nothing.
    expect(tupletMarkY(place({ notes: [...notes, note({ stemTipY: 79 })] })))
      .toBe(tupletMarkY(place({ notes })))
  })

  it('clears text already stacked over a note', () => {
    const withText = note({ stemTipY: 90, textLines: 2, textTopY: 30 })
    expect(tupletMarkY(place({ notes: [withText] }))).toBe(30 - TUPLET_AIR.modifierText * SPACE)
  })

  it('⛔ ignores a note’s text row when the note does not reach at all', () => {
    const silent = note({ reaches: false, textLines: 3, textTopY: -500 })
    expect(tupletMarkY(place({ notes: [silent] }))).toBe(100 - TUPLET_AIR.staffAbove * SPACE)
  })
})

describe('tupletMarkY — below', () => {
  const below = (over: Partial<TupletPlacement> = {}) => place({ side: -1, ...over })

  it('starts clear of the bottom staff line', () => {
    const high = note({ stemDirection: -1, stemTipY: 0, stemBaseY: 0 })
    expect(tupletMarkY(below({ notes: [high] })))
      .toBe(100 + 4 * SPACE + TUPLET_AIR.staffBelow * SPACE)
  })

  it('⚠️ keeps MORE air from the staff than the above side does — VexFlow’s own asymmetry', () => {
    expect(TUPLET_AIR.staffBelow).not.toBe(TUPLET_AIR.staffAbove)
  })

  it('starts lower when text has claimed a line below the staff', () => {
    const high = note({ stemDirection: -1, stemTipY: 0, stemBaseY: 0 })
    expect(tupletMarkY(below({ notes: [high], lowestTextLine: 7 })))
      .toBe(100 + 7 * SPACE + TUPLET_AIR.staffBelow * SPACE)
  })

  it('is pushed down by a stem tip or a notehead, by the same two airs', () => {
    expect(tupletMarkY(below({ notes: [note({ stemDirection: -1, stemTipY: 300 })] })))
      .toBe(300 + TUPLET_AIR.stemTip * SPACE)
    expect(tupletMarkY(below({ notes: [note({ stemDirection: 1, stemBaseY: 300 })] })))
      .toBe(300 + TUPLET_AIR.notehead * SPACE)
  })

  it('⛔ does NOT read a note’s own text row — that side takes a line number instead', () => {
    const shouted = note({ stemDirection: -1, stemTipY: 0, stemBaseY: 0, textLines: 9, textTopY: 9999 })
    expect(tupletMarkY(below({ notes: [shouted] })))
      .toBe(tupletMarkY(below({ notes: [note({ stemDirection: -1, stemTipY: 0, stemBaseY: 0 })] })))
  })
})

describe('tupletMarkY — nesting and the hand', () => {
  it('steps a nested tuplet OUTWARD, on either side', () => {
    const flat = tupletMarkY(place())
    expect(tupletMarkY(place({ nestedDepth: 1 }))).toBe(flat - TUPLET_NESTING_STEP * SPACE)
    const flatBelow = tupletMarkY(place({ side: -1 }))
    expect(tupletMarkY(place({ side: -1, nestedDepth: 1 }))).toBe(flatBelow + TUPLET_NESTING_STEP * SPACE)
  })

  it('stacks by depth', () => {
    const step = TUPLET_NESTING_STEP * SPACE
    expect(tupletMarkY(place({ nestedDepth: 3 }))).toBe(tupletMarkY(place()) - 3 * step)
  })

  it('adds the hand’s own offset last, unsigned by the side', () => {
    expect(tupletMarkY(place({ yOffset: 7 }))).toBe(tupletMarkY(place()) + 7)
    expect(tupletMarkY(place({ side: -1, yOffset: 7 }))).toBe(tupletMarkY(place({ side: -1 })) + 7)
  })

  it('scales with the staff — every air is in spaces, not pixels', () => {
    const small: StaffFrame = { topLineY: 100, spacePx: 6, lineCount: 5 }
    const low = note({ stemTipY: 500, stemBaseY: 560 })
    expect(tupletMarkY(place({ frame: small, notes: [low] })))
      .toBe(100 - TUPLET_AIR.staffAbove * 6)
  })
})
