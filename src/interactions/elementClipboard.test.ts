import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MusicEngine } from '../engine/MusicEngine'
import { copyElement, pasteElement } from './elementClipboard'
import { fracCreate as frac, fracToNumber } from '../utils/fraction'
import { levelToGlyphString } from '../utils/dynamics'

/**
 * COPY/PASTE of one selected element — an expression (a dynamic), and a TEMPO mark.
 *
 * Subject: {@link elementClipboard}, sitting beside this file. Real engine, stubbed renderer and
 * playback: what a clip carries and what a paste writes are both model facts.
 */
const fakeRegistry = {
  clear: vi.fn(), register: vi.fn(), getAll: vi.fn(() => []),
  findAt: vi.fn(() => null), getByNoteId: vi.fn(() => null),
  registerStaffGeometry: vi.fn(), getStaffGeometry: vi.fn(() => null),
}
vi.mock('../engine/rendering/VexFlowRenderer', () => ({
  VexFlowRenderer: class {
    initialize = vi.fn(); renderScore = vi.fn(); getElementRegistry = vi.fn(() => fakeRegistry)
  },
}))
vi.mock('../engine/audio/PlaybackEngine', () => ({
  PlaybackEngine: class {
    setScore = vi.fn(); play = vi.fn(); pause = vi.fn(); stop = vi.fn(); setVolume = vi.fn(); onStateChange = vi.fn()
  },
}))

describe('elementClipboard', () => {
  let engine: MusicEngine
  let dynamicId: string

  /** Every dynamic in the score as `measure@beat:text`, in bar/beat order. */
  const dynamics = () => engine.getScore().measures.flatMap(m =>
    (m.dynamics ?? []).map(d => `${m.number}@${fracToNumber(d.beat)}:${d.text}`))

  beforeEach(() => {
    engine = new MusicEngine({ container: {} as unknown as HTMLElement, width: 800, height: 400 })
    engine.addMeasure()
    engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    dynamicId = engine.addDynamic(1, { beat: frac(0, 1), text: 'dolce', voice: 0, placement: 'below' })!.id
  })

  it('copies the MARK — its text and how it reads — and no id', () => {
    const clip = copyElement(engine, { kind: 'dynamic', id: dynamicId })
    expect(clip).toEqual({ kind: 'dynamic', text: 'dolce', placement: 'below', voice: 0 })
    expect(JSON.stringify(clip)).not.toContain(dynamicId)
  })

  it('declines a kind that cannot travel yet, and a stale id', () => {
    expect(copyElement(engine, { kind: 'barline', measure: 1 })).toBeNull()
    expect(copyElement(engine, { kind: 'dynamic', id: 'gone' })).toBeNull()
    expect(copyElement(engine, null)).toBeNull()
  })

  it('⭐ pastes a NEW mark at the anchor, leaving the copied one alone', () => {
    const clip = copyElement(engine, { kind: 'dynamic', id: dynamicId })!
    const created = pasteElement(engine, clip, { measure: 2, beat: frac(0, 1), staff: 0, voice: 0 })
    expect(created).toEqual({ kind: 'dynamic', id: expect.any(String) })
    expect(created).not.toEqual({ kind: 'dynamic', id: dynamicId })
    expect(dynamics()).toEqual(['1@0:dolce', '2@0:dolce'])
  })

  it('pastes the same clip any number of times — it holds no position of its own', () => {
    const clip = copyElement(engine, { kind: 'dynamic', id: dynamicId })!
    pasteElement(engine, clip, { measure: 2, beat: frac(0, 1) })
    pasteElement(engine, clip, { measure: 2, beat: frac(2, 1) })
    expect(dynamics()).toEqual(['1@0:dolce', '2@0:dolce', '2@2:dolce'])
  })

  it('takes the ANCHOR’s voice where it names one, and keeps its own where it does not', () => {
    const clip = copyElement(engine, { kind: 'dynamic', id: dynamicId })!
    const voiced = { ...clip, voice: 1 as const }
    pasteElement(engine, voiced, { measure: 2, beat: frac(0, 1), voice: 2 })
    pasteElement(engine, voiced, { measure: 2, beat: frac(1, 1) })
    const voices = engine.getScore().measures[1].dynamics!.map(d => d.voice)
    expect(voices).toEqual([2, 1])
  })

  it('a glyph level travels verbatim — the mark IS its text', () => {
    const level = engine.addDynamic(1, { beat: frac(2, 1), text: levelToGlyphString('ff') })!
    const clip = copyElement(engine, { kind: 'dynamic', id: level.id })!
    pasteElement(engine, clip, { measure: 2, beat: frac(0, 1) })
    expect(engine.getScore().measures[1].dynamics![0].text).toBe(levelToGlyphString('ff'))
  })

  it('an undo takes the pasted mark back out', () => {
    const clip = copyElement(engine, { kind: 'dynamic', id: dynamicId })!
    pasteElement(engine, clip, { measure: 2, beat: frac(0, 1) })
    expect(engine.undo()).toBe(true)
    expect(dynamics()).toEqual(['1@0:dolce'])
  })
})

describe('elementClipboard — the TEMPO mark (his ask, 2026-08-19)', () => {
  let engine: MusicEngine
  let tempoId: string

  /** Every tempo mark as `measure@beat:text`. */
  const tempos = () => engine.getScore().measures.flatMap(m =>
    (m.tempos ?? []).map(t => `${m.number}@${fracToNumber(t.beat)}:${t.text}`))

  beforeEach(() => {
    engine = new MusicEngine({ container: {} as unknown as HTMLElement, width: 800, height: 400 })
    engine.addMeasure()
    // Bar 1: notes on beats 0 and 2 only — so beats 1 and 3 sound NOTHING and are not anchors.
    engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'h', measure: 1, beat: frac(0, 1) })
    engine.addNoteAtBeat({ step: 'E', octave: 4, duration: 'h', measure: 1, beat: frac(2, 1) })
    engine.addNoteAtBeat({ step: 'G', octave: 4, duration: 'q', measure: 2, beat: frac(0, 1) })
    tempoId = engine.addTempoMark(1, { beat: frac(0, 1), text: 'Allegro', unit: 'q', bpm: 144 })!.id
  })

  it('copies the mark — its text AND what it sounds — and no id', () => {
    const clip = copyElement(engine, { kind: 'tempo', id: tempoId })
    expect(clip).toEqual({ kind: 'tempo', text: 'Allegro', unit: 'q', bpm: 144 })
    expect(JSON.stringify(clip)).not.toContain(tempoId)
  })

  it('declines a stale id', () => {
    expect(copyElement(engine, { kind: 'tempo', id: 'gone' })).toBeNull()
  })

  it('⭐ pastes a NEW mark on an ONSET, keeping what it sounds', () => {
    const clip = copyElement(engine, { kind: 'tempo', id: tempoId })!
    const created = pasteElement(engine, clip, { measure: 2, beat: frac(0, 1) })
    expect(created).toEqual({ kind: 'tempo', id: expect.any(String) })
    expect(tempos()).toEqual(['1@0:Allegro', '2@0:Allegro'])
    expect(engine.getScore().measures[1].tempos![0].bpm).toBe(144)
  })

  it('⭐⭐ a beat NOTHING sounds on resolves FORWARD to the next onset — the ink’s own rule', () => {
    // Beat 1 of bar 1 is inside a half note: no onset, so no anchor. The mark lands on beat 2,
    // where the drawing would put it anyway (TempoLayout.anchorX: the first element at-or-after).
    const clip = copyElement(engine, { kind: 'tempo', id: tempoId })!
    pasteElement(engine, clip, { measure: 1, beat: frac(1, 1) })
    expect(tempos()).toEqual(['1@0:Allegro', '1@2:Allegro'])
  })

  it('⭐ REPLACES the mark sitting on that beat — one tempo per beat — and one undo puts it back', () => {
    const other = engine.addTempoMark(2, { beat: frac(0, 1), text: 'Adagio' })!.id
    const clip = copyElement(engine, { kind: 'tempo', id: tempoId })!
    pasteElement(engine, clip, { measure: 2, beat: frac(0, 1) })
    expect(tempos()).toEqual(['1@0:Allegro', '2@0:Allegro'])
    expect(engine.getTempoMarkById(other), 'the Adagio is gone').toBeNull()

    expect(engine.undo()).toBe(true)
    expect(tempos()).toEqual(['1@0:Allegro', '2@0:Adagio'])
  })

  it('pastes the same clip any number of times', () => {
    const clip = copyElement(engine, { kind: 'tempo', id: tempoId })!
    pasteElement(engine, clip, { measure: 1, beat: frac(2, 1) })
    pasteElement(engine, clip, { measure: 2, beat: frac(0, 1) })
    expect(tempos()).toEqual(['1@0:Allegro', '1@2:Allegro', '2@0:Allegro'])
  })
})
