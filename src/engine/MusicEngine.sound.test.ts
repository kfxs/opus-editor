import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MusicEngine } from './MusicEngine'
import { DEFAULT_SOUND } from './models/soundOps'

/**
 * The SOUND as score data — the editor half: it undoes, and it survives a save and a load.
 *
 * ⭐⭐ THE BUG THIS FILE IS THE ANSWER TO: the sound used to be `PlaybackEngine.program`, a field on
 * the editor. Choosing an oboe and reloading gave you back a piano, because the choice was never in
 * the file — and undo could not reach it either. Both are asserted here, through the engine's own
 * export/import, because that is the path a user actually takes.
 */
// The `MusicEngine.test.ts` stub, whole: `loadJSON` renders, so the mock has to satisfy the render
// path as well as the edit path.
vi.mock('./rendering/ScoreRenderer', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./rendering/ScoreRenderer')>()),
  ScoreRenderer: class {
    initialize = vi.fn(); renderScore = vi.fn(); clearGhosts = vi.fn()
    setViewMode = vi.fn(); setLinearStaffSpacing = vi.fn(); setCullWindow = vi.fn()
    setLayoutReusable = vi.fn(); viewStateKey = vi.fn(() => 'stub-view-state')
    getAllMeasureBounds = vi.fn(() => new Map())
    getSystemOpeningMeasureNumber = vi.fn(() => undefined)
    getElementRegistry = vi.fn(() => ({
      clear: vi.fn(), register: vi.fn(), getAll: vi.fn(() => []),
      findAt: vi.fn(() => null), getById: vi.fn(() => null),
      registerStaffGeometry: vi.fn(), getStaffGeometry: vi.fn(() => null),
      getByMeasure: vi.fn(() => []),
    }))
  },
}))
vi.mock('./audio/PlaybackEngine', () => ({
  PlaybackEngine: class {
    setScore = vi.fn(); play = vi.fn(); pause = vi.fn(); stop = vi.fn(); setVolume = vi.fn()
    onStateChange = vi.fn(); preloadSound = vi.fn()
  },
}))

const OBOE = { kind: 'gm', program: 68 } as const

describe('MusicEngine sound', () => {
  let engine: MusicEngine

  beforeEach(() => {
    engine = new MusicEngine({ container: {} as unknown as HTMLElement, width: 800, height: 400 })
  })

  it('starts on the default — an implicit piano nobody stored', () => {
    expect(engine.getScoreSound()).toEqual(DEFAULT_SOUND)
    expect(engine.exportJSON()).not.toContain('playback')
  })

  it('SURVIVES A SAVE AND A LOAD, which is the whole point', () => {
    engine.setScoreSound(OBOE)
    const saved = engine.exportJSON()

    const reopened = new MusicEngine({ container: {} as unknown as HTMLElement, width: 800, height: 400 })
    reopened.loadJSON(saved)
    expect(reopened.getScoreSound()).toEqual(OBOE)
  })

  it('undoes like any other edit', () => {
    engine.setScoreSound(OBOE)
    expect(engine.getScoreSound()).toEqual(OBOE)

    expect(engine.undo()).toBe(true)
    expect(engine.getScoreSound()).toEqual(DEFAULT_SOUND)
    expect(engine.redo()).toBe(true)
    expect(engine.getScoreSound()).toEqual(OBOE)
  })

  /**
   * ⭐ A score is a VALUE (principle 1). The old field was on the editor, so loading a second score
   * into the same editor left the first one's timbre playing over it — inaudible until you noticed
   * the wrong instrument. Now the answer comes from whichever score is loaded.
   */
  it('belongs to the score, not to the editor holding it', () => {
    engine.setScoreSound(OBOE)
    const plain = new MusicEngine({ container: {} as unknown as HTMLElement, width: 800, height: 400 })
    engine.loadJSON(plain.exportJSON())
    expect(engine.getScoreSound()).toEqual(DEFAULT_SOUND)
  })
})
