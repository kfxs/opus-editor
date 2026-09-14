import { describe, it, expect } from 'vitest'
import { METER_BOTTOM_LINE, METER_SYMBOL_LINE, METER_TOP_LINE, meterLayout } from './meterSign'

/**
 * ⭐ A time signature's rows are TODAY's picture, copied exactly from VexFlow's `TimeSignature`
 * (S4b0 of `docs/vexflow-removal-map.md`). ⚠️ Rows, not laws (rule 13).
 *
 * The widths are a named argument, so this spec hands in a ruler of its own: every glyph 10 px wide.
 */
const tenPerGlyph = (glyphs: string) => [...glyphs].length * 10

describe('meterLayout — what a time signature draws, as ours', () => {
  it('numerals are SMuFL timeSig digits, one per digit, upper row first', () => {
    const layout = meterLayout({ numerator: 12, denominator: 8 }, tenPerGlyph)
    expect(layout.numeric).toBe(true)
    expect(layout.rows.map(r => r.glyph)).toEqual(['', ''])
  })

  it('the upper row stands on line 1 and the lower on line 3', () => {
    const layout = meterLayout({ numerator: 3, denominator: 4 }, tenPerGlyph)
    expect(layout.rows.map(r => r.line)).toEqual([METER_TOP_LINE, METER_BOTTOM_LINE])
    expect([METER_TOP_LINE, METER_BOTTOM_LINE]).toEqual([1, 3])
  })

  it('⭐ the narrower row is centred over the wider, and the sign is as wide as the wider', () => {
    const layout = meterLayout({ numerator: 12, denominator: 8 }, tenPerGlyph)
    expect(layout.width).toBe(20)
    expect(layout.rows.map(r => r.dx)).toEqual([0, 5])
  })

  it('no Bravura numeral is tall enough for the half-line shift', () => {
    const layout = meterLayout({ numerator: 9, denominator: 16 }, tenPerGlyph)
    expect(layout.rows.map(r => r.line)).toEqual([1, 3])
  })

  it('common and cut time are one glyph each, on line 2', () => {
    const common = meterLayout({ numerator: 4, denominator: 4, symbol: 'common' }, tenPerGlyph)
    const cut = meterLayout({ numerator: 2, denominator: 2, symbol: 'cut' }, tenPerGlyph)
    expect(common.numeric).toBe(false)
    expect(common.rows).toEqual([{ glyph: '', dx: 0, line: METER_SYMBOL_LINE }])
    expect(cut.rows).toEqual([{ glyph: '', dx: 0, line: 2 }])
    expect(common.width).toBe(10)
  })

  it('in jsdom a row measures 0, and so does every offset — exactly as VexFlow answered there', () => {
    const layout = meterLayout({ numerator: 6, denominator: 8 }, () => 0)
    expect(layout.width).toBe(0)
    expect(layout.rows.map(r => r.dx)).toEqual([0, 0])
  })
})
