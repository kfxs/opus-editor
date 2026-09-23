import { describe, it, expect, vi, afterEach } from 'vitest'
import { bus } from '@/bus'
import { makeEngine } from '@/testing/makeEngine'
import { fracCreate as frac } from '@/utils/fraction'
import { createObservableEditorState, type MarkingTool } from '../state/EditorState'
import { itemKey } from '../state/selection'
import type { SpanToolHost } from '../stamps/spanToolPress'
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
    const host: SpanToolHost = {
      state, getEngine: () => engine,
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
})
