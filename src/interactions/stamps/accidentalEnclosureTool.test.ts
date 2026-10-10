import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createEditorState, type EditorState } from '../state/EditorState'
import { accidentalEnclosureLit, pressAccidentalEnclosure, type AccidentalEnclosureHost } from './accidentalEnclosureTool'
import { makeEngine } from '@/testing/makeEngine'
import { itemKey, type SelectionItem } from '../state/selection'
import { fracCreate as frac } from '@/utils/fraction'
import type { MusicEngine } from '@/engine/MusicEngine'

vi.mock('../../engine/rendering/ScoreRenderer', async () => (await import('@/testing/engineStubs')).scoreRendererStub())
vi.mock('../../engine/audio/PlaybackEngine', async () => (await import('@/testing/engineStubs')).playbackEngineStub())

/**
 * Subject: `./accidentalEnclosureTool` — what the Accidentals page's `Enter` MEANS (alteration-signs K3):
 * notes selected → toggle their accidentals' brackets; a selected accidental → its note's; nothing selected
 * or note entry → nothing (plan §5 default 3).
 */
describe('pressAccidentalEnclosure', () => {
  let state: EditorState
  let engine: MusicEngine
  let host: AccidentalEnclosureHost
  beforeEach(() => {
    state = createEditorState()
    engine = makeEngine()
    host = { state, getEngine: () => engine, render: vi.fn() }
  })
  const select = (...ids: string[]) => {
    state.selectedItems = new Map(ids.map((id): [string, SelectionItem] => [itemKey({ kind: 'note', id }), { kind: 'note', id }]))
  }
  const note = (beat: number) => engine.addNoteAtBeat({ step: 'C', octave: 5, duration: 'q', measure: 1, beat: frac(beat, 1) })!

  it('⭐ NOTES selected → toggles theirs as one edit, lights, and a re-press takes them off', () => {
    state.selectedTool = 'selection'
    const a = note(0)
    const b = note(1)
    select(a.id, b.id)
    pressAccidentalEnclosure(host)
    expect([engine.signEnclosure.of(a.id), engine.signEnclosure.of(b.id)]).toEqual(['round', 'round'])
    expect(accidentalEnclosureLit(state, engine)).toBe(true)
    expect(host.render).toHaveBeenCalled()
    pressAccidentalEnclosure(host)
    expect(engine.signEnclosure.of(a.id)).toBeUndefined()
    expect(accidentalEnclosureLit(state, engine)).toBe(false)
  })

  it('⭐ a selected ACCIDENTAL → its note\'s brackets', () => {
    const a = note(0)
    state.selectedElement = { kind: 'accidental', noteId: a.id, type: 'natural' }
    pressAccidentalEnclosure(host)
    expect(engine.signEnclosure.of(a.id)).toBe('round')
  })

  it('⛔ nothing selected in selection mode → nothing at all', () => {
    const a = note(0)
    state.selectedTool = 'selection'
    pressAccidentalEnclosure(host)
    expect(engine.signEnclosure.of(a.id)).toBeUndefined()
    expect(host.render).not.toHaveBeenCalled()
  })

  it('⭐ NOTE ENTRY → arms the brackets for the next notes (lit), a re-press disarms; the score is untouched', () => {
    const a = note(0)
    state.selectedTool = 'entry'
    pressAccidentalEnclosure(host)
    expect(state.selectedSignEnclosure).toBe('round')
    expect(accidentalEnclosureLit(state, engine)).toBe(true)
    pressAccidentalEnclosure(host)
    expect(state.selectedSignEnclosure).toBeNull()
    expect(engine.signEnclosure.of(a.id)).toBeUndefined()
  })

  it('⭐ the BRACKETS selected → a press takes them off and nothing stays selected', () => {
    const a = note(0)
    engine.signEnclosure.set([a.id], 'round')
    state.selectedElement = { kind: 'accidentalEnclosure', noteId: a.id }
    expect(accidentalEnclosureLit(state, engine)).toBe(true)
    pressAccidentalEnclosure(host)
    expect(engine.signEnclosure.of(a.id)).toBeUndefined()
    expect(state.selectedElement).toBeNull()
  })

  it('⭐ an entered note is BORN with them, in the same undo entry, and shows its implied sign', () => {
    state.selectedSignEnclosure = 'round'
    const n = engine.addNoteAtBeat({ step: 'F', octave: 4, duration: 'q', measure: 1, beat: frac(0, 1), signEnclosure: 'round' })!
    expect(engine.signEnclosure.of(n.id)).toBe('round')
    engine.undo()
    expect(engine.getNote(n.id)).toBeFalsy()
  })
})
