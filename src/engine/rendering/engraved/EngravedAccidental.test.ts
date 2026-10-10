// @vitest-environment jsdom
/**
 * An accidental of ours (S12e): what VexFlow's `Accidental` added to the modifier contract. ⚠️ That it
 * draws, stacks and boxes exactly as before was proved on the page — 50 random scores (2,442
 * accidental hit boxes, dense chords, ledger notes, note offsets), SVG and registry byte-identical
 * against the previous commit (`docs/history/vexflow-removal-map.md` S12e). Its hit box is pinned in
 * `drawnHitBox.test.ts`; pinned here is the contract its readers rely on.
 */
import { describe, it, expect } from 'vitest'
import { EngravedAccidental } from './EngravedAccidental'
import { MODIFIER_POSITION } from './EngravedModifier'

describe('EngravedAccidental', () => {
  it('files as "Accidental", stands LEFT of its note, and keeps its sign — the column rule and the slur read `type`', () => {
    const sign = new EngravedAccidental('doubleFlat')
    expect(sign.getCategory()).toBe('Accidental')
    expect(sign.getPosition()).toBe(MODIFIER_POSITION.LEFT)
    expect(sign.type).toBe('doubleFlat')
  })

  it('⭐ stamps the SMuFL glyph of each of the five signs this editor writes', () => {
    const glyphs = (['sharp', 'doubleSharp', 'flat', 'doubleFlat', 'natural'] as const).map(s => new EngravedAccidental(s).getText().codePointAt(0)!.toString(16))
    expect(glyphs).toEqual(['e262', 'e263', 'e260', 'e264', 'e261'])
  })

  it('⛔ refuses a sign it has no glyph for, and a grace note — neither is ever built here', () => {
    expect(() => new EngravedAccidental('+' as never)).toThrow()
    const grace = { getCategory: () => 'GraceNote' } as unknown as Parameters<EngravedAccidental['setNote']>[0]
    expect(() => new EngravedAccidental('sharp').setNote(grace)).toThrow(/grace/)
  })

  it('⚠️ a LEFT sign: the column writes a NEGATED shift, and the note offset nudges ON TOP of it', () => {
    const sign = new EngravedAccidental('sharp')
    sign.setXShift(3)
    expect(sign.getXShift()).toBe(-3)
    sign.nudgeX(5)
    expect(sign.getXShift()).toBe(2)
  })
})

describe('EngravedAccidental — in BRACKETS (alteration-signs K3)', () => {
  it('⭐ carries the font’s own accidental brackets, E26A / E26B; a bare sign carries none', () => {
    const bracketed = new EngravedAccidental('sharp', 'round')
    expect([bracketed.enclosure?.left, bracketed.enclosure?.right].map(g => g!.codePointAt(0)!.toString(16))).toEqual(['e26a', 'e26b'])
    expect(new EngravedAccidental('sharp').enclosure).toBeNull()
    expect(bracketed.getText()).toBe(new EngravedAccidental('sharp').getText()) // the SIGN is unchanged
  })
})
