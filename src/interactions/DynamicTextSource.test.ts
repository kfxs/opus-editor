import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { DynamicTextSource } from './DynamicTextSource'
import { levelToGlyphString } from '../utils/dynamics'
import { DYNAMIC_GLYPH_SIZE } from '../engine/rendering/dynamicStyle'
import type { MusicEngine } from '../engine/MusicEngine'
import type { Dynamic } from '../types/music'

/** Minimal MusicEngine stand-in covering only what DynamicTextSource touches. */
function makeEngine(dyn: Dynamic | null) {
  const group = { style: { opacity: '1' } } as unknown as SVGGElement
  return {
    getDynamicById: vi.fn((_id: string) => dyn),
    updateDynamic: vi.fn(),
    removeDynamic: vi.fn(),
    getDynamicSVGGroup: vi.fn((_id: string) => group),
    setSuppressedDynamicId: vi.fn(),
    getElementRegistry: vi.fn(() => ({ getByType: () => [] as Array<{ id: string; bbox: unknown }> })),
    _group: group,
  }
}

function textDynamic(text: string): Dynamic {
  return { id: 'd1', beat: { num: 1, den: 1 }, text, placement: 'below' }
}

/** `level` is any run of dynamics-font LETTERS — a full level ('mp') or a single glyph char
 *  ('m', which only names a level once combined with a p/f). */
function levelDynamic(level: string): Dynamic {
  // A level IS its SMuFL glyph (the dynamic font), not the ASCII letters.
  return { id: 'd1', beat: { num: 1, den: 1 }, text: levelToGlyphString(level), placement: 'below' }
}

describe('DynamicTextSource', () => {
  let render: Mock<() => void>

  beforeEach(() => {
    render = vi.fn()
  })

  it('getText seeds from the mark as painted — custom text, or the level GLYPH', () => {
    const withText = new DynamicTextSource('d1', false, makeEngine(textDynamic('espr.')) as unknown as MusicEngine, () => null, render)
    expect(withText.getText()).toBe('espr.')

    // A level mark opens the editor showing its actual SMuFL glyph (so the box reads
    // as the bold dynamic, not a plain 'mf'); commit maps it back to ASCII.
    const withLevel = new DynamicTextSource('d1', false, makeEngine(levelDynamic('mf')) as unknown as MusicEngine, () => null, render)
    expect(withLevel.getText()).toBe(levelToGlyphString('mf'))
    expect(withLevel.getText()).not.toBe('mf')

    const missing = new DynamicTextSource('d1', false, makeEngine(null) as unknown as MusicEngine, () => null, render)
    expect(missing.getText()).toBe('')
  })

  it('commit stores the box text VERBATIM — a glyph stays a glyph (still a level)', () => {
    const engine = makeEngine(levelDynamic('p'))
    const source = new DynamicTextSource('d1', false, engine as unknown as MusicEngine, () => null, render)
    source.commit(`  ${levelToGlyphString('f')}  `)

    expect(engine.updateDynamic).toHaveBeenCalledWith('d1', { text: levelToGlyphString('f') })
    expect(engine.removeDynamic).not.toHaveBeenCalled()
    expect(render).toHaveBeenCalledTimes(1)
  })

  it('a plain typed letter is NOT promoted to a dynamic — only the glyph is a level', () => {
    const engine = makeEngine(levelDynamic('f'))
    const source = new DynamicTextSource('d1', false, engine as unknown as MusicEngine, () => null, render)
    source.commit('  p  ') // plain ASCII 'p', not the glyph

    expect(engine.updateDynamic).toHaveBeenCalledWith('d1', { text: 'p' })
    expect(engine.removeDynamic).not.toHaveBeenCalled()
  })

  it('commit of a plain word stores it as expression text', () => {
    const engine = makeEngine(levelDynamic('f'))
    const source = new DynamicTextSource('d1', false, engine as unknown as MusicEngine, () => null, render)
    source.commit('  dolce  ')

    expect(engine.updateDynamic).toHaveBeenCalledWith('d1', { text: 'dolce' })
    expect(engine.removeDynamic).not.toHaveBeenCalled()
    expect(render).toHaveBeenCalledTimes(1)
  })

  it('empty commit deletes the mark (clearing the box removes it)', () => {
    const engine = makeEngine(textDynamic('espr.'))
    const source = new DynamicTextSource('d1', false, engine as unknown as MusicEngine, () => null, render)
    source.commit('   ')

    expect(engine.removeDynamic).toHaveBeenCalledWith('d1')
    expect(engine.updateDynamic).not.toHaveBeenCalled()
    expect(render).toHaveBeenCalledTimes(1)
  })

  it('cancel deletes a NEW mark but leaves an existing one untouched', () => {
    const newEngine = makeEngine(textDynamic(''))
    new DynamicTextSource('d1', true, newEngine as unknown as MusicEngine, () => null, render).cancel()
    expect(newEngine.removeDynamic).toHaveBeenCalledWith('d1')
    expect(render).toHaveBeenCalledTimes(1)

    const existingEngine = makeEngine(textDynamic('espr.'))
    const r2: Mock<() => void> = vi.fn()
    new DynamicTextSource('d1', false, existingEngine as unknown as MusicEngine, () => null, r2).cancel()
    expect(existingEngine.removeDynamic).not.toHaveBeenCalled()
    expect(r2).not.toHaveBeenCalled()
  })

  it('getSeedHtml sizes glyph runs big (bare level AND mixed); null only for pure text', () => {
    // A real mixed mark: the `mp` is the SMuFL glyph (the dynamic font), then the word ` dolce`.
    const mixed = new DynamicTextSource('d1', false, makeEngine(textDynamic(`${levelToGlyphString('mp')} dolce`)) as unknown as MusicEngine, () => null, render)
    const html = mixed.getSeedHtml()!
    expect(html).toContain(`font-size:${DYNAMIC_GLYPH_SIZE}pt`) // glyph run drawn big
    expect(html).toContain('contenteditable="false"')          // …as an ATOMIC chip
    expect(html).toContain(levelToGlyphString('mp'))            // the mp glyph
    expect(html).toContain('dolce')                            // the word, unstyled (text size)

    // A BARE level is styled too — its glyph is a big span, so anything typed around it
    // (the box base is the small text size) comes out expression-sized right away.
    const bare = new DynamicTextSource('d1', false, makeEngine(levelDynamic('f')) as unknown as MusicEngine, () => null, render).getSeedHtml()!
    expect(bare).toContain(`font-size:${DYNAMIC_GLYPH_SIZE}pt`)
    expect(bare).toContain(levelToGlyphString('f'))

    // Pure text has no glyph run → seeded as plain text (no HTML).
    expect(new DynamicTextSource('d1', false, makeEngine(textDynamic('dolce')) as unknown as MusicEngine, () => null, render).getSeedHtml()).toBeNull()
  })

  // The six letters VexFlow's TextDynamics.GLYPHS defines. `z` carries Shift (Ctrl+Z is Undo
  // while typing — Sibelius dodges it the same way).
  it.each(['f', 'p', 'm', 'r', 's', 'z'])('Ctrl+%s inserts that GLYPH chip — the dynamic font, not the ASCII letter', letter => {
    const source = new DynamicTextSource('d1', false, makeEngine(textDynamic('dolce')) as unknown as MusicEngine, () => null, render)
    const insertion = source.getInsertions().find(i => i.key === letter)!

    expect(insertion.ctrl).toBe(true)
    expect(insertion.shift ?? false).toBe(letter === 'z')
    expect(insertion.html).toContain(levelToGlyphString(letter))        // the SMuFL glyph…
    expect(insertion.html).not.toMatch(new RegExp(`>${letter}<`))       // …never the ASCII letter (that would be silent)
    // Identical markup to a seeded chip, so an inserted glyph is atomic and reads back the same.
    expect(insertion.html).toBe(
      new DynamicTextSource('d1', false, makeEngine(levelDynamic(letter)) as unknown as MusicEngine, () => null, render).getSeedHtml(),
    )
  })

  it('getFontCSS matches the engraving (italic, point size)', () => {
    const source = new DynamicTextSource('d1', false, makeEngine(null) as unknown as MusicEngine, () => null, render)
    const css = source.getFontCSS()
    expect(css.fontStyle).toBe('italic')
    expect(css.fontSize).toMatch(/pt$/)
    expect(css.fontFamily).toContain('serif')
  })

  it('hideOriginal suppresses the glyph from the render and restores it', () => {
    const engine = makeEngine(textDynamic('espr.'))
    const source = new DynamicTextSource('d1', false, engine as unknown as MusicEngine, () => null, render)

    source.hideOriginal(true)
    expect(engine.setSuppressedDynamicId).toHaveBeenLastCalledWith('d1')
    source.hideOriginal(false)
    expect(engine.setSuppressedDynamicId).toHaveBeenLastCalledWith(null)
    expect(render).toHaveBeenCalledTimes(2) // one re-render per toggle
  })

  it('getScreenRect returns zeros when there is no canvas/svg', () => {
    const source = new DynamicTextSource('d1', false, makeEngine(textDynamic('x')) as unknown as MusicEngine, () => null, render)
    expect(source.getScreenRect()).toEqual({ x: 0, y: 0, width: 0, height: 0 })
  })
})
