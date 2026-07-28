// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { Articulation, Modifier, StaveNote } from 'vexflow'
import { fanArticulationPosition } from './fanArticulations'
import type { Chord } from '@/types/music'

/**
 * Subject: {@link fanArticulationPosition} in `./fanArticulations`.
 *
 * ⚠️ Only the SIDE is asserted here. The drawing half of that module is VexFlow's own formatting —
 * a stand-in `StaveNote` is built, the library places the marks on it, and the glyphs are translated
 * to the member's head — and jsdom measures every glyph as 0×0, so every number in it would come
 * back a vacuous zero. Where the ink lands is asserted in `e2e/fan.e2e.ts`.
 *
 * The side is different: it is a decision, not a measurement, and getting it wrong prints one
 * gesture's marks above AND below.
 */

const BELOW = Modifier.Position.BELOW
const ABOVE = Modifier.Position.ABOVE

/** Member 0's note, optionally already wearing a mark on a given side. */
function ownerNote(markPosition?: number): StaveNote {
  const note = new StaveNote({ keys: ['c/4'], duration: 'q' })
  if (markPosition !== undefined) {
    note.addModifier(new Articulation('a.').setPosition(markPosition), 0)
  }
  return note
}

const slot = (placement?: 'above' | 'below') =>
  ({ articulationPlacement: placement } as unknown as Chord)

describe('fanArticulationPosition', () => {
  /**
   * The first question, and the one that keeps a fan consistent: `NoteBuilder` already applied the
   * full rule to member 0 (explicit placement, else the voice's outer side in multi-voice, else
   * opposite the stem). Reading it back cannot disagree with it; re-deriving it can.
   */
  it('copies member 0’s side whenever member 0 has a mark to copy', () => {
    // Everything else points the other way — a down-stem, and an explicit "above" — and the side
    // still comes from the note, because that is what is already on the page.
    expect(fanArticulationPosition(ownerNote(BELOW), slot('above'), -1)).toBe(BELOW)
    expect(fanArticulationPosition(ownerNote(ABOVE), slot('below'), 1)).toBe(ABOVE)
  })

  it('falls back to the slot’s explicit placement when member 0 is unmarked', () => {
    expect(fanArticulationPosition(ownerNote(), slot('above'), 1)).toBe(ABOVE)
    expect(fanArticulationPosition(ownerNote(), slot('below'), -1)).toBe(BELOW)
  })

  it('otherwise takes the NOTE-HEAD side — opposite the stem', () => {
    expect(fanArticulationPosition(ownerNote(), slot(), 1), 'stem up ⇒ mark below').toBe(BELOW)
    expect(fanArticulationPosition(ownerNote(), slot(), -1), 'stem down ⇒ mark above').toBe(ABOVE)
  })

  /**
   * Multi-voice inverts it: the mark goes on the voice's OUTER side regardless of the note's own
   * stem, so the two voices' marks never collide in the middle (Gould, and what `NoteBuilder` does).
   */
  it('takes the voice’s OUTER side when the lane forced a stem', () => {
    expect(fanArticulationPosition(ownerNote(), slot(), 1, 1), 'upper voice ⇒ above').toBe(ABOVE)
    expect(fanArticulationPosition(ownerNote(), slot(), -1, -1), 'lower voice ⇒ below').toBe(BELOW)
  })
})
