// @vitest-environment jsdom
/**
 * ⭐⭐ **A HIT BOX, CHECKED IN jsdom** — which is the whole point of P6b
 * (`docs/plans/own-engraving-engine.md` §5 P6).
 *
 * 🚨 **The break-test is built into every case here and it is worth stating once:** in jsdom
 * `Accidental.getBoundingBox()` answers **0×0** — a page-less test has no font, so VexFlow's ruler
 * measures nothing (`reference: jsdom cannot measure glyphs`). Every number below therefore fails
 * against the ruler we are replacing, and could not have been written before this file existed.
 * ⭐ That is also why the accidental's own registry spec used to say *"these assert the ANCHOR, ⛔ not
 * geometry"*.
 */
import { describe, it, expect } from 'vitest'
import { SvgPainter } from './SvgPainter'
import { EngravedAccidental } from '../engraved/EngravedAccidental'
import { EngravedNote, drawNoteInkThrough } from '../engraved/EngravedNote'
import { EngravedStave } from '../engraved/EngravedStave'
import { attachModifier } from '../engraved/EngravedModifier'
import { formatLoneNote } from '../ghosts/loneNote'
import { accidentalHitBox } from './drawnHitBox'
import { glyphBox, glyphNameOf } from '@/engine/fonts/fontMetrics'
import { standOn } from '../staff/staveFrame'

/**
 * One drawn accidental, on a lone note formatted and drawn by the score's own pipeline — ⚠️ it must
 * have DRAWN: the draw is where the sign learns where it stands.
 */
function drawnSign(sign: string): EngravedAccidental {
  const div = document.createElement('div')
  document.body.appendChild(div)
  const ctx = new SvgPainter(div).resize(500, 200)
  const stave = new EngravedStave(10, 40, 400)
  const note = new EngravedNote({ keys: ['c/4'], duration: 'q' })
  standOn(note, stave)
  const accidental = new EngravedAccidental(sign)
  attachModifier(note, accidental, 0)
  formatLoneNote(note, stave, { numerator: 4, denominator: 4 }, 300)
  drawNoteInkThrough([note], ctx)
  note.setContext(ctx).draw()
  return accidental
}

/** Bravura at the size a notehead's modifiers are drawn: `size: 30` POINTS ⇒ 40 px em ⇒ 10 px/space. */
const SPACE_PX = 10

describe('the accidental’s hit box', () => {
  it('⭐⭐ is the GLYPH’S OWN OUTLINE — ⛔ not the font’s line box, and ⛔ not 0×0', () => {
    const box = accidentalHitBox(drawnSign('#'))!
    // Bravura's `accidentalSharp`: 0.996 wide, 1.4 up and 1.392 down from its baseline.
    expect(box.width).toBeCloseTo(0.996 * SPACE_PX, 6)
    expect(box.height).toBeCloseTo((1.4 + 1.392) * SPACE_PX, 6)
  })

  it('🚨 the break-test — VexFlow’s ruler answers 0×0 for the very same sign', () => {
    const accidental = drawnSign('#')
    const ruler = accidental.getBoundingBox()!
    expect([ruler.w, ruler.h], 'no font, no measurement').toEqual([0, 0])
    expect(accidentalHitBox(accidental)!.height).toBeGreaterThan(0)
  })

  it('⭐ hangs off the BASELINE the glyph was stamped on, ⛔ not off a top or a centre', () => {
    const accidental = drawnSign('#')
    const box = accidentalHitBox(accidental)!
    // ⚠️ VexFlow's degenerate box is being used as a PROBE for the stamp point, and it can be:
    // `getBoundingBox()` is `(x + xShift, y + yShift − ascent, width, height)`, and in jsdom every
    // one of those measured terms is 0 — so what is left is exactly the point the glyph was put at.
    const stamp = accidental.getBoundingBox()!
    expect(box.x, 'a sharp’s ink starts AT its origin (left = 0)').toBeCloseTo(stamp.x, 6)
    expect(box.y, 'and reaches 1.4 spaces above the baseline').toBeCloseTo(stamp.y - 1.4 * SPACE_PX, 6)
  })

  it('⭐⭐ reads the SIGN that was drawn — a flat is a different shape from a sharp', () => {
    const sharp = accidentalHitBox(drawnSign('#'))!
    const flat = accidentalHitBox(drawnSign('b'))!
    // A flat's bowl sits almost entirely ABOVE its baseline (up 1.756, down 0.7); a sharp straddles.
    expect(flat.height).toBeCloseTo((1.756 + 0.7) * SPACE_PX, 6)
    expect(flat.height, 'and the two are genuinely different').not.toBeCloseTo(sharp.height, 3)
  })

  it('⭐ every sign this editor can draw HAS a box — so a null answer means a NEW glyph', () => {
    for (const sign of ['#', 'b', 'n', '##', 'bb']) {
      const accidental = drawnSign(sign)
      expect(accidental.drawnInk(), sign).not.toBeNull()
      expect(glyphNameOf(accidental.getText()), `${sign} is in the font table`).not.toBeNull()
    }
  })

  it('🚨 a sign that has not DRAWN falls back to its line box — and a sign with no glyph is refused', () => {
    const undrawn = new EngravedAccidental('#')
    expect(undrawn.drawnInk()).toBeNull()
    const box = accidentalHitBox(undrawn)!
    const line = undrawn.getBoundingBox()
    expect([box.x, box.y, box.width, box.height]).toEqual([line.x, line.y, line.w, line.h])
    // ⛔ A cautionary or unknown sign never gets that far (S12e) — refused at construction.
    expect(() => new EngravedAccidental('{')).toThrow()
  })

  it('⭐ the box is the FONT’s, so it does not depend on a page having measured anything', () => {
    // ⚠️ The one number here that still comes from a runtime measurement is the sign's PLACE:
    // `accidentalOriginX` sets it back by `getWidth()`, which is 0 in jsdom. The SIZE is the font's.
    const ink = glyphBox('accidentalSharp')
    const box = accidentalHitBox(drawnSign('#'))!
    expect(box.width).toBeCloseTo((ink.left + ink.right) * SPACE_PX, 6)
  })
})
