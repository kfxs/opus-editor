import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { MusicEngine } from '../../engine/MusicEngine'
import { TupletOffsetController } from './TupletOffsetController'
import { bus } from '@/bus'
import { tupletOffsetOverrideOf } from '../../engine/models/engravingOverrides'

/** Subject: {@link TupletOffsetController} — an ABSOLUTE box value turned into the facade's relative nudge. */
vi.mock('../../engine/rendering/ScoreRenderer', async () => (await import('@/testing/engineStubs')).scoreRendererStub())
vi.mock('../../engine/audio/PlaybackEngine', async () => (await import('@/testing/engineStubs')).playbackEngineStub())

describe('TupletOffsetController', () => {
  let engine: MusicEngine
  let controller: TupletOffsetController
  let renders: number
  let tupletId: string

  beforeEach(() => {
    engine = new MusicEngine({ container: {} as unknown as HTMLElement, width: 800, height: 400 })
    tupletId = engine.createTupletAtBeat(1, 0, '8', { step: 'E', alter: 0, octave: 4 }, 3, 2, 0)!.tuplet.id
    renders = 0
    controller = new TupletOffsetController(() => engine, () => { renders++ })
  })
  afterEach(() => controller.destroy())

  const y = () => tupletOffsetOverrideOf(engine.getScore(), tupletId)?.y

  it('⭐ an absolute value is the delta from the current one — one undo entry, one repaint', () => {
    bus.tupletOffset.set({ tupletId, y: -1.5 })
    expect(y()).toBe(-1.5)
    bus.tupletOffset.set({ tupletId, y: -1 })
    expect(y()).toBe(-1)
    expect(renders).toBe(2)
    expect(engine.undo()).toBe(true)
    expect(y()).toBe(-1.5)
  })

  it('⛔ the value it already has writes nothing; 0 clears', () => {
    bus.tupletOffset.set({ tupletId, y: 0 })
    expect(renders).toBe(0)
    bus.tupletOffset.set({ tupletId, y: 2 })
    bus.tupletOffset.set({ tupletId, y: 0 })
    expect(y()).toBeUndefined()
  })
})
