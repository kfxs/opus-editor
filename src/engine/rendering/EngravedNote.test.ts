// @vitest-environment jsdom
/**
 * ⭐⭐ **THE NOTE STILL ANSWERS WHAT IT STOPPED PAINTING** — the standing rule of the `Engraved*`
 * family (`docs/plans/own-engraving-engine.md` P3), and the one it broke.
 *
 * 🚨 **His report, 2026-09-14**: a slur over five sixteenths *"completely crazy"* — measured in
 * Chromium at `M180 65 C198 −313.7, 234 −261.7, 252 45`, an arch 380 px above a 72 px span. The
 * slur's obstacle solver was right; what it was given was not. One of the five notes reported a
 * bounding box of `{x: 0, y: −33, w: 258, h: 122}` — the whole system, starting at the ORIGIN — and
 * the solver dutifully lifted the arch 361 px to clear it.
 *
 * ⭐ **The cause was a missing WRITE-BACK.** VexFlow positions a flag as a side effect of painting
 * it (`drawFlag` = `setX(...).setY(...).drawWithStyle()`), and `StaveNote.getBoundingBox()` merges
 * `this.flag.getBoundingBox()` whenever `hasFlag()`. P3b took the ink and left the flag at (0, 0),
 * so an `Element`'s `(x + xShift, y + yShift − ascent, …)` put a box at the origin into every
 * unbeamed flagged note's own.
 *
 * ⚠️ **This is checkable in jsdom precisely because the fault is not about ink.** The flag's box has
 * no measurable size here — but `mergeWith` merges the POINT, and a box merged with (0, 0) has
 * `x === 0` whatever the font does. ⭐ *"jsdom cannot measure glyphs"* is about extents, and this is
 * about an origin.
 */
import { describe, it, expect } from 'vitest'
import { SvgPainter } from './SvgPainter'
import { EngravedStave } from './EngravedStave'
import { BarVoice, drawBarVoice } from './barVoice'
import { attachModifierColumns } from './modifierColumns'
import { formatColumns } from './columnFormat'
import { EngravedNote } from './EngravedNote'
import { noteRuler } from './noteRuler'
import { requireNoteFrame } from './staveFrame'
import { noteLineY } from '@/engine/engrave/staff/staffFrame'

/** One bar of `durations`, drawn through the real pipeline — a flag only exists after a draw. */
function drawnNotes(durations: string[], keys = ['c/5']): EngravedNote[] {
  const div = document.createElement('div')
  document.body.appendChild(div)
  const context = new SvgPainter(div).resize(500, 200)
  const stave = new EngravedStave(10, 40, 400)
  stave.setContext(context).draw()
  const notes = durations.map(duration => new EngravedNote({ keys, duration }))
  // ⭐ The score's own pipeline (S9–S12): our voice, columns and formatter — not VexFlow's.
  const voice = new BarVoice({ numerator: durations.length, denominator: 4 }, 'soft').addAll(notes)
  attachModifierColumns([voice])
  formatColumns([voice], 300)
  drawBarVoice(voice, context, stave)
  return notes
}

/** VexFlow's `ModifierPosition` numbers — the vocabulary a modifier asks the note in. */
const ABOVE = 3
const BELOW = 4

describe('⭐ S5a — where the note offers its modifiers a place to stand is OURS', () => {
  it('a mark above or below follows the note’s hand offset, on both sides', () => {
    const [note] = drawnNotes(['q'], ['c/4'])
    const above = note.getModifierStartXY(ABOVE, 0).x
    const below = note.getModifierStartXY(BELOW, 0).x
    note.setMarkAnchor({ offsetPx: 7, stemAlign: false })
    expect(note.getModifierStartXY(ABOVE, 0).x).toBe(above + 7)
    expect(note.getModifierStartXY(BELOW, 0).x).toBe(below + 7)
  })

  it('stem alignment puts only the STEM-side mark on the stem', () => {
    const [note] = drawnNotes(['q'], ['c/4'])
    const below = note.getModifierStartXY(BELOW, 0).x
    note.setMarkAnchor({ offsetPx: 7, stemAlign: true })
    expect(noteRuler(note).stemDirection, 'c/4 stands stem UP, so ABOVE is its stem side').toBe(1)
    expect(note.getModifierStartXY(ABOVE, 0).x).toBe(noteRuler(note).stemX)
    expect(note.getModifierStartXY(BELOW, 0).x, 'the head side follows the offset').toBe(below + 7)
  })

  it('⛔ no anchor, no change — and the guard VexFlow kept still throws on an unformatted note', () => {
    const [note] = drawnNotes(['q'], ['c/4'])
    const before = note.getModifierStartXY(ABOVE, 0)
    note.setMarkAnchor(undefined)
    expect(note.getModifierStartXY(ABOVE, 0)).toEqual(before)
    expect(() => new EngravedNote({ keys: ['c/4'], duration: 'q' }).getModifierStartXY(ABOVE, 0)).toThrow()
  })
})

describe('⭐ S6c — each head’s y is the staff frame’s', () => {
  it('a C4 + E4 chord in treble stands on note lines 0 and 1 of its own frame, in key order', () => {
    const [chord] = drawnNotes(['q'], ['c/4', 'e/4'])
    const frame = requireNoteFrame(chord)
    expect(chord.getYs()).toEqual([noteLineY(frame, 0), noteLineY(frame, 1)])
  })

  it('a fresh array each ask — no reader can change what the next one sees', () => {
    const [note] = drawnNotes(['q'], ['g/4'])
    const first = note.getYs()
    first[0] = -1
    expect(note.getYs()[0]).not.toBe(-1)
  })
})

describe('the flag’s write-back', () => {
  it('🚨🚨 an unbeamed FLAGGED note’s box does not reach the origin — his 2026-09-14 slur', () => {
    const [eighth] = drawnNotes(['8'])
    const box = eighth.getBoundingBox()
    expect(eighth.hasFlag(), 'the case at issue — a note that consults its flag').toBe(true)
    expect(box.getX(), 'the note’s own x, ⛔ not 0').toBeGreaterThan(1)
  })

  it('⭐ the flag knows where it was drawn — the field VexFlow’s own draw writes', () => {
    const [eighth] = drawnNotes(['8'])
    // ⚠️ Not an equality: the box's left edge is the leftmost of head, stem and flag, and a
    // down-stem flag stands half a stem width left of the head's own x. Measured at 1.5 px; the
    // claim is that the box hugs the NOTE, which is what a merge with the origin destroys.
    expect(Math.abs(eighth.getBoundingBox().getX() - eighth.getAbsoluteX())).toBeLessThan(5)
  })

  it('⭐⭐ the box stays around the NOTE — a width of a whole system is the bug’s signature', () => {
    const [eighth] = drawnNotes(['8'])
    const box = eighth.getBoundingBox()
    // A single note is a couple of staff spaces wide; the broken box was 258 px on his score.
    expect(box.getW()).toBeLessThan(40)
  })

  it('⭐ every flagged duration, both stem directions — ⛔ not just the eighth', () => {
    for (const duration of ['8', '16', '32']) {
      for (const keys of [['c/5'], ['c/4']]) {
        const [note] = drawnNotes([duration], keys)
        expect(note.getBoundingBox().getX(), `${duration} ${keys[0]}`).toBeGreaterThan(1)
      }
    }
  })

  it('🚨 the break-test — a BEAMED note never had the fault, because `hasFlag()` is false', () => {
    // ⭐ `hasFlag()` is `codeFlagUp !== undefined && !this.beam`, so a beamed note's box never
    //   consults the flag at all. This is why his bar of five sixteenths broke on the FIFTH: four
    //   were beamed into a beat and the last stood alone.
    const notes = drawnNotes(['16', '16'])
    expect(notes[0].hasFlag(), 'unbeamed here — the fixture builds no beam').toBe(true)
    // …and with a beam attached the note stops asking.
    notes[0].setBeam({ postFormat: () => undefined } as never)
    expect(notes[0].hasFlag()).toBe(false)
  })

  it('⭐ a WHOLE note has no flag to write back, and still answers', () => {
    const [whole] = drawnNotes(['w'])
    expect(whole.hasFlag()).toBe(false)
    expect(whole.getBoundingBox().getX()).toBeGreaterThan(1)
  })
})
