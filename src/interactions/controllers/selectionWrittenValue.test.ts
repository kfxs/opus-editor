import { describe, it, expect, vi } from 'vitest'
import { makeEngine } from '@/testing/makeEngine'
import { fracCreate as frac } from '@/utils/fraction'
import { createEditorState } from '../state/EditorState'
import { itemKey, type SelectionItem } from '../state/selection'
import { writeSelectionValue } from './selectionWrittenValue'

vi.mock('../../engine/rendering/ScoreRenderer', async () => (await import('@/testing/engineStubs')).scoreRendererStub())
vi.mock('../../engine/audio/PlaybackEngine', async () => (await import('@/testing/engineStubs')).playbackEngineStub())

describe('writeSelectionValue — a duration/dot key on a selection', () => {
  const setup = () => {
    const engine = makeEngine()
    const note = engine.addNoteAtBeat({ step: 'E', alter: 0, octave: 5, duration: 'q', measure: 1, beat: frac(0, 1) })!
    const graces = (['D', 'C', 'B'] as const).map(step =>
      engine.grace.addGrace(note.id, 'before', { step, alter: 0, octave: 5 }, 'appoggiatura', { duration: '8' })!)
    const state = createEditorState()
    const select = (...ids: string[]) => {
      state.selectedItems = new Map(ids.map((id): [string, SelectionItem] => [itemKey({ kind: 'note', id }), { kind: 'note', id }]))
      state.selectedNoteId = ids[0]
    }
    return { engine, note, graces, state, select }
  }

  it('🚨 EVERY selected grace takes the value — not just the anchor (his report) — as ONE undo entry', () => {
    const { engine, graces, state, select } = setup()
    select(...graces.map(g => g.pitches[0].id))
    writeSelectionValue(engine, state, { duration: '16', dots: 0 })
    expect(graces.map(g => g.duration)).toEqual(['16', '16', '16'])
    engine.undo()
    const slot = engine.getScore().measures[0].slots.find(s => s.type === 'chord')!
    expect(slot.type === 'chord' && slot.graceBefore!.notes.map(n => n.duration)).toEqual(['8', '8', '8'])
  })

  it('the dot key too', () => {
    const { engine, graces, state, select } = setup()
    select(graces[0].pitches[0].id, graces[2].pitches[0].id)
    writeSelectionValue(engine, state, { dots: 1 })
    expect(graces.map(g => g.dots ?? 0)).toEqual([1, 0, 1])
  })

  it('an ordinary ANCHOR note takes it as it always did — its bar rebars', () => {
    const { engine, note, state, select } = setup()
    select(note.id)
    writeSelectionValue(engine, state, { duration: 'h', dots: 0 })
    expect(engine.getNote(note.id)!.duration).toBe('h')
  })

  it('⭐ every selected BRACKETED grace takes the DURATION too — its head (bracketed-grace-plan B7)', () => {
    const { engine, note, state, select } = setup()
    const a = engine.bracketed.add(note.id, 'before', { step: 'D', alter: 0, octave: 5 })!
    const b = engine.bracketed.add(note.id, 'before', { step: 'F', alter: 0, octave: 5 })!
    select(a.pitches[0].id, b.pitches[0].id)
    writeSelectionValue(engine, state, { duration: 'h', dots: 0 })
    expect([a.duration, b.duration]).toEqual(['h', 'h'])
    const chord = engine.getScore().measures[0].slots.find(s => s.type === 'chord')!
    expect(chord.duration).toBe('q') // ⛔ the anchor is a bracketed grace: the note it stands before never moves
  })
})
