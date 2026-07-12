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

/**
 * The mark is edited as ONE string, and the model is read back out of it — the Sibelius model.
 * The parsing rules themselves are pinned in utils/tempoText.test.ts; these tests are about what
 * the source does with the result: what it seeds, what it writes, and what it removes.
 */
describe('TempoTextSource \u2014 the whole mark is the editable text', () => {
  it('seeds the overlay with the mark\u2019s text, exactly as printed', () => {
    const m = mark({ text: 'Allegro (\u2669 = 144)', unit: 'q', bpm: 144 })
    expect(sourceFor(m).source.getText()).toBe('Allegro (\u2669 = 144)')
  })

  it('retyping the NUMBER moves the tempo', () => {
    const { engine, render, source } = sourceFor(mark({ text: 'Allegro (\u2669 = 144)', unit: 'q', bpm: 144 }))
    source.commit('Allegro (\u2669 = 120)')

    expect(engine.updateTempoMark).toHaveBeenCalledWith('t1', {
      text: 'Allegro (\u2669 = 120)', unit: 'q', dots: undefined, bpm: 120,
    })
    expect(render).toHaveBeenCalled()
  })

  /** The two bugs that sank the fields-are-truth model. Both are stored verbatim now. */
  it('DELETING THE BRACKETS sticks \u2014 the renderer no longer puts them back', () => {
    const { engine, source } = sourceFor(mark({ text: 'Moderato (\u2669 = 112)', unit: 'q', bpm: 112 }))
    source.commit('Moderato \u2669 = 112')

    expect(engine.updateTempoMark).toHaveBeenCalledWith('t1', {
      text: 'Moderato \u2669 = 112', unit: 'q', dots: undefined, bpm: 112,
    })
  })

  it('words typed AFTER the number stay after it', () => {
    const { engine, source } = sourceFor(mark({ text: 'Moderato (\u2669 = 112)', unit: 'q', bpm: 112 }))
    source.commit('Moderato (\u2669 = 112) sempre')

    expect(engine.updateTempoMark).toHaveBeenCalledWith('t1', {
      text: 'Moderato (\u2669 = 112) sempre', unit: 'q', dots: undefined, bpm: 112,
    })
  })

  it('ADDING a metronome to a word-only mark works', () => {
    const { engine, source } = sourceFor(mark({ text: 'Adagio' }))
    source.commit('Adagio (\u2669 = 60)')

    expect(engine.updateTempoMark).toHaveBeenCalledWith('t1', {
      text: 'Adagio (\u2669 = 60)', unit: 'q', dots: undefined, bpm: 60,
    })
  })

  it('deleting the metronome from the string really deletes the speed', () => {
    const { engine, source } = sourceFor(mark({ text: 'Allegro (\u2669 = 144)', unit: 'q', bpm: 144 }))
    source.commit('Allegro')

    expect(engine.updateTempoMark).toHaveBeenCalledWith('t1', {
      text: 'Allegro', unit: undefined, dots: undefined, bpm: undefined,
    })
  })

  it('an empty string removes the mark \u2014 it would say nothing at all', () => {
    const { engine, source } = sourceFor(mark({ text: 'Allegro (\u2669 = 144)', bpm: 144 }))
    source.commit('   ')
    expect(engine.removeTempoMark).toHaveBeenCalledWith('t1')
    expect(engine.updateTempoMark).not.toHaveBeenCalled()
  })

  it('rejects a nonsense bpm rather than producing an impossible clock', () => {
    for (const bad of ['\u2669 = 0', '\u2669 = 5000']) {
      const { engine, source } = sourceFor(mark({ text: '\u2669 = 120', unit: 'q', bpm: 120 }))
      source.commit(bad)
      expect(engine.updateTempoMark, `"${bad}" must be rejected`).not.toHaveBeenCalled()
      expect(engine.removeTempoMark, `"${bad}" must not delete the mark`).not.toHaveBeenCalled()
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

  it('hideOriginal suppresses the whole mark — the overlay shows the whole mark', () => {
    const { engine, source } = sourceFor(mark({ text: 'Allegro' }))
    source.hideOriginal(true)
    expect(engine.setSuppressedTempoId).toHaveBeenCalledWith('t1')
    source.hideOriginal(false)
    expect(engine.setSuppressedTempoId).toHaveBeenCalledWith(null)
  })
})

/**
 * The overlay must land ON the engraved mark, in the engraved font — so both are read off the
 * rendered <g> rather than derived. Deriving them was the bug: a hand-mapped SVG bbox put the box
 * in the wrong place, and a hardcoded font constant (VexFlow resolves StaveTempo.name from its own
 * Metrics — bold, its own text font) made it look nothing like the engraving.
 */
describe('TempoTextSource — the overlay matches the engraving', () => {
  /** One `<text>` node as VexFlow paints it, with its own box and font. */
  function textNode(content: string, rect: { x: number; y: number; width: number; height: number }, fontSize: string) {
    return {
      textContent: content,
      getBoundingClientRect: () => rect,
      style: {} as CSSStyleDeclaration,
      _fontSize: fontSize,
    } as unknown as SVGTextElement
  }

  /**
   * 'Allegro (♩ = 120)' as engraved: the word and the other TEXT pieces at font-size 14, and the
   * notehead — a SMuFL codepoint in the Private Use Area — at 16, reaching HIGHER on the page
   * (y 30 vs y 44) because it is a bigger font. Measuring the glyph, or the group it dominates,
   * would float the caret above the words and size it wrong.
   */
  function engravedGroup() {
    const word = textNode('Allegro', { x: 120, y: 44, width: 60, height: 14 }, '14px')
    const glyph = textNode('\uE1D5', { x: 190, y: 30, width: 12, height: 28 }, '16px')
    const bpm = textNode('120', { x: 210, y: 44, width: 24, height: 14 }, '14px')
    const texts = [word, glyph, bpm]
    return {
      querySelectorAll: (sel: string) => (sel === 'text' ? texts : []),
      // The whole mark: starts at the word, ends past the number, and is TALLER than its text.
      getBoundingClientRect: () => ({ x: 120, y: 30, width: 114, height: 28 }),
    } as unknown as SVGGElement
  }

  function engineWithGroup(m: TempoMark, group: SVGGElement | null) {
    return { ...makeEngine(m), getTempoSVGGroup: vi.fn((_id: string) => group) }
  }

  /** Stand in for the browser: report each fake node's own font. */
  function stubComputedStyle(): void {
    vi.stubGlobal('getComputedStyle', (el: { _fontSize?: string }) => ({
      fontFamily: 'Bravura,Academico',
      fontSize: el._fontSize ?? '14px',
      fontStyle: 'normal',
      fontWeight: '700',
    }))
  }

  afterEach(() => vi.unstubAllGlobals())

  const fullMark = () => mark({ text: 'Allegro (\u2669 = 120)', unit: 'q', bpm: 120 })

  it('spans the WHOLE mark horizontally, but sits on the TEXT’s line, not the notehead’s', () => {
    stubComputedStyle()
    const engine = engineWithGroup(fullMark(), engravedGroup())
    const source = new TempoTextSource('t1', false, engine as unknown as MusicEngine, () => null, vi.fn())

    // x/width from the whole mark (the overlay replaces all of it); y/height from the text line —
    // NOT y:30, which is where the taller ♩ glyph starts.
    expect(source.getScreenRect()).toEqual({ x: 120, y: 44, width: 114, height: 14 })
  })

  it('takes the font from a TEXT node, never the notehead’s much larger one', () => {
    stubComputedStyle()
    const engine = engineWithGroup(fullMark(), engravedGroup())
    const source = new TempoTextSource('t1', false, engine as unknown as MusicEngine, () => null, vi.fn(), () => 2)

    expect(source.getFontCSS()).toEqual({
      fontFamily: 'Bravura,Academico',
      fontSize: '28px', // the WORD's 14px × zoom 2 — never the glyph's 16px
      fontStyle: 'normal',
      fontWeight: '700', // StaveTempo engraves the word BOLD — the overlay must too
      color: '#000000',
    })
  })

  it('skips the notehead even when it comes FIRST (a bare metronome has no word in front)', () => {
    stubComputedStyle()
    const glyph = textNode('', { x: 190, y: 30, width: 12, height: 28 }, '16px')
    const bpm = textNode('120', { x: 210, y: 44, width: 24, height: 14 }, '14px')
    const group = {
      querySelectorAll: (s: string) => (s === 'text' ? [glyph, bpm] : []),
      getBoundingClientRect: () => ({ x: 190, y: 30, width: 44, height: 28 }),
    } as unknown as SVGGElement
    const engine = engineWithGroup(mark({ text: '\u2669 = 120', unit: 'q', bpm: 120 }), group)
    const source = new TempoTextSource('t1', false, engine as unknown as MusicEngine, () => null, vi.fn())

    // Measured against the '120', not the ♩ that precedes it: the text line (y 44), 14px.
    expect(source.getScreenRect()).toEqual({ x: 190, y: 44, width: 44, height: 14 })
    expect(source.getFontCSS().fontSize).toBe('14px')
  })

  it('falls back to the registry bbox when the mark is not in the DOM', () => {
    const engine = engineWithGroup(mark({ text: 'Allegro' }), null)
    const source = new TempoTextSource('t1', false, engine as unknown as MusicEngine, () => null, vi.fn())
    expect(source.getScreenRect()).toEqual({ x: 0, y: 0, width: 0, height: 0 })
  })
})
