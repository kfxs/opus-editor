// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import type { DrawContext } from '@/engine/paint/DrawContext'
import { drawGlyph, drawTextRun, measureGlyph } from './glyphPainter'

/**
 * ⭐⭐ **THE CONTRACT IS EQUIVALENCE**, and that is the only thing worth asserting here.
 *
 * This module was extracted from nine files that each wrote the same four lines by hand
 * (`docs/plans/own-engraving-engine.md` P1). Its whole job is to emit *exactly* what they emitted — a
 * hand-built VexFlow `Element` (`setText` + `setFontSize` + `renderText`). ⭐ Since S14 VexFlow is gone,
 * so what that `Element` emitted is PINNED as literals ({@link BY_HAND}), recorded from VexFlow 5.0.0
 * on 2026-09-19 just before the package was removed. ⛔ A test that only checked "it called fillText
 * once" would pass just as happily on an adapter that had lost the font, the shift or the baseline.
 *
 * ⚠️ **No width is asserted, on purpose.** A glyph's width measures through a canvas jsdom does
 * not have, so every glyph here is 0 wide — see `reference: jsdom cannot measure glyphs`. Asserting
 * a width would be asserting a zero and agreeing with itself. The drawn positions live in the
 * browser suite (`e2e/trill.e2e.ts`, `e2e/keySignature.e2e.ts`, `e2e/barlineTypes.e2e.ts` all cover
 * glyphs this module now stamps).
 */

type Call = { fn: string; args: unknown[] }

/** A context that records rather than paints — `renderText` only ever calls these two. */
function recorder(): { ctx: DrawContext; calls: Call[] } {
  const calls: Call[] = []
  const ctx = {
    setFont: (...args: unknown[]) => { calls.push({ fn: 'setFont', args }); return ctx },
    fillText: (...args: unknown[]) => { calls.push({ fn: 'fillText', args }); return ctx },
  } as unknown as DrawContext
  return { ctx, calls }
}

/**
 * What the four hand-written lines — `new Element(tag)`, `setText`, `setFontSize(sizePt)`,
 * `renderText(ctx, x, y)` — sent to the context, recorded from VexFlow 5.0.0. ⚠️ The two tags resolve
 * to different WEIGHTS: that difference is VexFlow's `Metrics` tree, now `fonts/fontCategories`.
 */
const BY_HAND = {
  /** `('BarlineRenderer.wing', U+E040, 30pt, 12.5, 70)` */
  wing: [
    { fn: 'setFont', args: [{ family: 'Bravura,Academico', size: '30pt', weight: 'normal', style: 'normal' }] },
    { fn: 'fillText', args: ['\ue040', 12.5, 70] },
  ],
  /** `('StaveTempo.name', 'Allegro', 14pt, 0, 0)` */
  tempoName: [
    { fn: 'setFont', args: [{ family: 'Bravura,Academico', size: '14pt', weight: 'bold', style: 'normal' }] },
    { fn: 'fillText', args: ['Allegro', 0, 0] },
  ],
} satisfies Record<string, Call[]>

describe('drawGlyph', () => {
  it('⭐⭐ emits exactly what the hand-written Element emitted — font AND baseline', () => {
    const { ctx, calls } = recorder()
    drawGlyph(ctx, 'BarlineRenderer.wing', '', 12.5, 70, 30)
    expect(calls).toEqual(BY_HAND.wing)
  })

  it('puts the glyph at the x and y it was given — the y is the BASELINE', () => {
    const { ctx, calls } = recorder()
    drawGlyph(ctx, 'TrillRenderer.sign', 'tr', 40, 12, 26)
    expect(calls.find(c => c.fn === 'fillText')?.args).toEqual(['tr', 40, 12])
  })

  // 🚨 The break-test for the one above: the tag is not decoration, it resolves the FONT
  // (VexFlow's `Element` did `Metrics.getFontInfo(tag)`; ours is `categoryFont`), so two different
  // tags must be able to differ. Ours all fall through to the same default; a VexFlow category does not.
  it('🚨 carries the TAG into the font resolution, not into the ink', () => {
    const { ctx, calls } = recorder()
    drawGlyph(ctx, 'StaveTempo.name', 'Allegro', 0, 0, 14)
    expect(calls[0]?.fn).toBe('setFont')
    expect(calls[0]?.args).toEqual(BY_HAND.tempoName[0].args)
    expect(calls[0]?.args).not.toEqual(BY_HAND.wing[0].args)
    expect(calls.find(c => c.fn === 'fillText')?.args).toEqual(['Allegro', 0, 0])
  })
})

describe('drawTextRun', () => {
  it('⭐ sets the named face — the family the caller asked for, in points', () => {
    const { ctx, calls } = recorder()
    drawTextRun(ctx, 'TrillRenderer.paren', '(', 5, 60, { family: 'Times', sizePt: 18, style: 'italic' })
    const font = calls[0]?.args[0] as { family: string; size: unknown; style: string; weight: string }
    expect(calls[0]?.fn).toBe('setFont')
    expect(font.family).toBe('Times')
    expect(font.style).toBe('italic')
    // ⚠️ Defaulted, not dropped: the hand-written sites all passed 'normal' explicitly.
    expect(font.weight).toBe('normal')
    expect(calls.find(c => c.fn === 'fillText')?.args).toEqual(['(', 5, 60])
  })
})

describe('measureGlyph', () => {
  // ⭐ The honest answer with no canvas, and the callers are written for it: the trill's wiggle
  // returns rather than looping forever, and the pedal's release right-aligns on 0.
  it('is 0 when the font cannot be measured, and does not throw', () => {
    expect(measureGlyph('TrillRenderer.wiggle', '', 26)).toBe(0)
  })
})
