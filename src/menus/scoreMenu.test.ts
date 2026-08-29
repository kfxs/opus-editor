import { describe, it, expect, vi } from 'vitest'
import { buildScoreMenu, type ScoreMenuActions } from './scoreMenu'
import { isSeparator, type MenuItem } from './MenuItem'

/**
 * The **Score** menu's grouping-sign rows — his ask, 2026-08-29: *"in the score menu, before the
 * title section, we can add a new section Insert Brace / Insert Bracket that should be wired like
 * the palette."*
 *
 * ⭐ The claim worth pinning is **the wiring, not the labels**: a row must run the command the app
 * already had (`PaletteController.pressGroupSymbol`), which is this menu's whole rule — *"every ROW
 * runs a command that already existed… deleting the bar deletes a list of LABELS"* (`./index`).
 */
type Leaf = Extract<MenuItem, { onSelect: () => void }>
const isLeaf = (i: MenuItem): i is Leaf => 'onSelect' in i
const rowOf = (items: MenuItem[], label: string): Leaf =>
  items.filter(isLeaf).find(r => r.label === label)!

describe('buildScoreMenu — the grouping signs', () => {
  const build = (over: Partial<ScoreMenuActions> = {}) => {
    const brace = vi.fn()
    const bracket = vi.fn()
    const items = buildScoreMenu({
      insertBrace: { run: brace }, insertBracket: { run: bracket }, ...over,
    }).items
    return { items, brace, bracket }
  }

  it('⭐ both rows exist', () => {
    const { items } = build()
    expect(rowOf(items, 'Insert Brace')).toBeDefined()
    expect(rowOf(items, 'Insert Bracket')).toBeDefined()
  })

  it('⭐⭐ each RUNS the palette command — ⛔ nothing is reimplemented in a menu', () => {
    const { items, brace, bracket } = build()
    rowOf(items, 'Insert Brace').onSelect()
    expect(brace).toHaveBeenCalledOnce()
    rowOf(items, 'Insert Bracket').onSelect()
    expect(bracket).toHaveBeenCalledOnce()
  })

  it('⭐⭐ ALWAYS ENABLED — an empty selection is a legal input, ⛔ not a missing one', () => {
    // APPLIES-else-ARMS: with nothing selected the press ARMS a stamp and the next click says where.
    // ⛔ Unlike the four structure rows above, which grey out because they have nothing to act on.
    const { items } = build()
    expect(rowOf(items, 'Insert Brace').disabled?.()).toBe(false)
    expect(rowOf(items, 'Insert Bracket').disabled?.()).toBe(false)
  })

  it('⚠️ an UNWIRED row is greyed, ⛔ not silently dead', () => {
    const items = buildScoreMenu({}).items
    expect(rowOf(items, 'Insert Brace').disabled?.()).toBe(true)
  })

  it('⭐ they sit BEFORE the title section, in a group of their own', () => {
    const { items } = build({ addTitle: { run: () => {} } })
    const labels = items.map(i => (isSeparator(i) ? '---' : isLeaf(i) ? i.label : '?'))
    const brace = labels.indexOf('Insert Brace')
    const title = labels.indexOf('Add Title…')
    expect(brace).toBeGreaterThan(-1)
    expect(brace).toBeLessThan(title)
    // A separator on each side — the argument the menu's own comment makes: a row that greys and a
    // row that cannot should not share a block.
    expect(labels[brace - 1]).toBe('---')
    expect(labels[labels.indexOf('Insert Bracket') + 1]).toBe('---')
  })

  it('⛔ no sub-bracket row — his call: console only', () => {
    const { items } = build()
    expect(items.filter(isLeaf).some(r => /sub/i.test(String(r.label ?? '')))).toBe(false)
  })
})
