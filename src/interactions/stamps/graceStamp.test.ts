import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MusicEngine } from '../../engine/MusicEngine'
import type { ElementInfo, ElementRegistry } from '../../engine/ElementRegistry'
import { createEditorState, type EditorState } from '../state/EditorState'
import { stampGraceAtClick } from './graceStamp'
import { fracCreate as frac } from '../../utils/fraction'

/**
 * The grace stamp's click. The `MusicEngine` is real (the grace, the refusal, the undo entry are its
 * answers); the PIXEL steps are stubbed — which bar/staff/pitch a click names is `pixelToPosition`'s
 * question, and what the renderer registered is handed in as a fake registry.
 */
vi.mock('../../engine/rendering/ScoreRenderer', async () => (await import('@/testing/engineStubs')).scoreRendererStub())
vi.mock('../../engine/audio/PlaybackEngine', async () => (await import('@/testing/engineStubs')).playbackEngineStub())

describe('stampGraceAtClick', () => {
  let engine: MusicEngine
  let state: EditorState
  let render: () => void
  let hostId: string
  let restId: string

  const registry = (elements: ElementInfo[]) =>
    ({ getByType: (type: string) => elements.filter(e => e.type === type) }) as unknown as ElementRegistry
  const at = (type: 'note' | 'rest', id: string, headX: number): ElementInfo =>
    ({ type, id, measure: 1, staff: 0, headX, bbox: { x: headX - 5, y: 0, width: 10, height: 10 } })

  beforeEach(() => {
    engine = new MusicEngine({ container: {} as unknown as HTMLElement, width: 800, height: 400 })
    hostId = engine.addNoteAtBeat({ step: 'E', octave: 5, duration: 'q', measure: 1, beat: frac(1, 1) })!.id
    restId = engine.getScore().measures[0].slots.find(s => s.type === 'rest')!.id
    vi.spyOn(engine, 'pixelToMeasure').mockReturnValue(1)
    vi.spyOn(engine, 'pixelToPosition').mockReturnValue({ measure: 1, beat: frac(1, 1), spelling: { step: 'D', alter: 0, octave: 5 }, staff: 0 })
    state = createEditorState()
    state.selectedDuration = '8'
    render = vi.fn()
  })

  it('does not touch a click when the tool is not armed', () => {
    expect(stampGraceAtClick(state, engine, registry([at('note', hostId, 100)]), 90, 50, render)).toBe(false)
  })

  it('⭐ hangs a grace of the CLICK\'s pitch on the nearest note, drawn as the armed value — one undo entry', () => {
    state.selectedMarkingTool = { kind: 'grace', form: 'acciaccatura', side: 'before' }
    const undoBefore = engine.canUndo()
    expect(stampGraceAtClick(state, engine, registry([at('rest', restId, 40), at('note', hostId, 100)]), 85, 50, render)).toBe(true)
    const chord = engine.getScore().measures[0].slots.find(s => s.type === 'chord')!
    if (chord.type !== 'chord') throw new Error('unreachable')
    expect(chord.graceBefore?.notes).toHaveLength(1)
    expect(chord.graceBefore?.notes[0]).toMatchObject({ duration: '8', pitches: [{ step: 'D', octave: 5 }] })
    expect(chord.graceBefore?.slash).toBe(true)
    expect(undoBefore).toBe(true) // the note entry above
    engine.undo()
    const after = engine.getScore().measures[0].slots.find(s => s.type === 'chord')!
    expect(after.type === 'chord' && after.graceBefore, 'ONE undo takes the grace off, not the note').toBeFalsy()
    expect(render).toHaveBeenCalled()
  })

  it('⭐ a REST nearest the click takes the grace (D7 reversed, his call)', () => {
    state.selectedMarkingTool = { kind: 'grace', form: 'appoggiatura', side: 'before' }
    expect(stampGraceAtClick(state, engine, registry([at('rest', restId, 200), at('note', hostId, 100)]), 195, 50, render)).toBe(true)
    const rest = engine.getScore().measures[0].slots.find(s => s.id === restId)
    expect(rest?.type === 'rest' && rest.graceBefore?.notes).toHaveLength(1)
    expect(render).toHaveBeenCalled()
  })

  it('⛔ a GRACE head is never a host — the click finds the ordinary note behind it', () => {
    state.selectedMarkingTool = { kind: 'grace', form: 'appoggiatura', side: 'before' }
    const grace = engine.grace.addGrace(hostId, 'before', { step: 'C', alter: 0, octave: 5 }, 'appoggiatura', { duration: '8' })!
    stampGraceAtClick(state, engine, registry([at('note', hostId, 100), at('note', grace.pitches[0].id, 80)]), 78, 50, render)
    const chord = engine.getScore().measures[0].slots.find(s => s.type === 'chord')!
    expect(chord.type === 'chord' && chord.graceBefore?.notes).toHaveLength(2)
  })

  it('a click far from every note is a no-op', () => {
    state.selectedMarkingTool = { kind: 'grace', form: 'acciaccatura', side: 'before' }
    expect(stampGraceAtClick(state, engine, registry([at('note', hostId, 100)]), 400, 50, render)).toBe(true)
    expect(render).not.toHaveBeenCalled()
  })
})
