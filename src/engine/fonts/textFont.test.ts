import { afterEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_TEXT_FONT, SYSTEM_SERIF_STACK, TEXT_FONTS, activeTextFont, setActiveTextFont, textFamily,
  textFontGeneration, textStyleIsShipped, type TextStyle,
} from './textFont'
import { FONT_FILES } from './fontFiles'
import { musicFontStack } from './musicFont'

afterEach(() => { setActiveTextFont(DEFAULT_TEXT_FONT) })

describe('textFont', () => {
  it('⭐ Academico answers with the strings the engine always used — no pixel moved', () => {
    expect(activeTextFont().id).toBe('academico')
    expect(textFamily('regular')).toBe('Academico')
    expect(textFamily('bold')).toBe('Academico')
    expect(textFamily('italic')).toBe('Georgia, "Times New Roman", Times, serif')
    expect(musicFontStack()).toBe('Bravura,Academico')
  })

  it('a face with the style leads the stack, the system serif behind it', () => {
    setActiveTextFont('edwin')
    for (const style of ['regular', 'bold', 'italic', 'boldItalic'] as TextStyle[]) {
      expect(textFamily(style)).toBe(`Edwin, ${SYSTEM_SERIF_STACK}`)
    }
    expect(musicFontStack()).toBe(`Bravura,Edwin, ${SYSTEM_SERIF_STACK}`)
  })

  it('⛔ a style the face has no FILE for never leads with that face — a browser would synthesise it', () => {
    setActiveTextFont('nepomuk')
    expect(textFamily('italic')).toMatch(/^Nepomuk,/)
    expect(textFamily('bold'), 'Nepomuk has no bold: Academico’s').toBe('Academico')
    expect(textFamily('boldItalic'), 'nobody ships it for this choice').toBe(SYSTEM_SERIF_STACK)
    expect(textStyleIsShipped('bold')).toBe(true)
    expect(textStyleIsShipped('boldItalic')).toBe(false)
  })

  it('a switch bumps the generation; the same face again does not', () => {
    const before = textFontGeneration()
    expect(setActiveTextFont('edwin')).toBe(true)
    expect(setActiveTextFont('edwin')).toBe(false)
    expect(textFontGeneration()).toBe(before + 1)
  })

  it('⭐ every style a row CLAIMS has a real file, and every file is claimed', () => {
    const styleOf = (row: (typeof FONT_FILES)[number]): TextStyle =>
      row.weight === 'bold' ? (row.style === 'italic' ? 'boldItalic' : 'bold') : row.style === 'italic' ? 'italic' : 'regular'
    for (const face of TEXT_FONTS) {
      const files = FONT_FILES.filter(row => row.role === 'text' && row.family === face.family).map(styleOf)
      expect([...files].sort(), face.family).toEqual([...face.styles].sort())
    }
  })
})
