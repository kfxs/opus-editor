import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest'
import { TempoTextSource } from './TempoTextSource'
import type { MusicEngine } from '../engine/MusicEngine'
import type { TempoMark } from '../types/music'

/** Minimal MusicEngine stand-in covering only what TempoTextSource touches. */
function makeEngine(mark: TempoMark | null) {
  return {
    getTempoMarkById: vi.fn((_id: string) => mark),
    updateTempoMark: vi.fn(),
    removeTempoMark: vi.fn(),
    setSuppressedTempoId: vi.fn(),
    // null → the source falls back to the registry bbox + fallback font (the no-DOM path
    // these tests run in). The real browser path measures the engraved <g> instead.
    getTempoSVGGroup: vi.fn((_id: string) => null),
    getElementRegistry: vi.fn(() => ({ getByType: () => [] as Array<{ id: string; bbox: unknown }> })),
  }
}

const mark = (extra: Partial<TempoMark>): TempoMark =>
  ({ id: 't1', beat: { num: 0, den: 1 }, ...extra })

const sourceFor = (m: TempoMark | null, isNew = false) => {
  const engine = makeEngine(m)
  const render: Mock<() => void> = vi.fn()
  const source = new TempoTextSource('t1', isNew, engine as unknown as MusicEngine, () => null, render)
  return { engine, render, source }
}

describe('TempoTextSource — editing the WORD', () => {
  it('seeds the overlay with the mark’s word', () => {
    expect(sourceFor(mark({ text: 'Allegro', bpm: 144 })).source.getText()).toBe('Allegro')
  })

  /**
   * Decision D2, and the whole reason `text` is free text rather than an enum: renaming
   * the word must NEVER move the tempo. The update must not carry bpm/unit/dots at all.
   */
  it('writes ONLY the word — bpm, unit and dots are not in the update', () => {
    const { engine, render, source } = sourceFor(
      mark({ text: 'Allegro', unit: 'h', dots: 1, bpm: 144, showMetronome: true }),
    )
    source.commit('  Allegro con brio  ')

    expect(engine.updateTempoMark).toHaveBeenCalledWith('t1', { text: 'Allegro con brio' })
    const [, updates] = engine.updateTempoMark.mock.calls[0]
    expect('bpm' in updates).toBe(false)
    expect('unit' in updates).toBe(false)
    expect('dots' in updates).toBe(false)
    expect(render).toHaveBeenCalled()
  })

  it('erasing the word KEEPS the mark when its metronome still says something', () => {
    // 'Allegro (♩ = 144)' → erase the word → a bare '♩ = 144' remains. Not a deletion.
    const s = sourceFor(mark({ text: 'Allegro', bpm: 144, showMetronome: true }))
    s.source.commit('   ')
    expect(s.engine.updateTempoMark).toHaveBeenCalledWith('t1', { text: undefined })
    expect(s.engine.removeTempoMark).not.toHaveBeenCalled()
  })

  it('erasing the word REMOVES a mark that would then say nothing at all', () => {
    // Word only (no printed number) → an empty word leaves an invisible, meaningless mark.
    const s = sourceFor(mark({ text: 'Allegro', bpm: 144, showMetronome: false }))
    s.source.commit('')
    expect(s.engine.removeTempoMark).toHaveBeenCalledWith('t1')
  })
})

describe('TempoTextSource — editing the NUMBER (a mark with no word)', () => {
  it('seeds the overlay with the bpm, not an empty string', () => {
    expect(sourceFor(mark({ unit: 'q', bpm: 120, showMetronome: true })).source.getText()).toBe('120')
  })

  it('writes ONLY the bpm — the unit and dots are untouched', () => {
    const s = sourceFor(mark({ unit: 'h', dots: 1, bpm: 60, showMetronome: true }))
    s.source.commit('90')
    expect(s.engine.updateTempoMark).toHaveBeenCalledWith('t1', { bpm: 90 })
    expect(s.render).toHaveBeenCalled()
  })

  it('rejects a non-numeric edit rather than producing a nonsense clock', () => {
    const s = sourceFor(mark({ unit: 'q', bpm: 120, showMetronome: true }))
    s.source.commit('fast')
    expect(s.engine.updateTempoMark).not.toHaveBeenCalled()
  })

  it('rejects an out-of-range bpm (0 would be an infinite clock)', () => {
    for (const bad of ['0', '-60', '5', '999']) {
      const s = sourceFor(mark({ unit: 'q', bpm: 120, showMetronome: true }))
      s.source.commit(bad)
      expect(s.engine.updateTempoMark, `bpm ${bad} must be rejected`).not.toHaveBeenCalled()
    }
  })

  it('accepts the range bounds', () => {
    for (const ok of ['20', '300']) {
      const s = sourceFor(mark({ unit: 'q', bpm: 120, showMetronome: true }))
      s.source.commit(ok)
      expect(s.engine.updateTempoMark).toHaveBeenCalledWith('t1', { bpm: Number(ok) })
    }
  })
})

describe('TempoTextSource — lifecycle', () => {
  let render: Mock<() => void>
  beforeEach(() => { render = vi.fn() })

  it('Escape on a freshly placed mark removes it; an existing one is untouched', () => {
    const fresh = makeEngine(mark({ text: 'Allegro' }))
    new TempoTextSource('t1', true, fresh as unknown as MusicEngine, () => null, render).cancel()
    expect(fresh.removeTempoMark).toHaveBeenCalledWith('t1')

    const existing = makeEngine(mark({ text: 'Allegro' }))
    new TempoTextSource('t1', false, existing as unknown as MusicEngine, () => null, render).cancel()
    expect(existing.removeTempoMark).not.toHaveBeenCalled()
  })

  it('hideOriginal suppresses the engraved mark, so no text is doubled under the overlay', () => {
    const { engine, source } = sourceFor(mark({ text: 'Allegro' }))
    source.hideOriginal(true)
    expect(engine.setSuppressedTempoId).toHaveBeenCalledWith('t1')
    source.hideOriginal(false)
    expect(engine.setSuppressedTempoId).toHaveBeenCalledWith(null)
  })
})

/**
 * The overlay must land ON the engraved mark, in the engraved font — so both are read off
 * the rendered <g> rather than derived. Deriving them was the bug: a hand-mapped SVG bbox
 * put the box in the wrong place, and a hardcoded font constant (VexFlow resolves
 * StaveTempo.name from its own Metrics — bold, its own text font) made it look nothing
 * like the engraving.
 */
describe('TempoTextSource — the overlay matches the engraving', () => {
  /** One `<text>` node as VexFlow paints it, with its own box and font. */
  function textNode(content: string, rect: { x: number; y: number; width: number; height: number }, fontSize: string) {
    return {
      textContent: content,
      getBoundingClientRect: () => rect,
      _fontSize: fontSize,
    } as unknown as SVGTextElement
  }

  /**
   * 'Allegro (♩ = 120)' as engraved: the WORD at font-size 14, and the notehead glyph at
   * font-size 25 — which, being far bigger, reaches HIGHER on the page (y 30 vs y 44).
   * Measuring the whole group would take y = 30 (the notehead's top) and put the caret
   * above the word. That was the bug.
   */
  function engravedGroup() {
    const word = textNode('Allegro', { x: 120, y: 44, width: 60, height: 14 }, '14px')
    const glyph = textNode('', { x: 190, y: 30, width: 12, height: 28 }, '25px')
    return {
      querySelectorAll: (sel: string) => (sel === 'text' ? [word, glyph] : []),
    } as unknown as SVGGElement
  }

  function engineWithGroup(m: TempoMark, group: SVGGElement | null) {
    return { ...makeEngine(m), getTempoSVGGroup: vi.fn((_id: string) => group) }
  }

  /** Stand in for the browser: report each fake node's own font. */
  function stubComputedStyle(): void {
    vi.stubGlobal('getComputedStyle', (el: { _fontSize?: string }) => ({
      fontFamily: 'Academico',
      fontSize: el._fontSize ?? '14px',
      fontStyle: 'normal',
      fontWeight: '700',
    }))
  }

  afterEach(() => vi.unstubAllGlobals())

  it('positions the overlay on the WORD, not on the taller notehead glyph beside it', () => {
    stubComputedStyle()
    const engine = engineWithGroup(mark({ text: 'Allegro', bpm: 120, showMetronome: true }), engravedGroup())
    const source = new TempoTextSource('t1', false, engine as unknown as MusicEngine, () => null, vi.fn())

    // The word's own painted box — NOT y:30, which is where the ♩ glyph starts.
    expect(source.getScreenRect()).toEqual({ x: 120, y: 44, width: 60, height: 14 })
  })

  it('takes the font from the WORD’s node, scaling only the size by the zoom', () => {
    stubComputedStyle()
    const engine = engineWithGroup(mark({ text: 'Allegro', bpm: 120, showMetronome: true }), engravedGroup())
    const source = new TempoTextSource('t1', false, engine as unknown as MusicEngine, () => null, vi.fn(), () => 2)

    expect(source.getFontCSS()).toEqual({
      fontFamily: 'Academico',
      fontSize: '28px', // the WORD's 14px × zoom 2 — never the glyph's 25px
      fontStyle: 'normal',
      fontWeight: '700', // StaveTempo engraves the word BOLD — the overlay must too
      color: '#000000',
    })
  })

  it('falls back to the registry bbox when the mark is not in the DOM', () => {
    const engine = engineWithGroup(mark({ text: 'Allegro' }), null)
    const source = new TempoTextSource('t1', false, engine as unknown as MusicEngine, () => null, vi.fn())
    expect(source.getScreenRect()).toEqual({ x: 0, y: 0, width: 0, height: 0 })
  })
})
