import { describe, it, expect, beforeEach, vi } from 'vitest'
import { fracCreate as frac } from '@/utils/fraction'
import { createEditorState, type EditorState } from '../state/EditorState'
import { itemKey, type SelectionItem } from '../state/selection'
import { nudgeSelectedNoteOffset, resetSelectedNoteOffset, selectedHasNoColumn } from './noteOffsetKeys'
import { makeEngine } from '@/testing/makeEngine'
import type { MusicEngine } from '../../engine/MusicEngine'

vi.mock('../../engine/rendering/ScoreRenderer', async () => (await import('@/testing/engineStubs')).scoreRendererStub())
vi.mock('../../engine/audio/PlaybackEngine', async () => (await import('@/testing/engineStubs')).playbackEngineStub())

describe('noteOffsetKeys — the note offset on the keys', () => {
  let engine: MusicEngine
  let state: EditorState
  let render: ReturnType<typeof vi.fn<() => void>>
  let note: string
  let grace: string

  const select = (...ids: string[]) => {
    state.selectedItems = new Map(ids.map((id): [string, SelectionItem] => [itemKey({ kind: 'note', id }), { kind: 'note', id }]))
  }

  beforeEach(() => {
    engine = makeEngine()
    note = engine.addNoteAtBeat({ step: 'C', alter: 0, octave: 5, duration: 'q', measure: 1, beat: frac(0, 1) })!.id
    grace = engine.grace.addGrace(note, 'before', { step: 'D', alter: 0, octave: 5 }, 'appoggiatura', { duration: '8' })!.pitches[0].id
    state = createEditorState()
    render = vi.fn<() => void>()
  })

  it('nudges the ONE selected note, accumulating, and resets it outright', () => {
    select(note)
    expect(nudgeSelectedNoteOffset(engine, state, 1, render)).toBe(true)
    expect(nudgeSelectedNoteOffset(engine, state, 0.25, render)).toBe(true)
    expect(engine.getNoteOffset(note)).toBe(1.25)
    expect(resetSelectedNoteOffset(engine, state, render)).toBe(true)
    expect(engine.getNoteOffset(note)).toBe(0)
    expect(render).toHaveBeenCalledTimes(3)
  })

  it('⭐ a GRACE takes its OWN offset — its main note does not move', () => {
    select(grace)
    expect(nudgeSelectedNoteOffset(engine, state, -1, render)).toBe(true)
    expect(engine.getNoteOffset(grace)).toBe(-1)
    expect(engine.getNoteOffset(note)).toBe(0)
  })

  it('⛔ declines with nothing (or more than one note) selected, and a reset with nothing to reset', () => {
    expect(nudgeSelectedNoteOffset(engine, state, 1, render)).toBe(false)
    select(note, grace)
    expect(nudgeSelectedNoteOffset(engine, state, 1, render)).toBe(false)
    select(note)
    expect(resetSelectedNoteOffset(engine, state, render)).toBe(false)
    expect(render).not.toHaveBeenCalled()
  })

  it('⭐ a grace stands in NO column of its own — a note does', () => {
    select(grace)
    expect(selectedHasNoColumn(engine, state)).toBe(true)
    select(note)
    expect(selectedHasNoColumn(engine, state)).toBe(false)
    select('gone')
    expect(selectedHasNoColumn(engine, state)).toBe(false)
  })
})
