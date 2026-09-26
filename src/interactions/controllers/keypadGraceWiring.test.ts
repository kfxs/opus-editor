import { describe, it, expect, vi, afterEach } from 'vitest'
import { bus } from '@/bus'
import { makeEngine } from '@/testing/makeEngine'
import { fracCreate as frac } from '@/utils/fraction'
import { createObservableEditorState, type MarkingTool } from '../state/EditorState'
import { itemKey } from '../state/selection'
import type { DotKeyHost } from '../stamps/dotCountTool'
import { wireKeypadGrace } from './keypadGraceWiring'

vi.mock('../../engine/rendering/ScoreRenderer', async () => (await import('@/testing/engineStubs')).scoreRendererStub())
vi.mock('../../engine/audio/PlaybackEngine', async () => (await import('@/testing/engineStubs')).playbackEngineStub())

/**
 * Subject: `./keypadGraceWiring` — the Keypad's grace keys, wired the dev toolbar's way (his ask, 2026-09-23):
 * a press does what the toolbar's button does, and the lights follow the same rules.
 */
describe('wireKeypadGrace', () => {
  let stop: () => void = () => {}
  afterEach(() => { stop(); bus.grace.setActive([]) })

  const setup = () => {
    const engine = makeEngine()
    const { state, subscribe } = createObservableEditorState()
    const host: DotKeyHost = {
      state, getEngine: () => engine, repaintGhost: vi.fn(), selectNote: vi.fn(),
      arm: vi.fn((t: MarkingTool) => { state.selectedMarkingTool = t }),
      disarm: vi.fn(() => { state.selectedMarkingTool = null }),
      disarmToEntry: vi.fn(() => { state.selectedMarkingTool = null }),
      render: vi.fn(),
    }
    stop = wireKeypadGrace(state, () => host, () => engine, subscribe)
    return { engine, state, host }
  }

  it('⭐ a press ARMS the stamp, as the toolbar button does — and the key LIGHTS', () => {
    const { state } = setup()
    bus.grace.press('acciaccatura')
    expect(state.selectedMarkingTool).toEqual({ kind: 'grace', form: 'acciaccatura', side: 'before' })
    expect(bus.grace.isActive('acciaccatura')).toBe(true)
    expect(bus.grace.isActive('appoggiatura')).toBe(false)
    bus.grace.press('bracketed')
    expect(state.selectedMarkingTool).toEqual({ kind: 'bracketedGrace', side: 'before' })
    expect([...['appoggiatura', 'acciaccatura', 'bracketed']].map(k => bus.grace.isActive(k as never))).toEqual([false, false, true])
  })

  it('⭐ a SELECTED grace lights its form, a selected bracketed grace lights `-` — the toolbar\'s lit rules', () => {
    const { engine, state } = setup()
    const note = engine.addNoteAtBeat({ step: 'E', alter: 0, octave: 5, duration: 'q', measure: 1, beat: frac(0, 1) })!
    const g = engine.grace.addGrace(note.id, 'before', { step: 'D', alter: 0, octave: 5 }, 'appoggiatura', { duration: '8' })!
    const b = engine.bracketed.add(note.id, 'before', { step: 'B', alter: -1, octave: 4 })!
    state.selectedTool = 'selection'
    state.selectedItems = new Map([g.pitches[0].id, b.pitches[0].id].map(id => [itemKey({ kind: 'note', id }), { kind: 'note', id }]))
    expect(bus.grace.isActive('appoggiatura')).toBe(true)
    expect(bus.grace.isActive('bracketed')).toBe(true)
    expect(bus.grace.isActive('acciaccatura')).toBe(false)
  })

  it('⭐ a press on a selected NOTE converts it — the same function, so the same rule', () => {
    const { engine, state } = setup()
    const note = engine.addNoteAtBeat({ step: 'E', alter: 0, octave: 5, duration: 'q', measure: 1, beat: frac(0, 1) })!
    state.selectedTool = 'selection'
    state.selectedItems = new Map([[itemKey({ kind: 'note', id: note.id }), { kind: 'note', id: note.id }]])
    bus.grace.press('bracketed')
    expect(engine.bracketed.isBracketed(note.id)).toBe(true)
  })

  describe('⭐ the `1` — the parenthesised note, the dev toolbar\'s `paren.` (his ask, 2026-09-26)', () => {
    it('nothing selected: a press ARMS the brackets stamp, and the key LIGHTS; again, disarms', () => {
      const { state } = setup()
      state.selectedTool = 'selection'
      bus.grace.press('parenthesised')
      expect(state.selectedMarkingTool?.kind).toBe('headEnclosure')
      expect(bus.grace.isActive('parenthesised')).toBe(true)
      bus.grace.press('parenthesised')
      expect(state.selectedMarkingTool).toBeNull()
      expect(bus.grace.isActive('parenthesised')).toBe(false)
    })

    it('a selected note: the press puts it in brackets, and the key lights; again, takes them off', async () => {
      // The light follows the MODEL, whose notice is one per turn (`MusicEngine.onModelChange`, a microtask).
      const settle = () => new Promise<void>(r => queueMicrotask(r))
      const { engine, state } = setup()
      const note = engine.addNoteAtBeat({ step: 'E', alter: 0, octave: 5, duration: 'q', measure: 1, beat: frac(0, 1) })!
      state.selectedTool = 'selection'
      state.selectedItems = new Map([[itemKey({ kind: 'note', id: note.id }), { kind: 'note', id: note.id }]])
      bus.grace.press('parenthesised')
      await settle()
      expect(engine.getNote(note.id)?.enclosure).toBeTruthy()
      expect(bus.grace.isActive('parenthesised')).toBe(true)
      bus.grace.press('parenthesised')
      await settle()
      expect(engine.getNote(note.id)?.enclosure).toBeUndefined()
      expect(bus.grace.isActive('parenthesised')).toBe(false)
    })
  })

  describe('⭐ `2` / `3` — the double and triple dot, the dev toolbar\'s `..` / `...` (his ask, 2026-09-26)', () => {
    it('a selected note: `2` double-dots it and lights `2`; `3` SWITCHES to three (the counts are a radio)', async () => {
      const settle = () => new Promise<void>(r => queueMicrotask(r))
      const { engine, state } = setup()
      const note = engine.addNoteAtBeat({ step: 'E', alter: 0, octave: 5, duration: 'q', measure: 1, beat: frac(0, 1) })!
      state.selectedTool = 'selection'
      state.selectedNoteId = note.id
      state.selectedItems = new Map([[itemKey({ kind: 'note', id: note.id }), { kind: 'note', id: note.id }]])
      bus.grace.press('doubleDot')
      await settle()
      expect(engine.getNote(note.id)?.dots).toBe(2)
      expect(bus.grace.isActive('doubleDot')).toBe(true)
      bus.grace.press('tripleDot')
      await settle()
      expect(engine.getNote(note.id)?.dots).toBe(3)
      expect([bus.grace.isActive('doubleDot'), bus.grace.isActive('tripleDot')]).toEqual([false, true])
    })

    it('nothing selected: a press ARMS the dot stamp with its count, and lights; again, disarms', () => {
      const { state } = setup()
      state.selectedTool = 'selection'
      bus.grace.press('tripleDot')
      expect(state.selectedMarkingTool).toEqual({ kind: 'dot', count: 3 })
      expect(bus.grace.isActive('tripleDot')).toBe(true)
      bus.grace.press('tripleDot')
      expect(state.selectedMarkingTool).toBeNull()
    })
  })

  describe('⭐ `0` — the full-bar rest, the dev toolbar\'s `full bar` (his ask, 2026-09-26)', () => {
    it('nothing selected: a press ARMS the stamp and lights; again, disarms', () => {
      const { state } = setup()
      state.selectedTool = 'selection'
      bus.grace.press('barRest')
      expect(state.selectedMarkingTool).toEqual({ kind: 'barRest' })
      expect(bus.grace.isActive('barRest')).toBe(true)
      bus.grace.press('barRest')
      expect(state.selectedMarkingTool).toBeNull()
      expect(bus.grace.isActive('barRest')).toBe(false)
    })

    it('a selected voice-2 note: its bar gets a voice-2 full-bar rest, and the key lights', async () => {
      const settle = () => new Promise<void>(r => queueMicrotask(r))
      const { engine, state } = setup()
      const note = engine.addNoteAtBeat({ step: 'A', alter: 0, octave: 3, duration: 'q', measure: 1, beat: frac(0, 1), voice: 1 })!
      state.selectedTool = 'selection'
      state.selectedItems = new Map([[itemKey({ kind: 'note', id: note.id }), { kind: 'note', id: note.id }]])
      bus.grace.press('barRest')
      await settle()
      const v2 = engine.getScore().measures[0].slots.filter(s => (s.voice ?? 0) === 1)
      expect(v2.map(s => s.type === 'rest' && s.stamped)).toEqual([true])
      expect(bus.grace.isActive('barRest')).toBe(true)
    })
  })

  describe('⭐ `.` — the glissando, the dev toolbar\'s `gliss` (his ask, 2026-09-26)', () => {
    it('nothing selected: a press ARMS the stamp and lights; again, disarms', () => {
      const { state } = setup()
      state.selectedTool = 'selection'
      bus.grace.press('gliss')
      expect(state.selectedMarkingTool).toEqual({ kind: 'glissandoLine' })
      expect(bus.grace.isActive('gliss')).toBe(true)
      bus.grace.press('gliss')
      expect(state.selectedMarkingTool).toBeNull()
      expect(bus.grace.isActive('gliss')).toBe(false)
    })

    it('a selected note: the press starts a glissando on it, and the key lights; again, takes it off', async () => {
      const settle = () => new Promise<void>(r => queueMicrotask(r))
      const { engine, state } = setup()
      const a = engine.addNoteAtBeat({ step: 'C', alter: 0, octave: 5, duration: 'q', measure: 1, beat: frac(0, 1) })!
      engine.addNoteAtBeat({ step: 'G', alter: 0, octave: 5, duration: 'q', measure: 1, beat: frac(1, 1) })
      state.selectedTool = 'selection'
      state.selectedItems = new Map([[itemKey({ kind: 'note', id: a.id }), { kind: 'note', id: a.id }]])
      bus.grace.press('gliss')
      await settle()
      expect(engine.glissando.on(a.id)).toBeDefined()
      expect(bus.grace.isActive('gliss')).toBe(true)
      bus.grace.press('gliss')
      await settle()
      expect(engine.glissando.on(a.id)).toBeUndefined()
      expect(bus.grace.isActive('gliss')).toBe(false)
    })
  })

  describe('⭐ `Enter` — cue size, the dev toolbar\'s `cue` (his ask, 2026-09-26)', () => {
    it('selected notes: the press makes them cue, and the key lights; again, back to full size', async () => {
      const settle = () => new Promise<void>(r => queueMicrotask(r))
      const { engine, state } = setup()
      const a = engine.addNoteAtBeat({ step: 'C', alter: 0, octave: 5, duration: 'q', measure: 1, beat: frac(0, 1) })!
      state.selectedTool = 'selection'
      state.selectedItems = new Map([[itemKey({ kind: 'note', id: a.id }), { kind: 'note', id: a.id }]])
      bus.grace.press('cue')
      await settle()
      expect(engine.cue.of(a.id)).toBe(true)
      expect(bus.grace.isActive('cue')).toBe(true)
      bus.grace.press('cue')
      await settle()
      expect(engine.cue.of(a.id)).toBe(false)
      expect(bus.grace.isActive('cue')).toBe(false)
    })

    it('in note entry: the press ARMS cue for the next notes, and lights; again, disarms', () => {
      const { state } = setup()
      state.selectedTool = 'entry'
      bus.grace.press('cue')
      expect(state.selectedCue).toBe(true)
      expect(bus.grace.isActive('cue')).toBe(true)
      bus.grace.press('cue')
      expect(state.selectedCue).toBe(false)
      expect(bus.grace.isActive('cue')).toBe(false)
    })
  })
})
