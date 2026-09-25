import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { MusicEngine } from '../../engine/MusicEngine'
import { GlissandoEditController } from './GlissandoEditController'
import { bus } from '@/bus'
import { fracCreate as frac } from '@/utils/fraction'

vi.mock('../../engine/rendering/ScoreRenderer', async () => (await import('@/testing/engineStubs')).scoreRendererStub())
vi.mock('../../engine/audio/PlaybackEngine', async () => (await import('@/testing/engineStubs')).playbackEngineStub())

/**
 * Subject: {@link GlissandoEditController} — the apply behind the Properties glissando rows. A content edit:
 * each change is one undo entry and a repaint; a re-pick writes nothing.
 */
describe('GlissandoEditController', () => {
  let engine: MusicEngine
  let controller: GlissandoEditController
  let renders: number
  let glissandoId: string

  beforeEach(() => {
    engine = new MusicEngine({ container: {} as unknown as HTMLElement, width: 800, height: 400 })
    const c = engine.addNoteAtBeat({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })!.id
    engine.addNoteAtBeat({ step: 'G', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
    engine.glissando.add([c])
    glissandoId = engine.glissando.on(c)!.id
    renders = 0
    controller = new GlissandoEditController(() => engine, () => { renders++ })
  })
  afterEach(() => controller.destroy())

  const g = () => engine.glissando.byId(glissandoId)!

  it('side / goes-to / direction each write, repaint, and undo', () => {
    bus.glissandoEdit.set({ glissandoId, end: 'none' })
    expect(g().end).toBe('none')
    bus.glissandoEdit.set({ glissandoId, direction: 'up' })
    expect(g().direction).toBe('up')
    bus.glissandoEdit.set({ glissandoId, side: 'before' })
    expect(g().side).toBe('before')
    expect(renders).toBe(3)
    expect(engine.undo()).toBe(true)
    expect('side' in g()).toBe(false)
  })

  it('a re-pick writes nothing and does not repaint', () => {
    bus.glissandoEdit.set({ glissandoId, side: 'after' })
    bus.glissandoEdit.set({ glissandoId, end: 'next' })
    expect(renders).toBe(0)
  })
})
