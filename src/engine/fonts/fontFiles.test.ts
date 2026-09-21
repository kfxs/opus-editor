import { describe, it, expect } from 'vitest'
import { FONT_FILES, fontFileUrl } from './fontFiles'

/**
 * The font table is what the screen installs and what the PDF outlines. ⚠️ Whether each row's file
 * is really served is a browser fact, and `e2e/musicFontFaces.e2e.ts` is where it fails: a face
 * that cannot load leaves the page on VexFlow's copies, which both of its tests detect.
 */
describe('FONT_FILES', () => {
  it('Bravura leads the music faces — the one the metrics table measures and the others fall back to', () => {
    expect(FONT_FILES.filter(row => row.role === 'music').map(row => row.family)).toEqual(['Bravura', 'Leipzig', 'Sebastian'])
  })

  it('no face is listed twice — one file per family and weight', () => {
    const keys = FONT_FILES.map(row => `${row.family}|${row.weight}`)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('a bold word has a real bold file, never a synthesised one', () => {
    expect(FONT_FILES.some(row => row.family === 'Academico' && row.weight === 'bold')).toBe(true)
  })
})

describe('fontFileUrl', () => {
  it('serves a file from fonts/ under the base path', () => {
    const url = fontFileUrl('Bravura.otf')
    expect(url.startsWith('/')).toBe(true)
    expect(url.endsWith('fonts/Bravura.otf')).toBe(true)
  })
})
