import { describe, it, expect, vi } from 'vitest'
import { buildCreateMenu, type InsertMenuActions } from './insertMenu'
import { BARLINE_SIGNS } from '@/interactions/barlineStamp'
import type { MenuItem } from './MenuItem'
import type { WindowLayer } from '@/windows/WindowLayer'

/**
 * **Insert ▸ Barline** — his ask, 2026-08-26, from a screenshot of Sibelius's own submenu.
 *
 * ⭐ The claim this file exists for is the one the compiler cannot make: **every sign the palette can
 * place has a row, and every row names a sign that exists.** A menu whose rows are strings drifts
 * from the table silently — both keep working, they just stop agreeing (`buildCreateMenu`'s own rule
 * about two lists of the same commands).
 *
 * ⛔ Nothing here opens a menu or clicks anything: `MenuLayer`'s tests own the primitive. This reads
 * the TREE, which is data.
 */
const windows = {} as WindowLayer

/** The submenu's rows, by label — the tree is data, so this is a lookup and not a click. */
function barlineRows(actions: InsertMenuActions = {}): MenuItem[] {
  const barline = buildCreateMenu(actions, windows).items
    .find((item): item is MenuItem & { items: MenuItem[] } =>
      'label' in item && item.label === 'Barline' && 'items' in item)
  expect(barline, 'Insert ▸ Barline').toBeDefined()
  return barline!.items
}

const labelsOf = (rows: MenuItem[]) => rows.flatMap(r => ('label' in r && typeof r.label === 'string' ? [r.label] : []))

describe('Insert ▸ Barline', () => {
  it("⭐ is Sibelius's own order: the punctuating signs, a rule, then how the ordinary line is drawn", () => {
    expect(labelsOf(barlineRows())).toEqual([
      'Start Repeat', 'End Repeat', 'Final', 'Invisible', 'Normal',
    ])
  })

  it('…with the separator between the two groups, which is what makes them groups', () => {
    const rows = barlineRows()
    const rule = rows.findIndex(r => 'separator' in r)
    expect(rule, 'after Final').toBe(3)
  })

  it('🚨 EVERY sign the palette can place has a row — a table and a menu that stop agreeing', () => {
    // The drift this file exists to catch: a sixth sign (the thin double `||`) is a row in
    // `BARLINE_SIGNS` and would be silently absent from the menu.
    const pressed: string[] = []
    const rows = barlineRows({ pressBarline: (sign) => pressed.push(sign) })
    for (const row of rows) if ('onSelect' in row) row.onSelect?.()
    expect([...pressed].sort()).toEqual(Object.keys(BARLINE_SIGNS).sort())
  })

  it('⭐ a row runs the PALETTE\'s command, ⛔ never a second implementation of it', () => {
    // `pressBarline` is exactly what the dev toolbar's buttons call: apply to a selected line, else
    // arm the stamp. A menu that re-implemented "place a barline" would drift the first time the
    // gesture changed — and it changed twice on the day it was written.
    const pressBarline = vi.fn()
    const rows = barlineRows({ pressBarline })
    const startRepeat = rows.find(r => 'label' in r && r.label === 'Start Repeat')
    expect(startRepeat && 'onSelect' in startRepeat).toBe(true)
    ;(startRepeat as { onSelect?: () => void }).onSelect?.()
    expect(pressBarline).toHaveBeenCalledWith('repeatStart')
  })

  it('⛔ declines quietly before the app has wired its actions — rows are built first', () => {
    // Every leaf reads `actions` at CLICK time through the shared object, so the menu can be built
    // before the app fills it in. A row pressed in that window must do nothing, not throw.
    const rows = barlineRows({})
    for (const row of rows) if ('onSelect' in row) expect(() => row.onSelect?.()).not.toThrow()
  })
})
