/**
 * {@link accidentalCutOut} — **a curve may tuck into an accidental's notch** (his report,
 * 2026-08-31: *"the slur here is very ugly, i supose cause the accidental is like an obstacle"*).
 *
 * ⭐ The subject is arithmetic over a box and the FONT's own anchors, so this is a unit test and no
 * glyph is measured here (`reference_jsdom_cannot_measure_glyphs`). What the fix LOOKS like is
 * `e2e/slur.e2e.ts`'s, where the numbers are the drawn ones — and where his two bars are pinned.
 */
import { describe, it, expect } from 'vitest'
import type { Stave } from 'vexflow'
import { accidentalTuckSpaces, curveObstacleBox } from './accidentalCutOut'
import type { BoxedNote } from './noteInkBox'

/** A stave whose spaces are 10 px, which is the engine's own size. */
const stave = { getSpacingBetweenLines: () => 10 } as Stave

/** A note whose box grows with whatever modifiers are still in its array — `noteInkBox`'s own fake,
 *  because the splice is exactly what this module relies on. The head is 10 tall; an accidental of
 *  `hang` px reaches that much further DOWN, which is a sharp's whole problem. */
function note(hang: number, sign = '#'): BoxedNote {
  const arr = [{ getCategory: () => 'Accidental', type: sign }]
  return {
    getModifiers: () => arr,
    getBoundingBox: () => ({ x: 0, y: 0, w: 10, h: 10 + arr.reduce((s, m) => s + (m ? hang : 0), 0) }),
  }
}

describe('accidentalTuckSpaces — read from the font, ⛔ never a tuned constant', () => {
  it('⭐⭐ a SHARP may be entered half a space from below — Verovio’s own 0.9 against a 1.392 box', () => {
    // `glyphBox('accidentalSharp').down` = 1.392, `cutOutSW` = −0.896.
    expect(accidentalTuckSpaces('#', 1)).toBeCloseTo(0.496, 3)
  })

  it('⭐ …and about as much from above — the sharp is symmetric about its line', () => {
    expect(accidentalTuckSpaces('#', -1)).toBeCloseTo(0.504, 3)
  })

  it('🚨🚨 a FLAT yields almost nothing from below, and that is the point', () => {
    // His measurement: `B4 → G♯4` and `A4 → F♭4`, same interval, same beam — two different shapes.
    // A flat is nearly all ABOVE its line (box 0.7 down, notch 0.476), so it never balloons a slur
    // and must not be given a sharp's licence.
    expect(accidentalTuckSpaces('b', 1)).toBeCloseTo(0.224, 3)
    expect(accidentalTuckSpaces('b', 1)).toBeLessThan(accidentalTuckSpaces('#', 1))
  })

  it('⛔ a sign the font gives no cut-out for on that side yields 0 — ⛔ never a guess', () => {
    // A flat has no NW/NE-side notch worth the name in this font's anchors on the lower side, and an
    // unmeasured sign has no box at all. Both answer 0 rather than a plausible number.
    expect(accidentalTuckSpaces('', 1)).toBe(0)
    expect(accidentalTuckSpaces('#?', -1)).toBe(0)
  })
})

describe('curveObstacleBox — the trim, and its two bounds', () => {
  it('⭐⭐ pulls the facing edge into the notch when the ACCIDENTAL set it', () => {
    // Head 10 tall, the sharp hanging 8 px below it: the box is 18, and 0.496 sp = 4.96 px of that
    // is notch the slur may enter.
    const box = curveObstacleBox(note(8), 1, stave)!
    expect(box.y + box.height).toBeCloseTo(18 - 4.96, 2)
  })

  it('🚨 …but ⛔ NEVER past the rest of the note — a notehead is cleared in full', () => {
    // The same sharp hanging only 2 px: the tuck would eat 4.96 and reach into the head, so it stops
    // at the head's own bottom. ⛔ The alternative is a slur drawn through a notehead.
    const box = curveObstacleBox(note(2), 1, stave)!
    expect(box.y + box.height).toBe(10)
  })

  it('⭐ a note with no accidental is untouched', () => {
    const plain: BoxedNote = { getModifiers: () => [], getBoundingBox: () => ({ x: 0, y: 0, w: 10, h: 10 }) }
    expect(curveObstacleBox(plain, 1, stave)).toEqual({ x: 0, y: 0, width: 10, height: 10 })
  })

  it('⛔ …and so is one on a stave that has not been laid out — no conversion, no trim', () => {
    // ⚠️ The tuck is in staff spaces and only a stave can price it. Absent, the honest answer is the
    // untrimmed ink, ⛔ not a pixel guess.
    expect(curveObstacleBox(note(8), 1, undefined)?.height).toBe(18)
  })

  it('⛔ a note VexFlow cannot measure is not an obstacle', () => {
    const gone: BoxedNote = { getModifiers: () => [], getBoundingBox: () => undefined }
    expect(curveObstacleBox(gone, 1, stave)).toBeNull()
  })
})
