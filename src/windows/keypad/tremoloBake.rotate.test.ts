/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest'
import { bakeGlyphStack, bakeRecipeKey } from './tremoloBake'

/**
 * A layer may be TURNED (`GlyphSpec.rotate`), so a stroke the font draws at one slope can be laid at
 * another — the cue-size key's stroke is. Three places have to agree about it: the live spans
 * (`KeypadWidget`), the svg text form here, and the outline baker (`e2e/keypadIcons.bake.ts`), or the
 * picture changes the moment it is baked.
 *
 * 🚨 And the KEY is the trap. `bakeRecipeKey` is what finds a drawing's baked outlines; widening it
 * for every layer missed every outline already baked and dropped the whole panel back to the live
 * text form, which a browser zoom re-lays (his report, 2026-09-23). So a layer that is NOT turned
 * must key exactly as it did before rotation existed.
 */
describe('tremoloBake — a turned layer', () => {
  const layer = { glyph: 'x', size: 26, dy: -10 }

  it('🚨 keys an UNTURNED layer exactly as before rotation existed — four fields, not five', () => {
    const before = JSON.stringify([['x'.codePointAt(0), 26, 0, -10]])
    expect(bakeRecipeKey([layer])).toBe(before)
    expect(bakeRecipeKey([{ ...layer, rotate: 0 }])).toBe(before)
  })

  it('…and a turned one says so, so two drawings that differ only by the turn are different drawings', () => {
    expect(bakeRecipeKey([{ ...layer, rotate: 10 }])).not.toBe(bakeRecipeKey([layer]))
    expect(bakeRecipeKey([{ ...layer, rotate: 10 }])).not.toBe(bakeRecipeKey([{ ...layer, rotate: -10 }]))
  })

  it('turns about the BOX CENTRE, where the layer is anchored — ⛔ not about the origin', () => {
    const svg = bakeGlyphStack([{ glyph: 'x', size: 26, dx: 2, dy: 7, rotate: 10 }], 'Bravura')
    const text = svg.querySelector('text')!
    // The glyph is anchored at the box's middle (13, 13); a rotate about anything else would swing
    // it away instead of turning it in place.
    expect(text.getAttribute('x')).toBe('13')
    expect(text.getAttribute('y')).toBe('13')
    expect(text.getAttribute('transform')).toBe('translate(2, 7) rotate(10, 13, 13)')
  })

  it('leaves an unturned layer with the plain translate it always had', () => {
    const svg = bakeGlyphStack([{ glyph: 'x', dx: 2, dy: 7 }], 'Bravura')
    expect(svg.querySelector('text')!.getAttribute('transform')).toBe('translate(2, 7)')
  })
})
