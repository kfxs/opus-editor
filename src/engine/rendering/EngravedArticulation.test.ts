// @vitest-environment jsdom
/**
 * An articulation of ours (S12f): what VexFlow's `Articulation` added to the modifier contract. ⚠️ Its
 * placement is pinned in `engrave/notes/articulationPlacement.test.ts`, and exactness was proved on the
 * page (`docs/history/vexflow-removal-map.md` S12f). Pinned here is the contract its readers rely on.
 */
import { describe, it, expect } from 'vitest'
import { EngravedArticulation } from './EngravedArticulation'
import { MODIFIER_POSITION } from './EngravedModifier'

const codeOf = (mark: EngravedArticulation) => mark.getText().codePointAt(0)!.toString(16)

describe('EngravedArticulation', () => {
  it('files as "Articulation", above by default — the category string the registry scans for', () => {
    const mark = new EngravedArticulation('a>')
    expect(mark.getCategory()).toBe('Articulation')
    expect(mark.getPosition()).toBe(MODIFIER_POSITION.ABOVE)
    expect(mark.canSitBetweenLines()).toBe(true)
  })

  it('⭐ stamps its row\'s ABOVE glyph above and its BELOW glyph otherwise — the staccato is one dot either way', () => {
    expect(codeOf(new EngravedArticulation('a>'))).toBe('e4a0')
    expect(codeOf(new EngravedArticulation('a>').setPosition('below'))).toBe('e4a1')
    expect(codeOf(new EngravedArticulation('a-').setPosition('below'))).toBe('e4a5')
    expect(codeOf(new EngravedArticulation('a.'))).toBe('e1e7')
    expect(codeOf(new EngravedArticulation('a.').setPosition('below'))).toBe('e1e7')
  })

  it('⛔ refuses a mark it has no row for', () => {
    expect(() => new EngravedArticulation('a^')).toThrow()
  })

  it('⚠️ centres by `Element.setOrigin`: the shifts that put the box\'s (0.5, 0.5) on its point', () => {
    const mark = new EngravedArticulation('a>')
    // jsdom measures nothing, so the box is 0 × 0 — and VexFlow's division gives NaN, as on its page there.
    mark.setOrigin(0.5, 0.5)
    expect(Number.isNaN(mark.getXShift())).toBe(true)
  })

  it('⭐ its ink is the placed point with the shifts folded in — and `moveX` carries it along the staff (the fan)', () => {
    const mark = new EngravedArticulation('a-').setPosition('right')
    mark.setXShift(2).setYShift(3)
    mark.moveX(10)
    const ink = mark.inkAt()
    expect([ink.x, ink.y]).toEqual([12, 3])
    expect(ink.glyph.codePointAt(0)!.toString(16)).toBe('e4a5') // not ABOVE ⇒ its below glyph
  })
})
