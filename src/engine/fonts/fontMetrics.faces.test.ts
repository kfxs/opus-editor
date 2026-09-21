import { afterEach, describe, expect, it } from 'vitest'
import { anchor, engravingDefault, fallbackDefaults, fallbackGlyphs, glyphBox, type GlyphName } from './fontMetrics'
import * as bravura from './bravuraMetrics'
import * as leipzig from './leipzigMetrics'
import * as sebastian from './sebastianMetrics'
import { DEFAULT_MUSIC_FONT, setActiveMusicFont } from './musicFont'

/**
 * Phase B of `docs/plans/music-font-switch-plan.md`: one generated table per music face, and the
 * lookups read the ACTIVE one. ⛔ Nothing here judges a face's numbers — they are measurements of
 * its OTF. What is held is the CONTRACT: every table is total, and what a face borrowed from
 * Bravura is declared and is Bravura's row WHOLE.
 */
afterEach(() => { setActiveMusicFont(DEFAULT_MUSIC_FONT) })

const NAMES = Object.keys(bravura.GLYPH_BOXES) as GlyphName[]
const FACES = { leipzig, sebastian }

describe.each(Object.entries(FACES))('%s — the generated table', (_id, face) => {
  it('is TOTAL over the glyphs we draw, and over Bravura’s engraving defaults', () => {
    expect(Object.keys(face.GLYPH_BOXES).sort()).toEqual([...NAMES].sort())
    expect(Object.keys(face.ENGRAVING_DEFAULTS).sort()).toEqual(Object.keys(bravura.ENGRAVING_DEFAULTS).sort())
  })

  it('⭐ a borrowed glyph is Bravura’s row WHOLE — its box and its anchors together', () => {
    expect(face.FALLBACK_GLYPHS.length).toBeGreaterThan(0)
    for (const name of face.FALLBACK_GLYPHS) {
      expect(face.GLYPH_BOXES[name], name).toEqual(bravura.GLYPH_BOXES[name])
      expect(face.GLYPH_ANCHORS[name], name).toEqual(bravura.GLYPH_ANCHORS[name])
    }
  })

  it('a borrowed default is Bravura’s value, and declared', () => {
    const defaults = face.ENGRAVING_DEFAULTS as Record<string, number>
    for (const name of face.FALLBACK_DEFAULTS) {
      expect(defaults[name], name).toBe((bravura.ENGRAVING_DEFAULTS as Record<string, number>)[name])
    }
  })

  it('the face really is another font — its black notehead is not Bravura’s', () => {
    expect(face.FALLBACK_GLYPHS).not.toContain('noteheadBlack')
    expect(face.GLYPH_BOXES.noteheadBlack).not.toEqual(bravura.GLYPH_BOXES.noteheadBlack)
  })
})

describe('fontMetrics reads the ACTIVE face', () => {
  it('Bravura by default, with nothing borrowed', () => {
    expect(glyphBox('noteheadBlack')).toBe(bravura.GLYPH_BOXES.noteheadBlack)
    expect(fallbackGlyphs()).toEqual([])
    expect(fallbackDefaults()).toEqual([])
  })

  it('⭐ a switch changes every lookup at once — box, default, anchor, and what was borrowed', () => {
    setActiveMusicFont('leipzig')
    expect(glyphBox('noteheadBlack')).toBe(leipzig.GLYPH_BOXES.noteheadBlack)
    expect(engravingDefault('stemThickness')).toBe(leipzig.ENGRAVING_DEFAULTS.stemThickness)
    expect(anchor('noteheadBlack', 'stemUpSE')).toEqual(leipzig.GLYPH_ANCHORS.noteheadBlack?.stemUpSE ?? null)
    expect(fallbackGlyphs()).toBe(leipzig.FALLBACK_GLYPHS)
    expect(fallbackGlyphs()).toContain('bracket')

    setActiveMusicFont('sebastian')
    expect(glyphBox('gClef')).toBe(sebastian.GLYPH_BOXES.gClef)
    expect(fallbackGlyphs()).toEqual(['bracket'])
  })

  it('…and back on Bravura every answer is Bravura’s again', () => {
    setActiveMusicFont('sebastian')
    setActiveMusicFont('bravura')
    expect(engravingDefault('beamThickness')).toBe(bravura.ENGRAVING_DEFAULTS.beamThickness)
  })
})
