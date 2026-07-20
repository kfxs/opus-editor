import { describe, it, expect, vi } from 'vitest'
import { buildTempoMenu } from './tempoMenu'
import { UNIT_GLYPH } from '../utils/tempoText'

/**
 * The tempo word menu's one job for now: turn a note-value row into the character the tempo STRING
 * stores. The subtlety worth pinning is the two-glyph split — the row you SEE is the SMuFL
 * metronome specimen, but what it INSERTS is the Unicode note `parseTempoText` reads back. Confuse
 * the two and the menu would drop a private-use codepoint into the string that the parser can't
 * see as a unit.
 */
describe('buildTempoMenu', () => {
  const leaves = (menu: ReturnType<typeof buildTempoMenu>) =>
    menu.filter((i): i is { label: string; onSelect: () => void; labelFont?: string } => 'onSelect' in i)

  it('offers the six note values, longest first', () => {
    const menu = leaves(buildTempoMenu({ unit: vi.fn() }))
    expect(menu).toHaveLength(6)
    // Each label is drawn in the notation font — a specimen, not a description.
    expect(menu.every(i => i.labelFont === 'music')).toBe(true)
  })

  it('inserts the Unicode note character, not the specimen glyph on the label', () => {
    const unit = vi.fn()
    const menu = leaves(buildTempoMenu({ unit }))

    // The quarter row: pick it and the caret should get ♩ (UNIT_GLYPH.q), the char the string keeps.
    const quarter = menu.find(i => i.label !== UNIT_GLYPH.q) // label is the SMuFL glyph, NOT ♩
    expect(quarter).toBeDefined()

    // Selecting every row inserts exactly the UNIT_GLYPH set, and nothing else.
    menu.forEach(i => i.onSelect())
    expect(unit.mock.calls.map(c => c[0])).toEqual([
      UNIT_GLYPH.w, UNIT_GLYPH.h, UNIT_GLYPH.q, UNIT_GLYPH['8'], UNIT_GLYPH['16'], UNIT_GLYPH['32'],
    ])
  })

  it('labels with the metronome glyph, which is distinct from the inserted char', () => {
    // The specimen (metNoteQuarterUp, PUA) and the model char (♩) must not be the same string, or
    // the "insert what the parser reads" contract would be trivially true by accident.
    const menu = leaves(buildTempoMenu({ unit: vi.fn() }))
    expect(menu.some(i => i.label === UNIT_GLYPH.q)).toBe(false)
  })
})
