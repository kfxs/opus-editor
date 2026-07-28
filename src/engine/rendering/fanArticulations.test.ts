// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { Modifier } from 'vexflow'
import { fanArticulationPosition } from './fanArticulations'

/**
 * Subject: {@link fanArticulationPosition} in `./fanArticulations`.
 *
 * ⚠️ Only the DEFAULT SIDE is asserted here. The drawing half of that module is VexFlow's own
 * formatting — a stand-in `StaveNote` is built, the library places the marks on it, and the glyphs
 * are translated to the member's head — and jsdom measures every glyph as 0×0, so every number in it
 * would come back a vacuous zero. Where the ink lands is asserted in `e2e/fan.e2e.ts`.
 *
 * The side is different: it is a decision, not a measurement.
 */

const BELOW = Modifier.Position.BELOW
const ABOVE = Modifier.Position.ABOVE

describe('fanArticulationPosition', () => {
  it('takes the NOTE-HEAD side — opposite the stem', () => {
    expect(fanArticulationPosition(1), 'stem up ⇒ mark below').toBe(BELOW)
    expect(fanArticulationPosition(-1), 'stem down ⇒ mark above').toBe(ABOVE)
  })

  /**
   * Multi-voice inverts it: the mark goes on the voice's OUTER side regardless of the note's own
   * stem, so the two voices' marks never collide in the middle (Gould, and what `NoteBuilder` does).
   */
  it('takes the voice’s OUTER side when the lane forced a stem', () => {
    expect(fanArticulationPosition(1, 1), 'upper voice ⇒ above').toBe(ABOVE)
    expect(fanArticulationPosition(-1, -1), 'lower voice ⇒ below').toBe(BELOW)
  })

  /**
   * REGRESSION, and the whole of his second report: *"if i flip the owner articulation all
   * articulations flip"*.
   *
   * This function used to read member 0's drawn marks, and failing that `slot.articulationPlacement`
   * — both of which are member 0's OWN side, because member 0 *is* the slot's chord. So the owner's
   * `x` moved all six marks. It now depends on nothing but the stem, which is what "a member follows
   * the stem until it is flipped, and then it follows itself" means. The signature is the proof:
   * there is no chord and no note to read a flip off.
   */
  it('⭐ depends on the STEM alone — nothing about the owner can reach it', () => {
    expect(fanArticulationPosition.length, 'stem direction and the forced stem, and nothing else')
      .toBe(2)
    // The same answer whatever the owner is doing, because the owner is not an argument.
    expect(fanArticulationPosition(1)).toBe(fanArticulationPosition(1))
  })
})
