/**
 * The TEMPO MARK's commands, driven through the facade (`engine.tempo.…`) with the renderer and
 * playback stubbed — the chapter that was `MusicEngine.test.ts`'s until the commands left it.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MusicEngine } from '../MusicEngine'
import { fracCreate as frac } from '@/utils/fraction'
import { DEFAULT_TEMPO } from '@/utils/tempoMap'

// Stub ScoreRenderer (needs canvas/SVG) and PlaybackEngine (needs Web Audio)
const fakeRegistry = {
  clear: vi.fn(), register: vi.fn(), getAll: vi.fn(() => []),
  findAt: vi.fn(() => null), getByNoteId: vi.fn(() => null),
  registerStaffGeometry: vi.fn(), getStaffGeometry: vi.fn(() => null),
}
vi.mock('../rendering/ScoreRenderer', async (importOriginal) => ({
  // Keep the module's real constants (LAYOUT_CONFIG — the staff-spacing clamp reads it); only the
  // renderer class needs stubbing, since it wants a canvas/SVG.
  ...(await importOriginal<typeof import('../rendering/ScoreRenderer')>()),
  ScoreRenderer: class {
    initialize = vi.fn()
    renderScore = vi.fn()
    getElementRegistry = vi.fn(() => fakeRegistry)
    setViewMode = vi.fn()
    setLinearStaffSpacing = vi.fn()
    setCullWindow = vi.fn()
    setLayoutReusable = vi.fn()
    // P3's skip test (docs/history/render-performance-plan.md §5a) reads the view state off the
    // renderer. The stub's view state never changes, so `isRenderStale` here answers purely
    // "did the content change?" — which is exactly what the tests below exercise.
    viewStateKey = vi.fn(() => 'stub-view-state')
    clearGhosts = vi.fn()
    // Nothing is drawn, so there are no bounds to feed the coordinate mapper.
    getAllMeasureBounds = vi.fn(() => new Map())
    // Nothing is laid out in a stubbed renderer, so no measure opens a system: the per-system
    // staff-spacing key can't be resolved, exactly as before a first render.
    getSystemOpeningMeasureNumber = vi.fn(() => undefined)
  },
}))
vi.mock('../audio/PlaybackEngine', () => ({
  PlaybackEngine: class {
    setScore = vi.fn()
    play = vi.fn()
    pause = vi.fn()
    stop = vi.fn()
    setVolume = vi.fn()
    onStateChange = vi.fn()
  },
}))

function makeEngine(): MusicEngine {
  const container = {} as unknown as HTMLElement
  const engine = new MusicEngine({ container, width: 800, height: 400 })
  // Add a second measure for overflow tests
  engine.addMeasure()
  return engine
}

describe('tempoCommands — through the facade', () => {
  let engine: MusicEngine
  beforeEach(() => { engine = makeEngine() })

  const marksOf = (m: number) => engine.getTempoMarks(m)

  it('adds a word, a metronome, or both — the TEXT says which; the bpm says how fast', () => {
    // A word that sounds without printing its number; a bare metronome; both together. The mark is
    // its text, so "is the metronome printed?" is answered by looking at it — there is no flag.
    engine.tempo.addTempoMark(1, { beat: frac(0, 1), text: 'Allegro', bpm: 144 })
    engine.tempo.addTempoMark(1, { beat: frac(1, 1), text: '♩ = 120', unit: 'q', bpm: 120 })
    engine.tempo.addTempoMark(1, { beat: frac(2, 1), text: 'Adagio (♩ = 65)', unit: 'q', bpm: 65 })

    expect(marksOf(1).map(t => [t.text, t.bpm])).toEqual([
      ['Allegro', 144],
      ['♩ = 120', 120],
      ['Adagio (♩ = 65)', 65],
    ])
  })

  it('a word-only mark sounds at the prevailing tempo (it prints, it does not re-clock)', () => {
    engine.tempo.addTempoMark(1, { beat: frac(0, 1), bpm: 60 })
    engine.tempo.addTempoMark(1, { beat: frac(2, 1), text: 'dolce' }) // no bpm
    expect(engine.getEffectiveTempoAt(1, frac(3, 1))).toBe(60)
  })

  it('resolves the tempo positionally, falling back to DEFAULT_TEMPO (no score.tempo)', () => {
    expect(engine.getEffectiveTempoAt(1, frac(0, 1))).toBe(DEFAULT_TEMPO)
    engine.tempo.addTempoMark(1, { beat: frac(2, 1), unit: 'h', bpm: 60 }) // 𝅗𝅥 = 60 → 120 qpm
    expect(engine.getEffectiveTempoAt(1, frac(1, 1))).toBe(DEFAULT_TEMPO) // before the mark
    expect(engine.getEffectiveTempoAt(1, frac(2, 1))).toBe(120) // the unit is half the meaning
  })

  it('replaces a mark already on the beat (one clock statement per point in time)', () => {
    engine.tempo.addTempoMark(1, { beat: frac(0, 1), text: 'Largo', bpm: 50 })
    engine.tempo.addTempoMark(1, { beat: frac(0, 1), text: 'Presto', bpm: 185 })
    expect(marksOf(1)).toHaveLength(1) // NOT stacked (that is the dynamics rule)
    expect(marksOf(1)[0].text).toBe('Presto')
  })

  it('rejects a bpm that would make the clock nonsense', () => {
    expect(() => engine.tempo.addTempoMark(1, { beat: frac(0, 1), bpm: 0 })).toThrow(/between 20 and 300/)
    expect(() => engine.tempo.addTempoMark(1, { beat: frac(0, 1), bpm: 500 })).toThrow(/between 20 and 300/)
    expect(marksOf(1)).toHaveLength(0)
  })

  it('editing the word leaves the bpm untouched, and vice versa (decision D2)', () => {
    const mark = engine.tempo.addTempoMark(1, { beat: frac(0, 1), text: 'Allegro', bpm: 144 })!

    engine.tempo.updateTempoMark(mark.id, { text: 'Allegro con brio' })
    expect(marksOf(1)[0]).toMatchObject({ id: mark.id, text: 'Allegro con brio', bpm: 144 })

    engine.tempo.updateTempoMark(mark.id, { bpm: 152 })
    expect(marksOf(1)[0]).toMatchObject({ id: mark.id, text: 'Allegro con brio', bpm: 152 })
  })

  it('removes a mark, reverting to the previous tempo', () => {
    engine.tempo.addTempoMark(1, { beat: frac(0, 1), bpm: 60 })
    const second = engine.tempo.addTempoMark(1, { beat: frac(2, 1), bpm: 180 })!

    expect(engine.tempo.removeTempoMark(second.id)).toBe(true)
    expect(engine.getEffectiveTempoAt(1, frac(3, 1))).toBe(60)
    expect(engine.tempo.removeTempoMark('nope')).toBe(false)
  })

  it('drops the array when the last mark is removed (no empty tempos: [] in JSON)', () => {
    const mark = engine.tempo.addTempoMark(1, { beat: frac(0, 1), bpm: 60 })!
    engine.tempo.removeTempoMark(mark.id)
    expect(engine.getScore().measures[0].tempos).toBeUndefined()
  })

  describe('⭐ a typed-in tempo mark is ONE edit (his report, 2026-09-22)', () => {
    it('the placement is a preview: no undo entry until the text is committed', () => {
      const before = engine.canUndo()
      const t = engine.tempo.placeTempoMarkForTyping(1, { beat: frac(0, 1), text: 'Tempo' })!
      expect(marksOf(1)).toHaveLength(1)
      expect(engine.canUndo()).toBe(before)
      engine.tempo.commitTypedTempoMark(t.id, { text: 'Allegro', bpm: 144 })
      expect(marksOf(1)[0]).toMatchObject({ text: 'Allegro', bpm: 144 })
      expect(engine.canUndo()).toBe(true)
    })

    it('🚨 ONE Ctrl+Z takes the whole mark away — never back to the placeholder', () => {
      const t = engine.tempo.placeTempoMarkForTyping(1, { beat: frac(0, 1), text: 'Tempo' })!
      engine.tempo.commitTypedTempoMark(t.id, { text: 'Allegro', bpm: 144 })
      expect(engine.undo()).toBe(true)
      expect(marksOf(1)).toHaveLength(0)
      expect(engine.redo()).toBe(true)
      expect(marksOf(1)[0].text).toBe('Allegro')
    })

    it('🚨 the commit leaves the picture STALE — the text must reach the screen', () => {
      const t = engine.tempo.placeTempoMarkForTyping(1, { beat: frac(0, 1), text: 'Tempo' })!
      engine.renderScore()
      expect(engine.isRenderStale()).toBe(false)
      engine.tempo.commitTypedTempoMark(t.id, { text: 'Allegro', bpm: 144 })
      expect(engine.isRenderStale()).toBe(true)
    })

    it('an EDIT of an existing mark still undoes to its old text', () => {
      const t = engine.tempo.placeTempoMarkForTyping(1, { beat: frac(0, 1), text: 'Tempo' })!
      engine.tempo.commitTypedTempoMark(t.id, { text: 'Allegro', bpm: 144 })
      engine.tempo.updateTempoMark(t.id, { text: 'Adagio' })
      engine.undo()
      expect(marksOf(1)[0].text).toBe('Allegro')
    })

    it('a discarded preview leaves no mark and no undo entry', () => {
      const before = engine.canUndo()
      const t = engine.tempo.placeTempoMarkForTyping(1, { beat: frac(0, 1), text: 'Tempo' })!
      expect(engine.tempo.discardTypedTempoMark(t.id)).toBe(true)
      expect(marksOf(1)).toHaveLength(0)
      expect(engine.canUndo()).toBe(before)
    })
  })

  it('undo/redo restores and re-applies add, edit and remove', () => {
    const mark = engine.tempo.addTempoMark(1, { beat: frac(0, 1), text: 'Allegro', bpm: 144 })!
    expect(engine.undo()).toBe(true)
    expect(marksOf(1)).toHaveLength(0) // the add is undone
    expect(engine.redo()).toBe(true)
    expect(marksOf(1)).toHaveLength(1)

    engine.tempo.updateTempoMark(marksOf(1)[0].id, { bpm: 60 })
    expect(engine.undo()).toBe(true)
    expect(marksOf(1)[0].bpm).toBe(144) // the edit is undone

    engine.tempo.removeTempoMark(marksOf(1)[0].id)
    expect(marksOf(1)).toHaveLength(0)
    expect(engine.undo()).toBe(true)
    expect(marksOf(1)[0]).toMatchObject({ text: 'Allegro', bpm: 144 }) // the removal is undone
    void mark
  })
})
