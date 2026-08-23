import { describe, it, expect } from 'vitest'
import { LINE_CHOICES } from './linePictures'
import { LINE_TOOL_KINDS } from '@/bus/lineSelection'
import { TRILL_SIGN_GLYPH, TRILL_WIGGLE_GLYPH } from '@/engine/rendering/trillStyle'
import { OTTAVA_NUMERAL_GLYPHS } from '@/engine/rendering/ottavaStyle'
import { PEDAL_DOWN_GLYPH, PEDAL_UP_GLYPH } from '@/engine/rendering/pedalStyle'

/**
 * ⚠️ These assert the MARKUP, never where the ink landed: a unit test runs in jsdom, which has no
 * fonts and no layout, so every glyph there measures 0×0 (`reference_jsdom_cannot_measure_glyphs`).
 * What a picture LOOKS like is his eye's call; what it CONTAINS is checkable, and the one thing
 * worth pinning is that the rows still show the glyphs the engine draws.
 */
function picture(value: string): string {
  const row = LINE_CHOICES.find(c => c.value === value)
  if (!row) throw new Error(`no row for ${value}`)
  return row.picture
}

describe('LINE_CHOICES', () => {
  it('offers the seven rows, each with a picture of its own', () => {
    // The ORDER is the family's, not this file's — one list, shared with the palette.
    expect(LINE_CHOICES.map(c => c.value)).toEqual([...LINE_TOOL_KINDS])
    // Distinct: a copy-paste that left two rows sharing one drawing would still look like a list.
    expect(new Set(LINE_CHOICES.map(c => c.picture)).size).toBe(LINE_CHOICES.length)
  })

  it('draws every row as a self-contained SVG of one size', () => {
    // The size itself is a taste call and moves; that the rows AGREE on it is the contract — a row
    // an odd width wide would sit off-centre in the list and read as a different kind of thing.
    const sizes = new Set(
      LINE_CHOICES.map(({ picture }) => {
        expect(picture.startsWith('<svg')).toBe(true)
        return picture.slice(0, picture.indexOf('>')).match(/width="[\d.]+" height="[\d.]+"/)?.[0]
      }),
    )
    expect(sizes.size).toBe(1)
    expect([...sizes][0]).toBeDefined()
  })

  // ⭐⭐ The reason the glyphs are imported rather than re-typed: a picker that spells its own
  // codepoints is a second opinion about what the editor draws.
  it('shows the ENGINE\'s glyphs, so the picker cannot drift from the score', () => {
    expect(picture('trill')).toContain(TRILL_SIGN_GLYPH)
    expect(picture('trill')).toContain(TRILL_WIGGLE_GLYPH)
    expect(picture('8va')).toContain(OTTAVA_NUMERAL_GLYPHS[1])
    expect(picture('8vb')).toContain(OTTAVA_NUMERAL_GLYPHS[-1])
    expect(picture('pedal')).toContain(PEDAL_DOWN_GLYPH)
    expect(picture('pedal')).toContain(PEDAL_UP_GLYPH)
  })

  it('tiles the trill wave instead of stretching one glyph', () => {
    const wiggles = picture('trill').split(TRILL_WIGGLE_GLYPH).length - 1
    expect(wiggles).toBeGreaterThan(10)
    // ⛔ No textLength: stretching would make one trill's wave a different coarseness from another's.
    expect(picture('trill')).not.toContain('textLength')
  })

  it('turns the ottava hook towards the music it belongs to — down from 8va, up from the lower one', () => {
    const hookY = (value: string): [number, number] => {
      const lines = [...picture(value).matchAll(/<line x1="([\d.]+)" y1="([\d.]+)" x2="([\d.]+)" y2="([\d.]+)"/g)]
      // The hook is the vertical one: the same x at both ends.
      const hook = lines.find(m => m[1] === m[3])
      if (!hook) throw new Error(`no hook in ${value}`)
      return [Number(hook[2]), Number(hook[4])]
    }
    const [upFrom, upTo] = hookY('8va')
    expect(upTo).toBeGreaterThan(upFrom) // SVG y grows downwards: the 8va hooks DOWN
    const [downFrom, downTo] = hookY('8vb')
    expect(downTo).toBeLessThan(downFrom)
  })

  it('draws the hairpins as one shape read in two directions', () => {
    // Both rows are two strokes meeting at a point; the crescendo's point is at the LEFT.
    const opens = (value: string): { tip: number; mouth: number } => {
      const lines = [...picture(value).matchAll(/x1="([\d.]+)" y1="([\d.]+)" x2="([\d.]+)" y2="([\d.]+)"/g)]
      expect(lines).toHaveLength(2)
      // The two strokes share their start (the tip) and part at the far end (the mouth).
      expect(lines[0][1]).toBe(lines[1][1])
      expect(Number(lines[0][4])).not.toBe(Number(lines[1][4]))
      return { tip: Number(lines[0][1]), mouth: Number(lines[0][3]) }
    }
    expect(opens('cresc').tip).toBeLessThan(opens('cresc').mouth)
    expect(opens('dim').tip).toBeGreaterThan(opens('dim').mouth)
  })

  it('draws the slur as a filled lens, not a stroked arc — it is thick in the middle and thin at the tips', () => {
    // Two quadratics sharing their endpoints, filled between: one path, no stroke.
    expect(picture('slur')).toContain('<path')
    expect(picture('slur')).not.toContain('stroke=')
    expect(picture('slur').match(/Q/g)).toHaveLength(2)
  })
})
