import { describe, it, expect } from 'vitest'
import {
  CAUTIONARY_ACCIDENTAL_SIZE_PT,
  MEASURE_NUMBER_SIZE_PT,
  MUSIC_FONT_SIZE_PT,
  MUSIC_FONT_STACK,
  MUSIC_GLYPH_FONT,
  NOTE_FONT,
  accidentalFont,
  clefFont,
} from './inheritedFonts'

/**
 * ⭐ The inherited faces are TODAY's picture, copied exactly — S1c of `docs/vexflow-removal-map.md`
 * moved the fonts out of the drawing library's per-category table and moved no pixel doing it.
 *
 * ⚠️ These are not laws (rule 13): each is one house style's default. A change here is a DECISION
 * about the look — make it on purpose and update the row's source line with it, ⛔ never to make this
 * spec pass.
 */
describe('the inherited faces are the ones the editor has always drawn with', () => {
  it('music is set in Bravura, the text face behind it, upright and regular, at 30 pt', () => {
    expect(MUSIC_GLYPH_FONT).toEqual({ family: 'Bravura,Academico', size: 30, weight: 'normal', style: 'normal' })
    expect(MUSIC_FONT_STACK).toBe('Bravura,Academico')
    expect(MUSIC_FONT_SIZE_PT).toBe(30)
  })

  it('a notehead and its flag take the note’s face — 30 pt at glyph scale 1', () => {
    expect(NOTE_FONT).toEqual(MUSIC_GLYPH_FONT)
  })

  it('a clef is 30 pt, and a small clef is two thirds of it FLOORED to 20', () => {
    expect(clefFont('default').size).toBe(30)
    expect(clefFont('small').size).toBe(20)
    expect(clefFont('small').family).toBe(MUSIC_FONT_STACK)
  })

  it('an accidental is 30 pt, and 20 pt when its sign is between SMuFL parentheses (cautionary)', () => {
    expect(accidentalFont('')).toEqual(MUSIC_GLYPH_FONT) // accidentalSharp
    expect(accidentalFont('').size).toBe(CAUTIONARY_ACCIDENTAL_SIZE_PT)
    expect(CAUTIONARY_ACCIDENTAL_SIZE_PT).toBe(20)
  })

  it('a stave’s measure number is 8 pt', () => {
    expect(MEASURE_NUMBER_SIZE_PT).toBe(8)
  })
})
