/**
 * Where an articulation stands on its note (S12f — `Articulation.draw`'s placement, transcribed).
 * ⚠️ Exactness against VexFlow was proved on the page: 50 random scores (1,889 marks, 1,721 hit boxes)
 * byte-identical against the previous commit, and 150 note ghosts wearing marks identical in
 * Chromium (`docs/history/vexflow-removal-map.md` S12f). Pinned here is the rule.
 *
 * A treble staff with its top line at y = 80, a space of 10: line 5 (F5) at 80, line 1 (E4) at 120.
 */
import { describe, it, expect } from 'vitest'
import { placeArticulation, type ArticulationPlacementInput } from './articulationPlacement'

const lineY = (line: number) => 80 + (5 - line) * 10
/** A stemless note on `line` (a whole note), a mark above it on text line 0. */
const whole = (line: number, over: Partial<ArticulationPlacementInput> = {}): ArticulationPlacementInput => ({
  side: 'above', textLine: 0, canSitBetweenLines: true, staffSpace: 10,
  hasStem: false, stemDirection: 1, stemTipY: 0, stemBaseY: 0,
  headYs: [lineY(line)], headY: lineY(line), headLine: line,
  outsideStaffY: 75, // half a space above the top line
  ...over,
})

describe('placeArticulation', () => {
  it('⭐ a mark inside the staff snaps into a SPACE and is centred there', () => {
    // A head on line 2 (G4): one space above is line 3, a LINE — so it moves on to the space above it.
    const { y, centred } = placeArticulation(whole(2))
    expect(y).toBe(lineY(3.5))
    expect(centred).toBe(true)
  })

  it('a mark already in a space stays there', () => {
    // A head in the space 1.5 (F4): one space above is 2.5, a space.
    expect(placeArticulation(whole(1.5)).y).toBe(lineY(2.5))
  })

  it('outside the staff it snaps to the nearest half-line and is NOT centred', () => {
    const { y, centred } = placeArticulation(whole(6))
    expect(y).toBe(lineY(7))
    expect(centred).toBe(false)
  })

  it('⭐ at a stem\'s TIP it starts half a space out, past the head one space', () => {
    // Stem up, tip at line 6.5 (y 65): half a space past it is line 7 — outside, so no snap to a space.
    const tip = placeArticulation(whole(3, { hasStem: true, stemDirection: 1, stemTipY: 65, stemBaseY: lineY(3) }))
    expect(tip.y).toBe(lineY(7))
    // The same note, mark BELOW: past the head (the stem base) by a full space.
    const head = placeArticulation(whole(3, { side: 'below', hasStem: true, stemDirection: 1, stemTipY: 65, stemBaseY: lineY(3), outsideStaffY: 125 }))
    expect(head.y).toBe(lineY(1.5)) // line 2 is a line → into the space below it
  })

  it('a text line pushes it out a space per line', () => {
    expect(placeArticulation(whole(6, { textLine: 1 })).y).toBe(lineY(8))
  })

  it('⛔ a mark that may NOT sit between the lines is held half a space outside the staff', () => {
    const { y, centred } = placeArticulation(whole(2, { canSitBetweenLines: false }))
    expect(y).toBe(75)
    expect(centred).toBe(false)
  })
})
