import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { MusicEngine } from '../../engine/MusicEngine'
import { TupletEditController } from './TupletEditController'
import { bus } from '@/bus'

/**
 * Subject: {@link TupletEditController} — the apply behind the Properties tuplet format rows (his ask,
 * 2026-09-25). The window is a dumb publisher, so these drive the seam the way it does.
 * ⭐ A CONTENT edit (it reaches the model and takes an undo entry); a re-pick of the value the tuplet already
 * has writes NOTHING; `auto` is stored ABSENT.
 */
vi.mock('../../engine/rendering/ScoreRenderer', async () => (await import('@/testing/engineStubs')).scoreRendererStub())
vi.mock('../../engine/audio/PlaybackEngine', async () => (await import('@/testing/engineStubs')).playbackEngineStub())

describe('TupletEditController', () => {
  let engine: MusicEngine
  let controller: TupletEditController
  let renders: number
  let tupletId: string

  beforeEach(() => {
    engine = new MusicEngine({ container: {} as unknown as HTMLElement, width: 800, height: 400 })
    tupletId = engine.createTupletAtBeat(1, 0, '8', { step: 'E', alter: 0, octave: 4 }, 3, 2, 0)!.tuplet.id
    renders = 0
    controller = new TupletEditController(() => engine, () => { renders++ })
  })
  afterEach(() => controller.destroy())

  const tuplet = () => engine.getScore().measures[0].tuplets!.find(t => t.id === tupletId)!

  it('⭐⭐ the BRACKET: show / hide are stored; auto is stored ABSENT; each is one undo entry and a repaint', () => {
    bus.tupletEdit.set({ tupletId, bracket: 'never' })
    expect(tuplet().bracket).toBe('never')
    expect(renders).toBe(1)
    bus.tupletEdit.set({ tupletId, bracket: 'auto' })
    expect('bracket' in tuplet(), 'auto = the rule = no field').toBe(false)
    expect(engine.undo()).toBe(true)
    expect(tuplet().bracket).toBe('never')
  })

  it('the NUMBER style and the bracket END are the other two fields, each on its own', () => {
    bus.tupletEdit.set({ tupletId, numberStyle: 'ratio' })
    expect(tuplet()).toMatchObject({ numberStyle: 'ratio' })
    expect('bracket' in tuplet(), 'a partial request touches nothing else').toBe(false)
    bus.tupletEdit.set({ tupletId, bracketEnd: 'division' })
    expect(tuplet()).toMatchObject({ numberStyle: 'ratio', bracketEnd: 'division' })
    bus.tupletEdit.set({ tupletId, numberStyle: 'auto' })
    expect('numberStyle' in tuplet()).toBe(false)
  })

  it('⛔ re-choosing what it already has writes nothing — no undo entry, no repaint', () => {
    bus.tupletEdit.set({ tupletId, bracket: 'auto' })
    expect(renders).toBe(0)
    // The only entry is the CREATION's: an undo takes the tuplet itself away, not a no-op edit.
    expect(engine.undo()).toBe(true)
    expect(engine.getScore().measures[0].tuplets ?? []).toHaveLength(0)
  })

  it('an unknown tuplet is a no-op', () => {
    bus.tupletEdit.set({ tupletId: 'nope', bracket: 'always' })
    expect(renders).toBe(0)
  })
})
