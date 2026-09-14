import { describe, it, expect } from 'vitest'
import {
  ACCIDENTAL_NOTEHEAD_PADDING_PX,
  LEDGER_OVERHANG_PX,
  MODIFIER_LEFT_OFFSET_PX,
  NOTE_AREA_PADDING_PX,
  NOTE_GLYPH_SCALE,
  STEM_THICKNESS_PX,
  TREMOLO_FONT_SIZE,
  TREMOLO_STROKE_STEP_PX,
} from './inheritedDefaults'

/**
 * ⭐ The inherited defaults are TODAY's picture, copied exactly — S1b of `docs/vexflow-removal-map.md`
 * moved these numbers out of the drawing library's tables and moved no pixel doing it.
 *
 * ⚠️ These are not laws (rule 13): each is one house style's default, and its alternatives are
 * researched. A change here is a DECISION about the look — make it on purpose and update the row's
 * source line with it, ⛔ never to make this spec pass.
 */
describe('the inherited defaults are the values the editor has always drawn with', () => {
  it('a stem is 1.5 px (0.15 staff spaces) — `Tables.STEM_WIDTH`', () => {
    expect(STEM_THICKNESS_PX).toBe(1.5)
  })

  it('a ledger line overhangs its head by 3 px (0.3 staff spaces) — `StaveNote.LEDGER_LINE_OFFSET`', () => {
    expect(LEDGER_OVERHANG_PX).toBe(3)
  })

  it('the note area starts 12 px (1.2 staff spaces) in — `Stave.padding`', () => {
    expect(NOTE_AREA_PADDING_PX).toBe(12)
  })

  it('an accidental stands 1 px + 2 px off its notehead — the metric and the literal', () => {
    expect(ACCIDENTAL_NOTEHEAD_PADDING_PX).toBe(1)
    expect(MODIFIER_LEFT_OFFSET_PX).toBe(2)
  })

  it('tremolo strokes step 7 px at the root glyph size 30, at glyph scale 1', () => {
    expect(TREMOLO_STROKE_STEP_PX).toBe(7)
    expect(TREMOLO_FONT_SIZE).toBe(30)
    expect(NOTE_GLYPH_SCALE).toBe(1)
  })
})
