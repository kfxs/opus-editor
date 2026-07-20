import { describe, it, expect, vi } from 'vitest'
import { buildTempoMenu } from './tempoMenu'
import { UNIT_GLYPH } from '../utils/tempoText'
import { isColumnBreak, isSeparator, type MenuItem } from './MenuItem'

type Leaf = Extract<MenuItem, { onSelect: () => void }>
const isLeaf = (i: MenuItem): i is Leaf => 'onSelect' in i

/**
 * The tempo word menu carries three kinds of row, and the one subtlety worth pinning is the
 * note-value split: the row you SEE is the SMuFL metronome specimen, but what it INSERTS is the
 * Unicode note `parseTempoText` reads back. Confuse the two and the menu would drop a private-use
 * codepoint into the string that the parser can't see as a unit. Words and arrows are inserted
 * verbatim, so their label is what they place.
 */
describe('buildTempoMenu', () => {
  const leaves = (menu: MenuItem[]) => menu.filter(isLeaf)

  it('lays out two columns: words, then note values and arrows', () => {
    const menu = buildTempoMenu({ text: vi.fn() })
    expect(menu.filter(isColumnBreak)).toHaveLength(1)
    expect(menu.filter(isSeparator)).toHaveLength(1) // between the note values and the arrows
  })

  it('offers the Italian tempo words BOLD and inserts them verbatim', () => {
    const text = vi.fn()
    const words = leaves(buildTempoMenu({ text })).filter(i => i.labelFont === 'bold')
    expect(words).toHaveLength(19)
    // A representative sample must be present, each inserting exactly its own label.
    for (const w of ['Allegro', 'Moderato', 'A tempo', 'Meno mosso', 'Tempo primo']) {
      const row = words.find(i => i.label === w)
      expect(row, `"${w}" row`).toBeDefined()
      row!.onSelect()
      expect(text).toHaveBeenLastCalledWith(w)
    }
  })

  it('inserts the Unicode note character, not the specimen glyph on the label', () => {
    const text = vi.fn()
    const menu = leaves(buildTempoMenu({ text }))
    const notes = menu.filter(i => i.labelFont === 'music')
    expect(notes).toHaveLength(6)
    // The label is the SMuFL metronome glyph, never the Unicode ♩ — so this is a real distinction.
    expect(notes.some(i => i.label === UNIT_GLYPH.q)).toBe(false)

    notes.forEach(i => i.onSelect())
    expect(text.mock.calls.map(c => c[0])).toEqual([
      UNIT_GLYPH.w, UNIT_GLYPH.h, UNIT_GLYPH.q, UNIT_GLYPH['8'], UNIT_GLYPH['16'], UNIT_GLYPH['32'],
    ])
  })

  it('labels the note values with the picture’s keypad shortcuts, whole = Ctrl+6', () => {
    const notes = leaves(buildTempoMenu({ text: vi.fn() })).filter(i => i.labelFont === 'music')
    // Whole is the longest note and the highest number; the 32nd is Ctrl+1.
    expect(notes[0].shortcut).toBe('Ctrl+6') // whole (first row)
    expect(notes[notes.length - 1].shortcut).toBe('Ctrl+1') // 32nd (last row)
  })

  it('offers the two metric-modulation arrows, with shortcuts, inserted verbatim', () => {
    const text = vi.fn()
    const arrows = leaves(buildTempoMenu({ text })).filter(i => i.label === '←' || i.label === '→')
    expect(arrows).toHaveLength(2)
    expect(arrows.map(i => i.shortcut)).toEqual(['Ctrl+¡', "Ctrl+'"])
    arrows.forEach(i => i.onSelect())
    expect(text.mock.calls.map(c => c[0])).toEqual(['←', '→'])
  })
})
