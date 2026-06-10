import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { DynamicTextSource } from './DynamicTextSource'
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
  return { id: 'd1', beat: { num: 1, den: 1 }, kind: 'text', text, placement: 'below' }
}

describe('DynamicTextSource', () => {
  let render: Mock<() => void>

  beforeEach(() => {
    render = vi.fn()
  })

  it('getText returns the mark text, or empty string when absent', () => {
    const withText = new DynamicTextSource('d1', false, makeEngine(textDynamic('espr.')) as unknown as MusicEngine, () => null, render)
    expect(withText.getText()).toBe('espr.')

    const missing = new DynamicTextSource('d1', false, makeEngine(null) as unknown as MusicEngine, () => null, render)
    expect(missing.getText()).toBe('')
  })

  it('commit writes trimmed non-empty text and re-renders', () => {
    const engine = makeEngine(textDynamic(''))
    const source = new DynamicTextSource('d1', true, engine as unknown as MusicEngine, () => null, render)
    source.commit('  dolce  ')

    expect(engine.updateDynamic).toHaveBeenCalledWith('d1', { text: 'dolce' })
    expect(engine.removeDynamic).not.toHaveBeenCalled()
    expect(render).toHaveBeenCalledTimes(1)
  })

  it('empty commit on a NEW mark deletes it and re-renders', () => {
    const engine = makeEngine(textDynamic(''))
    const source = new DynamicTextSource('d1', true, engine as unknown as MusicEngine, () => null, render)
    source.commit('   ')

    expect(engine.removeDynamic).toHaveBeenCalledWith('d1')
    expect(engine.updateDynamic).not.toHaveBeenCalled()
    expect(render).toHaveBeenCalledTimes(1)
  })

  it('empty commit on an EXISTING mark is a no-op (keeps prior text)', () => {
    const engine = makeEngine(textDynamic('espr.'))
    const source = new DynamicTextSource('d1', false, engine as unknown as MusicEngine, () => null, render)
    source.commit('')

    expect(engine.removeDynamic).not.toHaveBeenCalled()
    expect(engine.updateDynamic).not.toHaveBeenCalled()
    expect(render).not.toHaveBeenCalled()
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
