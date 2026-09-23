import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createEditorState, type EditorState, type MarkingTool } from '../state/EditorState'
import { graceToolLit, pressGraceTool } from './graceTool'
import type { SpanToolHost } from './spanToolPress'
import { makeEngine } from '@/testing/makeEngine'
import { fracCreate as frac, fracToNumber } from '@/utils/fraction'
import { itemKey, type SelectionItem } from '../state/selection'

vi.mock('../../engine/rendering/ScoreRenderer', async () => (await import('@/testing/engineStubs')).scoreRendererStub())
vi.mock('../../engine/audio/PlaybackEngine', async () => (await import('@/testing/engineStubs')).playbackEngineStub())

describe('pressGraceTool', () => {
  let state: EditorState
  let host: SpanToolHost
  beforeEach(() => {
    state = createEditorState()
    host = {
      state,
      getEngine: () => null,
      arm: vi.fn((tool: MarkingTool) => { state.selectedMarkingTool = tool; state.selectedTool = 'entry' }),
      disarm: vi.fn(() => { state.selectedMarkingTool = null; state.selectedTool = 'selection' }),
      disarmToEntry: vi.fn(() => { state.selectedMarkingTool = null }),
      render: vi.fn(),
    }
  })

  it('⭐ ARMS the stamp (D6), and with nothing lit the written value is an 8th', () => {
    pressGraceTool(host, 'acciaccatura', 'before')
    expect(state.selectedMarkingTool).toEqual({ kind: 'grace', form: 'acciaccatura', side: 'before' })
    expect(state.selectedDuration).toBe('8')
    expect(graceToolLit(state, 'acciaccatura', 'before')).toBe(true)
    expect(graceToolLit(state, 'appoggiatura', 'before')).toBe(false)
  })

  it('a lit duration is a value somebody chose — it stays', () => {
    state.selectedNoteId = 'x' // a selection lights the duration row
    state.selectedDuration = '16'
    pressGraceTool(host, 'appoggiatura', 'before')
    expect(state.selectedDuration).toBe('16')
  })

  it('the same press again DISARMS; the other form SWAPS', () => {
    pressGraceTool(host, 'acciaccatura', 'before')
    pressGraceTool(host, 'appoggiatura', 'before')
    expect(state.selectedMarkingTool).toEqual({ kind: 'grace', form: 'appoggiatura', side: 'before' })
    pressGraceTool(host, 'appoggiatura', 'before')
    expect(state.selectedMarkingTool).toBeNull()
  })

  it('🚨 the disarm STAYS in note entry — ⛔ never selection mode (his report, 2026-09-22)', () => {
    pressGraceTool(host, 'appoggiatura', 'before')
    pressGraceTool(host, 'appoggiatura', 'before')
    expect(host.disarmToEntry).toHaveBeenCalledOnce()
    expect(host.disarm).not.toHaveBeenCalled()
    expect(state.selectedTool).toBe('entry')
  })
})

describe('pressGraceTool — a SELECTED grace (his rule, 2026-09-22; plan §3 rule 2)', () => {
  const setup = (tool: 'selection' | 'entry') => {
    const engine = makeEngine()
    const note = engine.addNoteAtBeat({ step: 'E', alter: 0, octave: 5, duration: 'q', measure: 1, beat: frac(0, 1) })!
    const grace = engine.grace.addGrace(note.id, 'before', { step: 'D', alter: 0, octave: 5 }, 'appoggiatura', { duration: '8' })!
    const state = createEditorState()
    state.selectedTool = tool
    const id = grace.pitches[0].id
    state.selectedItems = new Map([[itemKey({ kind: 'note', id }), { kind: 'note', id }]])
    const host: SpanToolHost = {
      state, getEngine: () => engine,
      arm: vi.fn((t: MarkingTool) => { state.selectedMarkingTool = t }),
      disarm: vi.fn(), disarmToEntry: vi.fn(), render: vi.fn(),
    }
    const slash = () => {
      const slot = engine.getScore().measures[0].slots.find(s => s.type === 'chord')!
      return slot.type === 'chord' && !!slot.graceBefore?.slash
    }
    return { host, state, slash }
  }

  it('⭐ in SELECTION mode it EDITS the grace\'s form — and arms nothing', () => {
    const { host, state, slash } = setup('selection')
    pressGraceTool(host, 'acciaccatura', 'before')
    expect(slash()).toBe(true)
    expect(state.selectedMarkingTool).toBeNull()
    expect(host.render).toHaveBeenCalled()
    pressGraceTool(host, 'appoggiatura', 'before')
    expect(slash()).toBe(false)
  })

  it('in ENTRY mode (a stamp in hand) the button still arms', () => {
    const { host, state, slash } = setup('entry')
    pressGraceTool(host, 'acciaccatura', 'before')
    expect(slash()).toBe(false)
    expect(state.selectedMarkingTool).toEqual({ kind: 'grace', form: 'acciaccatura', side: 'before' })
  })
})

describe('pressGraceTool — a selected NOTE becomes a grace (P4, his rule, 2026-09-22)', () => {
  it('⭐ its place becomes a rest, the grace stands before it, the grace is SELECTED — ONE undo brings the note back', () => {
    const engine = makeEngine()
    const note = engine.addNoteAtBeat({ step: 'E', alter: 0, octave: 5, duration: 'q', measure: 1, beat: frac(1, 1) })!
    const state = createEditorState()
    state.selectedTool = 'selection'
    state.selectedItems = new Map([[itemKey({ kind: 'note', id: note.id }), { kind: 'note', id: note.id }]])
    state.selectedNoteId = note.id
    const host: SpanToolHost = {
      state, getEngine: () => engine,
      arm: vi.fn((t: MarkingTool) => { state.selectedMarkingTool = t }),
      disarm: vi.fn(), disarmToEntry: vi.fn(), render: vi.fn(),
    }
    pressGraceTool(host, 'acciaccatura', 'before')

    const slot = engine.getScore().measures[0].slots.find(s => fracToNumber(s.beat) === 1)!
    expect(slot.type).toBe('rest')
    expect(slot.type === 'rest' && slot.graceBefore?.notes[0].pitches[0].id).toBe(note.id)
    expect(slot.type === 'rest' && slot.graceBefore?.slash).toBe(true)
    expect(state.selectedNoteId).toBe(note.id) // the grace — the note's own pitch id
    expect(engine.isGraceNote(note.id)).toBe(true)
    expect(state.selectedMarkingTool).toBeNull() // nothing armed

    engine.undo()
    expect(engine.getNote(note.id)?.isRest).toBe(false)
    expect(engine.isGraceNote(note.id)).toBe(false)
  })
})

describe('pressGraceTool — a grace TOGGLED OFF (his rules, 2026-09-22)', () => {
  const setup = () => {
    const engine = makeEngine()
    const note = engine.addNoteAtBeat({ step: 'E', alter: 0, octave: 5, duration: 'q', measure: 1, beat: frac(0, 1) })!
    const state = createEditorState()
    state.selectedTool = 'selection'
    const host: SpanToolHost = {
      state, getEngine: () => engine,
      arm: vi.fn((t: MarkingTool) => { state.selectedMarkingTool = t }),
      disarm: vi.fn(), disarmToEntry: vi.fn(), render: vi.fn(),
    }
    const select = (...ids: string[]) => {
      state.selectedItems = new Map(ids.map((id): [string, SelectionItem] => [itemKey({ kind: 'note', id }), { kind: 'note', id }]))
      state.selectedNoteId = ids[0]
    }
    return { engine, note, state, host, select }
  }

  it('⭐ its OWN form pressed: the grace becomes the note (the main slot\'s duration, the grace\'s pitch), selected', () => {
    const { engine, note, state, host, select } = setup()
    const g = engine.grace.addGrace(note.id, 'before', { step: 'D', alter: 0, octave: 5 }, 'appoggiatura', { duration: '16' })!
    select(g.pitches[0].id)
    pressGraceTool(host, 'appoggiatura', 'before')
    const made = engine.getNote(g.pitches[0].id)!
    expect(engine.isGraceNote(made.id)).toBe(false)
    expect([made.step, made.duration]).toEqual(['D', 'q'])
    expect(state.selectedNoteId).toBe(made.id)
    engine.undo()
    expect(engine.isGraceNote(g.pitches[0].id)).toBe(true) // ONE undo entry
  })

  it('the WHOLE group selected: it goes; the selection drops what is gone', () => {
    const { engine, note, state, host, select } = setup()
    const ids = (['D', 'F'] as const).map(step =>
      engine.grace.addGrace(note.id, 'before', { step, alter: 0, octave: 5 }, 'acciaccatura', { duration: '16' })!.pitches[0].id)
    select(...ids)
    pressGraceTool(host, 'acciaccatura', 'before')
    expect(ids.some(id => engine.getNote(id))).toBe(false)
    expect(engine.getNote(note.id)!.step).toBe('E')
    expect(state.selectedItems.size).toBe(0)
  })

  it('the OTHER form pressed still just changes the form', () => {
    const { engine, note, host, select } = setup()
    const g = engine.grace.addGrace(note.id, 'before', { step: 'D', alter: 0, octave: 5 }, 'appoggiatura', { duration: '16' })!
    select(g.pitches[0].id)
    pressGraceTool(host, 'acciaccatura', 'before')
    expect(engine.isGraceNote(g.pitches[0].id)).toBe(true)
  })
})

describe('graceToolLit — a SELECTED grace lights its group\'s form (his report, 2026-09-22)', () => {
  it('⭐ in selection mode the button of the selected grace\'s form is lit — the one that toggles it off', () => {
    const engine = makeEngine()
    const note = engine.addNoteAtBeat({ step: 'E', alter: 0, octave: 5, duration: 'q', measure: 1, beat: frac(0, 1) })!
    const g = engine.grace.addGrace(note.id, 'before', { step: 'D', alter: 0, octave: 5 }, 'acciaccatura', { duration: '16' })!
    const state = createEditorState()
    state.selectedTool = 'selection'
    state.selectedItems = new Map([[itemKey({ kind: 'note', id: g.pitches[0].id }), { kind: 'note', id: g.pitches[0].id }]])
    expect(graceToolLit(state, 'acciaccatura', 'before', engine)).toBe(true)
    expect(graceToolLit(state, 'appoggiatura', 'before', engine)).toBe(false)
    // An ordinary note selected lights neither; an ARMED tool wins over the selection.
    state.selectedItems = new Map([[itemKey({ kind: 'note', id: note.id }), { kind: 'note', id: note.id }]])
    expect(graceToolLit(state, 'acciaccatura', 'before', engine)).toBe(false)
    state.selectedMarkingTool = { kind: 'grace', form: 'appoggiatura', side: 'before' }
    expect(graceToolLit(state, 'appoggiatura', 'before', engine)).toBe(true)
  })
})

describe('pressGraceTool — a SELECTED bracketed grace (his rule, 2026-09-23: "maintaining it targets")', () => {
  it('⭐ becomes a grace of the pressed form, joining its target\'s group — ONE undo entry, and it is the selection', () => {
    const engine = makeEngine()
    const note = engine.addNoteAtBeat({ step: 'E', alter: 0, octave: 5, duration: 'q', measure: 1, beat: frac(0, 1) })!
    const made = engine.bracketed.add(note.id, 'before', { step: 'D', alter: 0, octave: 5 })!
    const id = made.pitches[0].id
    const state = createEditorState()
    state.selectedTool = 'selection'
    state.selectedItems = new Map([[itemKey({ kind: 'note', id }), { kind: 'note', id }]])
    const host: SpanToolHost = {
      state, getEngine: () => engine,
      arm: vi.fn((t: MarkingTool) => { state.selectedMarkingTool = t }),
      disarm: vi.fn(), disarmToEntry: vi.fn(), render: vi.fn(),
    }
    pressGraceTool(host, 'acciaccatura', 'before')
    expect(state.selectedMarkingTool).toBeNull()
    expect(engine.isGraceNote(id)).toBe(true)
    expect(engine.bracketed.isBracketed(id)).toBe(false)
    const slot = engine.getScore().measures[0].slots.find(s => s.type === 'chord')!
    expect(slot.type === 'chord' && slot.graceBefore?.slash).toBe(true)
    expect(state.selectedNoteId).toBe(id)
    engine.undo()
    expect(engine.bracketed.isBracketed(id)).toBe(true)
  })
})
