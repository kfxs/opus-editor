/**
 * ⭐ **A CUE note's TUPLET number and TREMOLO strokes** (docs/plans/cue-size-plan.md C5, P2) — both still
 * drawn straight on the painter, outside the scene (`CLAUDE.md`), so they are read off the page: the font
 * size each glyph was stamped at.
 */
import { test, expect } from './fixtures'

/** The computed font size (px) of every stamped glyph whose first character is `code`. */
function fontSizesOf(code: number): number[] {
  return [...document.querySelectorAll('text')]
    .filter(t => (t.textContent ?? '').codePointAt(0) === code)
    .map(t => parseFloat(getComputedStyle(t).fontSize))
}

test('⭐ a tremolo on a cue note: its strokes at ¾', async ({ score }) => {
  const sizes = await score.evaluate(async (fn) => {
    const h = window.__h
    const sizesOf = new Function(`return (${fn})`)() as (code: number) => number[]
    const full = h.engine.addNoteAtBeat({ step: 'C', alter: 0, octave: 5, duration: 'q', measure: 1, beat: h.frac(0, 1) })!
    const cue = h.engine.addNoteAtBeat({ step: 'C', alter: 0, octave: 5, duration: 'q', measure: 1, beat: h.frac(1, 1) })!
    h.engine.setTremolo(full.id, 1)
    h.engine.setTremolo(cue.id, 1)
    h.engine.cue.set([cue.id], true)
    await h.render()
    return sizesOf(0xe220)
  }, fontSizesOf.toString())
  expect(sizes).toHaveLength(2)
  expect(sizes[1] / sizes[0]).toBeCloseTo(0.75, 2)
})

test('⭐ a tuplet over ALL-cue notes: its number at ¾ — ⛔ over a mixed group, full', async ({ score }) => {
  const sizes = await score.evaluate(async (fn) => {
    const h = window.__h
    const sizesOf = new Function(`return (${fn})`)() as (code: number) => number[]
    h.engine.addMeasure()
    const a = h.engine.createTupletAtBeat(1, 0, '8', { step: 'C', alter: 0, octave: 5 })!
    const b = h.engine.createTupletAtBeat(2, 0, '8', { step: 'C', alter: 0, octave: 5 })!
    // Bar 2's triplet is MIXED: a cue first note, and a full note beside it.
    h.engine.addNoteAtBeat({ step: 'D', alter: 0, octave: 5, duration: '8', measure: 2, beat: h.frac(1, 3), tupletId: b.tuplet.id, actualDuration: h.frac(1, 3) })
    h.engine.cue.set([a.firstNote.id, b.firstNote.id], true)
    await h.render()
    // The number '3' — SMuFL tuplet digit 3 (U+E883).
    return sizesOf(0xe883)
  }, fontSizesOf.toString())
  expect(sizes).toHaveLength(2)
  expect(sizes[1], 'the mixed group is full').toBeCloseTo(sizes[0] / 0.75, 1)
})
