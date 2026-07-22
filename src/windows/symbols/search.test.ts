import { describe, it, expect } from 'vitest'
import { filterBlocks, parseCodepointQuery } from './search'
import type { RangeBlock } from './smufl'

const blocks: RangeBlock[] = [
  {
    id: 'clefs',
    title: 'Clefs',
    span: 'U+E050–U+E07F',
    glyphs: [
      { name: 'gClef', char: '\uE050', codepoint: 'U+E050', description: 'G clef' },
      { name: 'fClef', char: '\uE062', codepoint: 'U+E062', description: 'F clef' },
    ],
  },
  {
    id: 'noteheads',
    title: 'Noteheads',
    span: 'U+E0A0–U+E0FF',
    glyphs: [
      { name: 'noteheadBlack', char: '\uE0A4', codepoint: 'U+E0A4', description: 'Black notehead' },
      { name: 'noteheadWhole', char: '\uE0A2', codepoint: 'U+E0A2', description: 'Whole notehead' },
    ],
  },
]

describe('parseCodepointQuery', () => {
  it('takes a codepoint in every spelling a developer already has one in', () => {
    for (const query of ['E0A4', 'e0a4', 'U+E0A4', 'u+e0a4', '0xE0A4', '\\uE0A4']) {
      expect(parseCodepointQuery(query)).toBe('U+E0A4')
    }
  })

  it('leaves a word alone', () => {
    expect(parseCodepointQuery('notehead')).toBeNull()
    // Hex-looking, but too short to be a codepoint — and `fa` is how you start typing `fermata`.
    expect(parseCodepointQuery('fa')).toBeNull()
  })
})

describe('filterBlocks', () => {
  it('returns the chart untouched for an empty query', () => {
    const result = filterBlocks(blocks, '  ')
    expect(result.blocks).toBe(blocks)
    expect(result.matched).toBe(4)
  })

  it('matches a name, case-insensitively', () => {
    const result = filterBlocks(blocks, 'NOTEHEAD')
    expect(result.matched).toBe(2)
    expect(result.blocks.map(b => b.id)).toEqual(['noteheads'])
  })

  it('matches the description too — the word a musician knows, not the camelCase one', () => {
    const result = filterBlocks(blocks, 'whole')
    expect(result.blocks[0]?.glyphs.map(g => g.name)).toEqual(['noteheadWhole'])
  })

  it('matches one glyph exactly when given a codepoint', () => {
    const result = filterBlocks(blocks, 'u+e050')
    expect(result.matched).toBe(1)
    expect(result.blocks[0]?.glyphs[0]?.name).toBe('gClef')
  })

  it('keeps a matching block\'s identity, so the chart still says where a hit lives', () => {
    const [block] = filterBlocks(blocks, 'gclef').blocks
    expect(block).toMatchObject({ id: 'clefs', title: 'Clefs', span: 'U+E050–U+E07F' })
  })

  it('drops blocks with no match rather than showing empty headings', () => {
    expect(filterBlocks(blocks, 'clef').blocks.map(b => b.id)).toEqual(['clefs'])
    expect(filterBlocks(blocks, 'ottava').blocks).toEqual([])
    expect(filterBlocks(blocks, 'ottava').matched).toBe(0)
  })
})
