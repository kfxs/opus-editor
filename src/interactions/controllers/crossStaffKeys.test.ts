import { describe, it, expect, beforeEach, vi } from 'vitest'
import { fracCreate as frac } from '@/utils/fraction'
import { createEditorState, type EditorState } from '../state/EditorState'
import { itemKey, type SelectionItem } from '../state/selection'
import { crossSelectedNotes, crossStaffActions } from './crossStaffKeys'
import { makeEngine } from '@/testing/makeEngine'
import type { MusicEngine } from '../../engine/MusicEngine'

vi.mock('../../engine/rendering/ScoreRenderer', async () => (await import('@/testing/engineStubs')).scoreRendererStub())
vi.mock('../../engine/audio/PlaybackEngine', async () => (await import('@/testing/engineStubs')).playbackEngineStub())

/** The stored `displayStaffId` of a pitch — it is not on the flat `Note`. */
function writtenOn(engine: MusicEngine, id: string): string | undefined {
  for (const m of engine.getScore().measures) for (const s of m.slots) {
    if (s.type === 'chord') for (const p of s.notes) if (p.id === id) return p.displayStaffId
  }
  return undefined
}

describe('crossSelectedNotes — Ctrl+Shift+↑/↓', () => {
  let engine: MusicEngine
  let state: EditorState
  let render: ReturnType<typeof vi.fn<() => void>>
  let top: string

  const select = (...ids: string[]) => {
    const items = ids.map((id): SelectionItem => ({ kind: 'note', id }))
    state.selectedItems = new Map(items.map(i => [itemKey(i), i]))
  }
  const add = (step: 'B' | 'D' | 'F', octave: number) =>
    engine.addChordNote({ step, alter: 0, octave, duration: 'h', measure: 1, beat: frac(0, 1), staff: 1 }).id

  beforeEach(() => {
    engine = makeEngine()
    engine.addStaffBelow(0)
    top = engine.getScore().staves![0].id
    state = createEditorState()
    state.selectedTool = 'selection'
    render = vi.fn<() => void>()
  })

  it('⭐ the Satie bar: two selected heads of a chord cross, the unselected one stays — ONE undo', () => {
    const b = engine.addNoteAtBeat({ step: 'B', alter: 0, octave: 2, duration: 'h', measure: 1, beat: frac(0, 1), staff: 1 })!.id
    const d = add('D', 4)
    const f = add('F', 4)
    select(d, f)

    expect(crossSelectedNotes(engine, state, -1, render)).toBe(true)

    expect(writtenOn(engine, d)).toBe(top)
    expect(writtenOn(engine, f)).toBe(top)
    expect(writtenOn(engine, b)).toBeUndefined()
    expect(render).toHaveBeenCalledTimes(1)

    engine.undo()
    expect(writtenOn(engine, d)).toBeUndefined()
    expect(writtenOn(engine, f)).toBeUndefined()
  })

  it('the opposite key brings a head home', () => {
    const d = engine.addNoteAtBeat({ step: 'D', alter: 0, octave: 4, duration: 'h', measure: 1, beat: frac(0, 1), staff: 1 })!.id
    select(d)
    crossSelectedNotes(engine, state, -1, render)
    crossSelectedNotes(engine, state, 1, render)
    expect(writtenOn(engine, d)).toBeUndefined()
  })

  it('⛔ a press that moved nothing renders nothing and leaves no undo entry', () => {
    const d = engine.addNoteAtBeat({ step: 'D', alter: 0, octave: 5, duration: 'h', measure: 1, beat: frac(0, 1), staff: 0 })!.id
    select(d)
    const undoable = engine.canUndo()
    engine.undo(); engine.redo() // settle the history's shape before comparing
    expect(crossSelectedNotes(engine, state, -1, render)).toBe(false) // already the top staff
    expect(render).not.toHaveBeenCalled()
    expect(engine.canUndo()).toBe(undoable)
    expect(writtenOn(engine, d)).toBeUndefined()
  })

  it('declines with nothing selected, and outside the selection / entry tools', () => {
    expect(crossSelectedNotes(engine, state, -1, render)).toBe(false)
    expect(crossSelectedNotes(null, state, -1, render)).toBe(false)
  })

  it('crossStaffActions names the two actions ShortcutConfig binds', () => {
    expect(Object.keys(crossStaffActions(() => engine, state, render)).sort()).toEqual(['crossStaffDown', 'crossStaffUp'])
  })
})
