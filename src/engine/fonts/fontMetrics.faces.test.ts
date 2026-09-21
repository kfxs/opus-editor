import { afterEach, describe, expect, it } from 'vitest'
import {
  anchor, differenceFromDefault, engravingDefault, fallbackDefaults, fallbackGlyphs, glyphBox, ratioToDefault,
  type GlyphName,
} from './fontMetrics'
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

describe('differenceFromDefault / ratioToDefault — how a house row follows the face', () => {
  const staffLine = () => engravingDefault('staffLineThickness')

  it('⭐ exactly 0 and exactly 1 on Bravura — the question is not even asked', () => {
    let asked = 0
    const counted = () => { asked++; return staffLine() }
    expect(differenceFromDefault(counted)).toBe(0)
    expect(ratioToDefault(counted)).toBe(1)
    expect(asked).toBe(0)
  })

  it('another face answers against Bravura’s table, and the pin does not leak', () => {
    setActiveMusicFont('leipzig')
    const own = leipzig.ENGRAVING_DEFAULTS.staffLineThickness
    const base = bravura.ENGRAVING_DEFAULTS.staffLineThickness
    expect(differenceFromDefault(staffLine)).toBeCloseTo(own - base, 12)
    expect(ratioToDefault(staffLine)).toBeCloseTo(own / base, 12)
    expect(staffLine(), 'still Leipzig’s afterwards').toBe(own)
  })

  it('a quantity that throws still unpins the table', () => {
    setActiveMusicFont('leipzig')
    let calls = 0
    expect(() => ratioToDefault(() => { if (++calls === 2) throw new Error('x'); return 1 })).toThrow('x')
    expect(staffLine()).toBe(leipzig.ENGRAVING_DEFAULTS.staffLineThickness)
  })
})
