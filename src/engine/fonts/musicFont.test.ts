import { afterEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_MUSIC_FONT,
  MUSIC_FONTS,
  activeMusicFont,
  musicFontGeneration,
  musicFontStack,
  setActiveMusicFont,
} from './musicFont'
import { FONT_FILES } from './fontFiles'

afterEach(() => { setActiveMusicFont(DEFAULT_MUSIC_FONT) })

describe('musicFont', () => {
  it('starts on Bravura, with the stack the engine has always drawn in', () => {
    expect(activeMusicFont().id).toBe('bravura')
    expect(musicFontStack()).toBe('Bravura,Academico')
  })

  it('another face leads the stack and keeps Bravura behind it, for the glyphs it lacks', () => {
    setActiveMusicFont('leipzig')
    expect(musicFontStack()).toBe('Leipzig,Bravura,Academico')
    setActiveMusicFont('sebastian')
    expect(musicFontStack()).toBe('Sebastian,Bravura,Academico')
  })

  it('a switch bumps the generation; choosing the same face again does not', () => {
    const before = musicFontGeneration()
    expect(setActiveMusicFont('leipzig')).toBe(true)
    expect(musicFontGeneration()).toBe(before + 1)
    expect(setActiveMusicFont('leipzig')).toBe(false)
    expect(musicFontGeneration()).toBe(before + 1)
  })

  it('every face has a music file to load', () => {
    const shipped = FONT_FILES.filter(row => row.role === 'music').map(row => row.family)
    expect(MUSIC_FONTS.map(row => row.family).sort()).toEqual([...shipped].sort())
  })
})
