/**
 * {@link smuflGlyph} — any SMuFL glyph by name, for the user's symbols (docs/plans/symbol-plan.md P1a).
 */
import { describe, it, expect } from 'vitest'
import { smuflGlyph } from './smuflGlyphs'
import { SMUFL_GLYPH_TABLE } from './smuflGlyphTable'
import { GLYPH_BOXES, GLYPH_CODEPOINTS, type GlyphName } from './bravuraMetrics'

describe('smuflGlyph', () => {
  it('knows a glyph the editor never draws itself, with its character and box', () => {
    const g = smuflGlyph('pictGlsp')!
    expect(g.char).toBe('')
    expect(g.box).toEqual({ left: 0, right: 4.784, up: 3.12, down: 0, advance: 4.796 })
  })

  it('centres on half the advance where the font declares no optical centre', () => {
    expect(smuflGlyph('fermataAbove')!.centerX).toBe(2.42 / 2)
  })

  it("centres on the metadata's optical centre where there is one", () => {
    expect(smuflGlyph('dynamicFF')!.centerX).toBe(1.852)
  })

  it('answers null for an unknown name, an inherited property, and a glyph drawing no ink', () => {
    expect(smuflGlyph('notAGlyph')).toBeNull()
    expect(smuflGlyph('constructor')).toBeNull()
    expect(smuflGlyph('controlBeginBeam')).toBeNull()
  })

  it('agrees with the editor’s own table on every glyph both hold — the same OTF, measured twice', () => {
    const shared = (Object.keys(GLYPH_BOXES) as GlyphName[]).filter(name => Object.prototype.hasOwnProperty.call(SMUFL_GLYPH_TABLE, name))
    expect(shared.length).toBeGreaterThan(50)
    for (const name of shared) {
      const g = smuflGlyph(name)!
      expect(g.box, name).toEqual(GLYPH_BOXES[name])
      expect(g.char.codePointAt(0), name).toBe(GLYPH_CODEPOINTS[name])
    }
  })
})
