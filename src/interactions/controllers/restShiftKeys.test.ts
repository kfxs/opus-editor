import { describe, it, expect, beforeEach, vi } from 'vitest'
import { fracCreate as frac } from '@/utils/fraction'
import { createEditorState, type EditorState } from '../state/EditorState'
import { itemKey, type SelectionItem } from '../state/selection'
import { nudgeSelectedRests } from './restShiftKeys'
import { makeEngine } from '@/testing/makeEngine'
import type { MusicEngine } from '../../engine/MusicEngine'
import type { RestShiftOverride } from '@/types/music'

vi.mock('../../engine/rendering/ScoreRenderer', async () => (await import('@/testing/engineStubs')).scoreRendererStub())
vi.mock('../../engine/audio/PlaybackEngine', async () => (await import('@/testing/engineStubs')).playbackEngineStub())

describe('nudgeSelectedRests — ↑/↓ on selected rests', () => {
  let engine: MusicEngine
  let state: EditorState
  let render: ReturnType<typeof vi.fn<() => void>>
  let note: string
  let rests: string[]

  const select = (...items: SelectionItem[]) => {
    state.selectedItems = new Map(items.map(i => [itemKey(i), i]))
  }
  const asNotes = (ids: string[]) => ids.map((id): SelectionItem => ({ kind: 'note', id }))
  /** Every stored rest shift in the score, as step counts. */
  const shifts = () => Object.values(engine.getScore().engravingOverrides ?? {})
    .flat().filter((o): o is RestShiftOverride => o.kind === 'restShift').map(o => o.steps)

  beforeEach(() => {
    engine = makeEngine()
    // His bar: a quarter note, then the rests the fill leaves behind it (q + h).
    note = engine.addNoteAtBeat({ step: 'C', alter: 0, octave: 5, duration: 'q', measure: 1, beat: frac(0, 1) })!.id
    rests = engine.getScore().measures[0].slots.filter(s => s.type === 'rest').map(s => s.id)
    expect(rests.length).toBeGreaterThanOrEqual(2)
    state = createEditorState()
    render = vi.fn<() => void>()
  })

  it('🚨 his report: TWO selected rests both move, as ONE undo entry', () => {
    select(...asNotes(rests.slice(0, 2)))
    expect(nudgeSelectedRests(engine, state, 1, render)).toBe(true)
    expect(shifts()).toEqual([1, 1])
    expect(render).toHaveBeenCalledTimes(1)

    engine.undo()
    expect(shifts()).toEqual([])
  })

  it('one rest still works, and presses accumulate', () => {
    select(...asNotes([rests[0]]))
    nudgeSelectedRests(engine, state, -1, render)
    nudgeSelectedRests(engine, state, -1, render)
    expect(shifts()).toEqual([-2])
  })

  it('⛔ a MIXED selection declines — ↑/↓ then re-pitch the notes, as before', () => {
    select(...asNotes([note, rests[0]]))
    expect(nudgeSelectedRests(engine, state, 1, render)).toBe(false)
    expect(shifts()).toEqual([])
    expect(render).not.toHaveBeenCalled()
  })

  it('…and so does a rest with a non-note item riding along, and an empty selection', () => {
    select(...asNotes([rests[0]]), { kind: 'dynamic', id: 'd1' } as SelectionItem)
    expect(nudgeSelectedRests(engine, state, 1, render)).toBe(false)
    select()
    expect(nudgeSelectedRests(engine, state, 1, render)).toBe(false)
    expect(nudgeSelectedRests(null, state, 1, render)).toBe(false)
  })
})
