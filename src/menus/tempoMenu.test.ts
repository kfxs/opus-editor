import { describe, it, expect, vi } from 'vitest'
import { buildTempoMenu } from './tempoMenu'
import { UNIT_GLYPH } from '../utils/tempoText'
import { isColumnBreak, isSeparator, type MenuItem } from './MenuItem'

type Leaf = Extract<MenuItem, { onSelect: () => void }>
const isLeaf = (i: MenuItem): i is Leaf => 'onSelect' in i

/**
 * The trimmed tempo menu: two columns — the Italian words, then the note-value ladder plus the
 * modulation building blocks and the eszett. The subtlety worth pinning is the note-value split:
 * a note row SHOWS its SMuFL metronome specimen but INSERTS the Unicode note char parseTempoText
 * reads back — confuse them and the parser gets a private-use codepoint it can't see as a unit.
 */
describe('buildTempoMenu', () => {
  // Build once with a spy; a row's insertion is read by selecting it.
  const build = () => {
    const text = vi.fn()
    return { menu: buildTempoMenu({ text }), text }
  }
  const leaves = (menu: MenuItem[]) => menu.filter(isLeaf)
  const insertOf = (text: ReturnType<typeof vi.fn>, row: Leaf): string | undefined => {
    text.mockClear()
    row.onSelect()
    const calls = text.mock.calls
    return calls.length ? calls[calls.length - 1][0] : undefined
  }
  const noteChars = new Set(Object.values(UNIT_GLYPH))

  it('lays the palette out in TWO columns with two dividers', () => {
    const { menu } = build()
    expect(menu.filter(isColumnBreak)).toHaveLength(1)
    expect(menu.filter(isSeparator)).toHaveLength(2)
  })

  it('offers the Italian tempo words BOLD and inserts them verbatim', () => {
    const { menu, text } = build()
    const words = leaves(menu).filter(i => i.labelFont === 'bold')
    for (const w of ['Allegro', 'Moderato', 'A tempo', 'Meno mosso', 'Tempo primo']) {
      const row = words.find(i => i.label === w)
      expect(row, `"${w}"`).toBeDefined()
      expect(insertOf(text, row!)).toBe(w)
    }
  })

  it('keeps only the German eszett from the accent bank, and sets it bold', () => {
    const { menu, text } = build()
    const row = leaves(menu).find(i => i.label === 'ß')
    expect(row).toBeDefined()
    expect(row!.labelFont).toBe('bold')
    expect(insertOf(text, row!)).toBe('ß')
    // The French/Italian accents and the curly quotes/em dash were dropped.
    for (const ch of ['à', 'é', 'ü', '‘', '—']) {
      expect(leaves(menu).some(i => i.label === ch), ch).toBe(false)
    }
  })

  it('drops every metronome note value as its Unicode note char, not the specimen glyph', () => {
    const { menu, text } = build()
    // The note-value LABEL is the SMuFL specimen, never the Unicode ♩ — so this is a real split.
    const noteStyle = leaves(menu).filter(i => i.labelFont === 'note')
    expect(noteStyle.some(i => i.label === UNIT_GLYPH.q)).toBe(false)
    const dropped = new Set(leaves(menu).map(i => insertOf(text, i)))
    for (const g of noteChars) expect(dropped.has(g), g).toBe(true)
  })

  it('orders the note ladder shortest → longest (fusa … redonda)', () => {
    const { menu, text } = build()
    const ladder = leaves(menu).map(i => insertOf(text, i)).filter((s): s is string => noteChars.has(s!))
    expect(ladder).toEqual([
      UNIT_GLYPH['32'], UNIT_GLYPH['16'], UNIT_GLYPH['8'], UNIT_GLYPH.q, UNIT_GLYPH.h, UNIT_GLYPH.w,
    ])
  })

  it('labels the ladder with NUMERIC-KEYPAD shortcuts: fusa = Ctrl+Num 1, redonda = Ctrl+Num 6', () => {
    const { menu, text } = build()
    const byInsert = (glyph: string) => leaves(menu).find(i => insertOf(text, i) === glyph)
    expect(byInsert(UNIT_GLYPH['32'])?.shortcut).toBe('Ctrl+Num 1') // fusa (32nd), top of the ladder
    expect(byInsert(UNIT_GLYPH.w)?.shortcut).toBe('Ctrl+Num 6')     // redonda (whole), bottom
  })

  it('inserts the metric-modulation equation with its ♩/♪ notes intact', () => {
    const { menu, text } = build()
    // The equation's label shows Bravura; what it DROPS keeps the parseable ♩ = ♪ so the mark engraves.
    const eq = leaves(menu).map(i => insertOf(text, i)).find(s => s?.includes(' = ') && s.includes(UNIT_GLYPH.q))
    expect(eq, 'equation row').toBeDefined()
    expect(eq).toContain(UNIT_GLYPH.q)
    expect(eq).toContain(UNIT_GLYPH['8'])
  })
})
