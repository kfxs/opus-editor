// @vitest-environment jsdom
/**
 * An augmentation dot of ours (S12c): what VexFlow's `Dot` added to the modifier contract. ⚠️ That it
 * draws, spaces and boxes exactly as before was proved on the page — 50 random scores (626 dotted
 * notes, 1,049 dot hit boxes), SVG and registry byte-identical against the previous commit
 * (`docs/vexflow-removal-map.md` S12c). Pinned here is the contract its readers rely on.
 */
import { describe, it, expect } from 'vitest'
import { EngravedDot } from './EngravedDot'
import { MODIFIER_POSITION } from './EngravedModifier'

describe('EngravedDot', () => {
  it('files as "Dot" and stands RIGHT of its note — the category string several readers compare', () => {
    const dot = new EngravedDot()
    expect(dot.getCategory()).toBe('Dot')
    expect(dot.getPosition()).toBe(MODIFIER_POSITION.RIGHT)
    expect(dot.getText()).toBe('') // augmentationDot
  })

  it('holds the vertical shift the column rule writes', () => {
    const dot = new EngravedDot()
    expect(dot.getShiftY()).toBe(0)
    dot.setShiftY(-0.5)
    expect(dot.getShiftY()).toBe(-0.5)
  })

  it('⚠️ keeps a WRITTEN width — until it is hung on a note, whose face it is then measured in', () => {
    const dot = new EngravedDot()
    const measured = dot.getWidth()
    dot.setWidth(measured + 4)
    expect(dot.getWidth()).toBe(measured + 4)
    dot.setNote({} as Parameters<EngravedDot['setNote']>[0])
    expect(dot.getWidth()).toBe(measured)
  })

  it('⭐ boxes itself with the width it was given — the reservation widens its hit box too', () => {
    const dot = new EngravedDot().setPosition('right')
    dot.setWidth(7)
    expect(dot.getBoundingBox().getW()).toBe(7)
  })
})
