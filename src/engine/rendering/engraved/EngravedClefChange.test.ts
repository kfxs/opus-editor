// @vitest-environment jsdom
/**
 * An inline clef change of ours (S12j-e) — VexFlow's `ClefNote`, transcribed. ⚠️ jsdom measures the
 * glyph 0 wide, so what is pinned here is the contract and the ARITHMETIC of where it stands; that it
 * draws exactly where `ClefNote` drew is the Chromium A/B's (`docs/history/vexflow-removal-map.md` S12j-e).
 */
import { describe, it, expect } from 'vitest'
import type { DrawContext } from '@/engine/paint/DrawContext'
import { TICK_RESOLUTION } from '@/engine/layout/tickCount'
import { clefSign } from '@/engine/engrave/header/clefSign'
import { NOTE_AREA_PADDING_PX } from '@/engine/engrave/inheritedDefaults'
import { EngravedClefChange } from './EngravedClefChange'
import { EngravedStave } from './EngravedStave'
import { BarVoice } from '../format/barVoice'
import { createTickColumns } from '../format/columnFormat'
import { ColumnModifiers } from '../format/modifierColumns'
import { barFrame } from '../staff/staveFrame'

/** A surface that remembers what was stamped on it. */
function recorder() {
  const calls: unknown[][] = []
  const ctx = {
    save: () => calls.push(['save']),
    restore: () => calls.push(['restore']),
    setFont: (font: unknown) => calls.push(['setFont', font]),
    fillText: (text: string, x: number, y: number) => calls.push(['fillText', text, x, y]),
    openGroup: () => calls.push(['openGroup']),
    closeGroup: () => calls.push(['closeGroup']),
  } as unknown as DrawContext
  return { ctx, calls }
}

/** A clef change standing in its own column at x, on a stave, drawn through `ctx`. */
function drawn(clef: EngravedClefChange, columnX: number, ctx: DrawContext) {
  const stave = new EngravedStave(10, 40, 300)
  const voice = new BarVoice({ numerator: 4, denominator: 4 }, 'soft').add(clef)
  createTickColumns([voice]).array[0].setX(columnX)
  clef.setStave(stave)
  clef.setContext(ctx)
  clef.drawWithStyle()
  return stave
}

describe('EngravedClefChange', () => {
  it('⭐ is ignored by the voice, but still a 256th to the columns — `ClefNote`\'s duration `b`', () => {
    const clef = new EngravedClefChange('bass')
    expect(clef.shouldIgnoreTicks()).toBe(true)
    expect(clef.getTicks()).toEqual({ numerator: TICK_RESOLUTION / 256, denominator: 1 })
    const voice = new BarVoice({ numerator: 4, denominator: 4 }, 'soft').add(clef)
    expect(voice.ticksUsed.numerator).toBe(0)
  })

  it('files itself in its modifier column as a `ClefNote`, and its pre-format ⛔ never runs the column', () => {
    const clef = new EngravedClefChange('treble')
    const column = new ColumnModifiers()
    clef.addToModifierContext(column)
    expect(column.getMembers('ClefNote')).toEqual([clef])
    expect(() => clef.getWidth()).toThrow(/unformatted/)
    clef.preFormat()
    expect(column.preFormatted).toBe(false)
    expect(clef.getMetrics()).toMatchObject({ glyphWidth: 0, leftDisplacedHeadPx: 0, rightDisplacedHeadPx: 0 })
  })

  it('⭐ stamps the SMALL clef bare (no group), at its column on the note area, on the line it names', () => {
    const { ctx, calls } = recorder()
    const clef = new EngravedClefChange('bass')
    const stave = drawn(clef, 25, ctx)
    const sign = clefSign('bass', 'small')
    const x = 25 + barFrame(stave).noteStartX + NOTE_AREA_PADDING_PX
    expect(calls).toEqual([
      ['save'],
      ['setFont', sign.font],
      ['fillText', sign.glyph, x, stave.getYForLine(sign.line)],
      ['restore'],
    ])
    expect(clef.isRendered()).toBe(true)
  })

  it('⭐ the hand offset moves the GLYPH and its box — and the note\'s own `getXShift` stays 0', () => {
    const { ctx, calls } = recorder()
    const plain = new EngravedClefChange('alto')
    drawn(plain, 25, recorder().ctx)
    const shifted = new EngravedClefChange('alto')
    shifted.glyphShift = 7
    drawn(shifted, 25, ctx)
    const stamped = calls.find(c => c[0] === 'fillText')!
    expect(stamped[2]).toBe(plain.getBoundingBox().x + 7)
    expect(shifted.getBoundingBox().x).toBe(plain.getBoundingBox().x + 7)
    expect(shifted.getXShift()).toBe(0)
  })

  it('draws on its INK surface when handed one — the pass\'s, so the scene sees it', () => {
    const voice = recorder()
    const ink = recorder()
    const clef = new EngravedClefChange('treble')
    clef.setInkSurface(ink.ctx)
    drawn(clef, 0, voice.ctx)
    expect(ink.calls.some(c => c[0] === 'fillText')).toBe(true)
    expect(voice.calls.some(c => c[0] === 'fillText')).toBe(false)
  })
})
