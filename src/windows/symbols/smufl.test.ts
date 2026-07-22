import { describe, it, expect } from 'vitest'
import { codepointToChar, indexSmufl, type GlyphName, type Range } from './smufl'

describe('codepointToChar', () => {
  it('reads the spec\'s own spelling', () => {
    expect(codepointToChar('U+E0A4')).toBe('\uE0A4')
  })

  it('returns null rather than guessing at anything else', () => {
    // A wrong character here would draw a plausible WRONG glyph — worse than a gap, because the
    // chart is what someone checks a glyph AGAINST.
    expect(codepointToChar('E0A4')).toBeNull()
    expect(codepointToChar('')).toBeNull()
    expect(codepointToChar('U+ZZZZ')).toBeNull()
  })
})

describe('indexSmufl', () => {
  const names: Record<string, GlyphName> = {
    noteheadBlack: { codepoint: 'U+E0A4', description: 'Black notehead' },
    gClef: { codepoint: 'U+E050', description: 'G clef' },
    accdnRH3RanksPiccolo: { codepoint: 'U+E8A0', description: 'Right hand, 3 ranks, piccolo' },
  }
  const ranges: Record<string, Range> = {
    // Keyed alphabetically, exactly as the real file is: accordion first, clefs last.
    accordion: {
      description: 'Accordion',
      glyphs: ['accdnRH3RanksPiccolo'],
      range_start: 'U+E8A0',
      range_end: 'U+E8DF',
    },
    noteheads: {
      description: 'Noteheads',
      glyphs: ['noteheadBlack', 'noteheadNotInThisFont'],
      range_start: 'U+E0A0',
      range_end: 'U+E0FF',
    },
    clefs: {
      description: 'Clefs',
      glyphs: ['gClef'],
      range_start: 'U+E050',
      range_end: 'U+E07F',
    },
  }

  it('orders the blocks by codepoint, not by the key the JSON happens to use', () => {
    // Read in the file's own (alphabetical) order the chart opens on Accordion and scatters the
    // noteheads through its middle. Every printed chart is in codepoint order; so is this one.
    expect(indexSmufl(names, ranges).blocks.map(b => b.id)).toEqual([
      'clefs',
      'noteheads',
      'accordion',
    ])
  })

  it('resolves each range\'s glyphs to characters', () => {
    const noteheads = indexSmufl(names, ranges).blocks.find(b => b.id === 'noteheads')
    expect(noteheads?.title).toBe('Noteheads')
    expect(noteheads?.span).toBe('U+E0A0–U+E0FF')
    expect(noteheads?.glyphs[0]).toMatchObject({
      name: 'noteheadBlack',
      char: '\uE0A4',
      codepoint: 'U+E0A4',
      description: 'Black notehead',
    })
  })

  it('drops a glyph a range names but glyphnames does not', () => {
    // The spec adds glyphs faster than it reissues the tables. An unresolvable name has no
    // character to draw, so it leaves no cell — rather than a blank one that reads as a font gap.
    const noteheads = indexSmufl(names, ranges).blocks.find(b => b.id === 'noteheads')
    expect(noteheads?.glyphs).toHaveLength(1)
  })

  it('indexes every glyph by its canonical name', () => {
    const { byName } = indexSmufl(names, ranges)
    expect(byName.size).toBe(3)
    expect(byName.get('gClef')?.char).toBe('\uE050')
  })
})
