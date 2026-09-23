import { describe, it, expect, vi } from 'vitest'

vi.mock('../../engine/rendering/ScoreRenderer', async () => (await import('@/testing/engineStubs')).scoreRendererStub())
vi.mock('../../engine/audio/PlaybackEngine', async () => (await import('@/testing/engineStubs')).playbackEngineStub())
import { bracketedToolLit, pressBracketedTool } from './bracketedGraceTool'
import { createEditorState } from '../state/EditorState'
import type { SpanToolHost } from './spanToolPress'
import { itemKey } from '../state/selection'
import { makeEngine } from '@/testing/makeEngine'
import { fracCreate } from '@/utils/fraction'

/** Subject: `./bracketedGraceTool` — the `bracket.` button's press and light (bracketed-grace-plan P2). */
function host() {
  const state = createEditorState()
  const h: SpanToolHost = {
    state,
    getEngine: () => null,
    arm: vi.fn(tool => { state.selectedMarkingTool = tool }),
    disarm: vi.fn(() => { state.selectedMarkingTool = null }),
    disarmToEntry: vi.fn(() => { state.selectedMarkingTool = null }),
    render: vi.fn(),
  }
  return h
}

describe('pressBracketedTool', () => {
  it('a press ARMS the stamp and lights the button; ⭐ a stale accidental is cleared first', () => {
    const h = host()
    h.state.selectedAccidental = '#'
    pressBracketedTool(h, 'before')
    expect(h.state.selectedMarkingTool).toEqual({ kind: 'bracketedGrace', side: 'before' })
    expect(h.state.selectedAccidental).toBeNull()
    expect(bracketedToolLit(h.state, 'before')).toBe(true)
  })

  it('⭐ B7 revised: it reads the LIT duration — and with none lit, arms a quarter\'s black head', () => {
    const lit = host()
    lit.state.selectedTool = 'entry' // in note entry, the duration key is LIT
    lit.state.selectedDuration = 'h'
    pressBracketedTool(lit, 'before')
    expect(lit.state.selectedDuration).toBe('h')
    const dark = host() // selection mode, nothing selected: no key lit
    dark.state.selectedDuration = 'h'
    pressBracketedTool(dark, 'before')
    expect(dark.state.selectedDuration).toBe('q')
  })

  it('a re-press DISARMS it back to note entry — ⛔ not selection', () => {
    const h = host()
    pressBracketedTool(h, 'before')
    pressBracketedTool(h, 'before')
    expect(h.disarmToEntry).toHaveBeenCalledTimes(1)
    expect(h.disarm).not.toHaveBeenCalled()
    expect(bracketedToolLit(h.state, 'before')).toBe(false)
  })

  it('an accidental armed WITH the stamp is kept on a re-arm of another side — it is a choice made for it', () => {
    const h = host()
    pressBracketedTool(h, 'before')
    h.state.selectedAccidental = 'b'
    pressBracketedTool(h, 'after')
    expect(h.state.selectedAccidental).toBe('b')
  })

  it('⭐ his rule: with NOTES selected, a press CONVERTS them — rests fill their slots; what was made is the selection', () => {
    const engine = makeEngine()
    const note = engine.addNoteAtBeat({ step: 'D', alter: 0, octave: 5, duration: 'q', measure: 1, beat: fracCreate(1, 1) })!
    const h = host()
    h.getEngine = () => engine
    h.state.selectedTool = 'selection'
    h.state.selectedItems = new Map([[itemKey({ kind: 'note', id: note.id }), { kind: 'note', id: note.id }]])
    h.state.selectedNoteId = note.id
    pressBracketedTool(h, 'before')
    expect(h.state.selectedMarkingTool).toBeNull() // nothing armed
    expect(engine.bracketed.isBracketed(note.id)).toBe(true)
    expect(h.state.selectedNoteId).toBe(note.id)
    const slot = engine.getScore().measures[0].slots.find(s => s.bracketedBefore)!
    expect(slot.type).toBe('rest')
    expect(slot.duration).toBe('q')
    expect(h.render).toHaveBeenCalled()
  })

  it('⭐ his report: with NOTHING armed, a SELECTED bracketed grace lights the button — the grace buttons\' rule', () => {
    const engine = makeEngine()
    const note = engine.addNoteAtBeat({ step: 'D', alter: 0, octave: 5, duration: 'q', measure: 1, beat: fracCreate(1, 1) })!
    const made = engine.bracketed.add(note.id, 'before', { step: 'B', alter: -1, octave: 4 })!
    const state = host().state
    state.selectedTool = 'selection'
    expect(bracketedToolLit(state, 'before', engine)).toBe(false)
    state.selectedItems = new Map([[itemKey({ kind: 'note', id: made.pitches[0].id }), { kind: 'note', id: made.pitches[0].id }]])
    expect(bracketedToolLit(state, 'before', engine)).toBe(true)
    expect(bracketedToolLit(state, 'after', engine)).toBe(false)
    state.selectedItems = new Map([[itemKey({ kind: 'note', id: note.id }), { kind: 'note', id: note.id }]])
    expect(bracketedToolLit(state, 'before', engine)).toBe(false) // an ordinary note lights nothing
  })

  it('⭐ his rule: the LIT button with a bracketed grace selected TOGGLES IT OFF — its target takes the pitch', () => {
    const engine = makeEngine()
    const note = engine.addNoteAtBeat({ step: 'D', alter: 0, octave: 5, duration: 'h', measure: 1, beat: fracCreate(1, 1) })!
    const made = engine.bracketed.add(note.id, 'before', { step: 'B', alter: -1, octave: 4 })!
    const h = host()
    h.getEngine = () => engine
    h.state.selectedTool = 'selection'
    const id = made.pitches[0].id
    h.state.selectedItems = new Map([[itemKey({ kind: 'note', id }), { kind: 'note', id }]])
    pressBracketedTool(h, 'before')
    expect(h.state.selectedMarkingTool).toBeNull()
    expect(engine.bracketed.isBracketed(id)).toBe(false)
    expect(engine.getNote(id)).toMatchObject({ step: 'B', alter: -1, octave: 4, duration: 'h' })
    expect(h.state.selectedNoteId).toBe(id)
  })

  it('⭐ his rule: a selected GRACE pressed → a bracketed grace before what stands to its right, ONE undo entry', () => {
    const engine = makeEngine()
    const note = engine.addNoteAtBeat({ step: 'D', alter: 0, octave: 5, duration: 'q', measure: 1, beat: fracCreate(1, 1) })!
    const g1 = engine.grace.addGrace(note.id, 'before', { step: 'G', alter: 0, octave: 4 }, 'appoggiatura', { duration: '8' })!
    const g2 = engine.grace.addGrace(note.id, 'before', { step: 'A', alter: 0, octave: 4 }, 'appoggiatura', { duration: '8' })!
    const h = host()
    h.getEngine = () => engine
    h.state.selectedTool = 'selection'
    const id = g1.pitches[0].id
    h.state.selectedItems = new Map([[itemKey({ kind: 'note', id }), { kind: 'note', id }]])
    pressBracketedTool(h, 'before')
    expect(engine.bracketed.find(id)?.target).toBe(g2)
    expect(engine.isGraceNote(id)).toBe(false)
    expect(h.state.selectedNoteId).toBe(id)
    engine.undo()
    expect(engine.isGraceNote(id)).toBe(true)
  })
})
