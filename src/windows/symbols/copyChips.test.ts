import { describe, it, expect } from 'vitest'
import { copyFormats, escapeLiteral, summary } from './copyChips'
import type { Glyph } from './smufl'

const noteheadBlack: Glyph = {
  name: 'noteheadBlack',
  char: '\uE0A4',
  codepoint: 'U+E0A4',
  description: 'Black notehead',
}

describe('escapeLiteral', () => {
  it('writes the escape a source file wants, not the character', () => {
    // The PUA character is INVISIBLE in an editor, a diff and a terminal. The escape is the form
    // that survives all three — and it still evaluates to the glyph in the console.
    expect(escapeLiteral('\uE0A4')).toBe("'\\uE0A4'")
  })

  it('uses the braced form above the BMP, where \\uXXXX cannot reach', () => {
    // U+1D158 — the standard-Unicode notehead. `'ᴕ8'` would be `ᴕ` followed by `8`.
    expect(escapeLiteral('\u{1D158}')).toBe("'\\u{1D158}'")
  })
})

describe('summary', () => {
  it('is one line carrying every way to identify the glyph', () => {
    expect(summary(noteheadBlack)).toBe('noteheadBlack U+E0A4 \uE0A4 — Black notehead')
  })
})

describe('copyFormats', () => {
  it('labels every chip with the exact string it copies', () => {
    // The whole point of a chip per format: what you read is what lands on the clipboard. Only the
    // `all` chip is allowed to differ, because its value is a whole line.
    for (const format of copyFormats(noteheadBlack)) {
      if (format.label !== 'all') expect(format.value).toBe(format.label)
    }
  })

  it('offers the name, the codepoint, the literal, the character and the line', () => {
    expect(copyFormats(noteheadBlack).map(f => f.value)).toEqual([
      'noteheadBlack',
      'U+E0A4',
      "'\\uE0A4'",
      '\uE0A4',
      'noteheadBlack U+E0A4 \uE0A4 — Black notehead',
    ])
  })

  it('adds the standard-Unicode codepoint only for the glyphs that have one', () => {
    const flat: Glyph = {
      name: 'accidentalFlat',
      char: '\uE260',
      codepoint: 'U+E260',
      description: 'Flat',
      alternateCodepoint: 'U+266D',
    }
    expect(copyFormats(flat).map(f => f.value)).toContain('U+266D')
    expect(copyFormats(noteheadBlack).map(f => f.value)).not.toContain('U+266D')
  })
})
