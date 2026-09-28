/**
 * {@link glyphMarkInk} — a symbol's reach from its baseline is its glyph's box (docs/plans/symbol-plan.md P1).
 */
import { describe, it, expect } from 'vitest'
import { glyphMarkInk } from './glyphMarkStyle'
import { smuflGlyph } from '@/engine/fonts/smuflGlyphs'

describe('glyphMarkInk', () => {
  it('reads the glyph box, and answers null for an unknown glyph', () => {
    const box = smuflGlyph('fermataAbove')!.box
    expect(glyphMarkInk('fermataAbove')).toEqual({ above: box.up, below: box.down })
    expect(glyphMarkInk('notAGlyph')).toBeNull()
  })
})
