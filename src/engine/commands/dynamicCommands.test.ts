/**
 * The DYNAMIC's commands, driven through the facade (`engine.dynamic.…`) with the renderer and
 * playback stubbed — the two chapters that were `MusicEngine.test.ts`'s until the commands left it.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { levelToGlyphString, dynamicLevelOf } from '@/utils/dynamics'
import { MusicEngine } from '../MusicEngine'
import { dynamicOffsetOverrideOf } from '../models/engravingOverrides'
import { fracCreate as frac } from '@/utils/fraction'

// Stub ScoreRenderer (needs canvas/SVG) and PlaybackEngine (needs Web Audio)
const fakeRegistry = {
  clear: vi.fn(), register: vi.fn(), getAll: vi.fn(() => []),
  findAt: vi.fn(() => null), getByNoteId: vi.fn(() => null),
  registerStaffGeometry: vi.fn(), getStaffGeometry: vi.fn(() => null),
}
vi.mock('../rendering/ScoreRenderer', async (importOriginal) => ({
  // Keep the module's real constants (LAYOUT_CONFIG — the staff-spacing clamp reads it); only the
  // renderer class needs stubbing, since it wants a canvas/SVG.
  ...(await importOriginal<typeof import('../rendering/ScoreRenderer')>()),
  ScoreRenderer: class {
    initialize = vi.fn()
    renderScore = vi.fn()
    getElementRegistry = vi.fn(() => fakeRegistry)
    setViewMode = vi.fn()
    setLinearStaffSpacing = vi.fn()
    setCullWindow = vi.fn()
    setLayoutReusable = vi.fn()
    // P3's skip test (docs/history/render-performance-plan.md §5a) reads the view state off the
    // renderer. The stub's view state never changes, so `isRenderStale` here answers purely
    // "did the content change?" — which is exactly what the tests below exercise.
    viewStateKey = vi.fn(() => 'stub-view-state')
    clearGhosts = vi.fn()
    // Nothing is drawn, so there are no bounds to feed the coordinate mapper.
    getAllMeasureBounds = vi.fn(() => new Map())
    // Nothing is laid out in a stubbed renderer, so no measure opens a system: the per-system
    // staff-spacing key can't be resolved, exactly as before a first render.
    getSystemOpeningMeasureNumber = vi.fn(() => undefined)
  },
}))
vi.mock('../audio/PlaybackEngine', () => ({
  PlaybackEngine: class {
    setScore = vi.fn()
    play = vi.fn()
    pause = vi.fn()
    stop = vi.fn()
    setVolume = vi.fn()
    onStateChange = vi.fn()
  },
}))

function makeEngine(): MusicEngine {
  const container = {} as unknown as HTMLElement
  const engine = new MusicEngine({ container, width: 800, height: 400 })
  // Add a second measure for overflow tests
  engine.addMeasure()
  return engine
}

describe('dynamicCommands — through the facade', () => {
  let engine: MusicEngine
  beforeEach(() => { engine = makeEngine() })

  const dynsOf = (m: number) => engine.getScore().measures.find(x => x.number === m)!.dynamics

  it('adds a dynamic and returns it with an id', () => {
    const d = engine.dynamic.addDynamic(1, { beat: frac(0, 1), text: levelToGlyphString('p') })
    expect(d?.id).toBeTruthy()
    expect(engine.getDynamics(1)).toHaveLength(1)
  })

  // Multi-staff: dynamics are stamped with the placing staff's id so they render on that
  // staff (the placement paths resolve it via engine.staffIdForIndex). Index 0 → absent.
  it('staffIdForIndex follows the write convention (0 → absent, later → real id)', () => {
    engine.addStaffBelow(0)
    expect(engine.staffIdForIndex(0)).toBeUndefined()
    expect(engine.staffIdForIndex(1)).toBe(engine.getScore().staves![1].id)
  })

  it('stamps the staffId on a dynamic placed on a later staff', () => {
    engine.addStaffBelow(0)
    const staff1Id = engine.getScore().staves![1].id
    const d = engine.dynamic.addDynamic(1, { beat: frac(0, 1), text: levelToGlyphString('f'), staffId: staff1Id })
    expect(d?.staffId).toBe(staff1Id)
  })

  it('undo/redo restores and re-applies an added dynamic', () => {
    engine.dynamic.addDynamic(1, { beat: frac(0, 1), text: levelToGlyphString('f') })
    expect(dynsOf(1)).toHaveLength(1)

    expect(engine.undo()).toBe(true)
    expect(dynsOf(1)).toBeUndefined()

    expect(engine.redo()).toBe(true)
    expect(dynamicLevelOf(dynsOf(1)![0])).toBe('f')
  })

  describe('⭐ a typed-in dynamic is ONE edit (his report, 2026-09-22)', () => {
    it('the placement is a preview: no undo entry until the text is committed', () => {
      const before = engine.canUndo()
      const d = engine.dynamic.placeDynamicForTyping(1, { beat: frac(0, 1), text: 'Text' })!
      expect(dynsOf(1)).toHaveLength(1)
      expect(engine.canUndo()).toBe(before)
      engine.dynamic.commitTypedDynamic(d.id, 'dolce')
      expect(dynsOf(1)![0].text).toBe('dolce')
      expect(engine.canUndo()).toBe(true)
    })

    it('🚨 ONE Ctrl+Z takes the whole mark away — never back to the placeholder', () => {
      const d = engine.dynamic.placeDynamicForTyping(1, { beat: frac(0, 1), text: 'Text' })!
      engine.dynamic.commitTypedDynamic(d.id, 'dolce')
      expect(engine.undo()).toBe(true)
      expect(dynsOf(1) ?? []).toHaveLength(0)
      expect(engine.redo()).toBe(true)
      expect(dynsOf(1)![0].text).toBe('dolce')
    })

    it('🚨 the commit leaves the picture STALE — the text must reach the screen (his report: “enter is broken”)', () => {
      const d = engine.dynamic.placeDynamicForTyping(1, { beat: frac(0, 1), text: 'Text' })!
      engine.renderScore()
      expect(engine.isRenderStale()).toBe(false)
      engine.dynamic.commitTypedDynamic(d.id, 'dolce')
      expect(engine.isRenderStale()).toBe(true)
    })

    it('an EDIT of an existing mark still undoes to its old text', () => {
      const d = engine.dynamic.placeDynamicForTyping(1, { beat: frac(0, 1), text: 'Text' })!
      engine.dynamic.commitTypedDynamic(d.id, 'dolce')
      engine.dynamic.updateDynamic(d.id, { text: 'espr.' })
      engine.undo()
      expect(dynsOf(1)![0].text).toBe('dolce')
    })

    it('a discarded preview leaves no mark and no undo entry', () => {
      const before = engine.canUndo()
      const d = engine.dynamic.placeDynamicForTyping(1, { beat: frac(0, 1), text: 'Text' })!
      expect(engine.dynamic.discardTypedDynamic(d.id)).toBe(true)
      expect(dynsOf(1) ?? []).toHaveLength(0)
      expect(engine.canUndo()).toBe(before)
    })
  })

  it('updates a dynamic and undo restores the prior value', () => {
    const d = engine.dynamic.addDynamic(1, { beat: frac(0, 1), text: levelToGlyphString('p') })!
    engine.dynamic.updateDynamic(d.id, { text: levelToGlyphString('f') })
    expect(dynamicLevelOf(engine.getDynamics(1)[0])).toBe('f')

    expect(engine.undo()).toBe(true)
    expect(dynamicLevelOf(engine.getDynamics(1)[0])).toBe('p')
  })

  it('removes a dynamic and undo restores it', () => {
    const d = engine.dynamic.addDynamic(1, { beat: frac(0, 1), text: levelToGlyphString('p') })!
    expect(engine.dynamic.removeDynamic(d.id)).toBe(true)
    expect(engine.getDynamics(1)).toEqual([])

    expect(engine.undo()).toBe(true)
    expect(engine.getDynamics(1)).toHaveLength(1)
  })

  it('resolves the active level through the engine', () => {
    engine.dynamic.addDynamic(1, { beat: frac(0, 1), text: levelToGlyphString('p') })
    expect(engine.getActiveLevel(1, frac(2, 1))).toBe('p')
    expect(engine.getActiveLevel(2, frac(0, 1))).toBe('p') // inherited into measure 2
  })
})

describe('dynamicCommands.nudgeDynamicOffset — client #8 position nudge', () => {
  let engine: MusicEngine
  beforeEach(() => { engine = makeEngine() })

  const offsetOf = (id: string) => dynamicOffsetOverrideOf(engine.getScore(), id)

  it('accumulates dx/dy onto any existing offset', () => {
    const d = engine.dynamic.addDynamic(1, { beat: frac(0, 1), text: levelToGlyphString('p') })!
    expect(engine.dynamic.nudgeDynamicOffset(d.id, 0, -0.25)).toBe(true)
    expect(engine.dynamic.nudgeDynamicOffset(d.id, 1, -0.25)).toBe(true)
    expect(offsetOf(d.id)).toMatchObject({ kind: 'dynamicOffset', x: 1, y: -0.5 })
  })

  it('clears the override when the net offset returns to (0,0)', () => {
    const d = engine.dynamic.addDynamic(1, { beat: frac(0, 1), text: levelToGlyphString('f') })!
    engine.dynamic.nudgeDynamicOffset(d.id, 1, -1)
    expect(offsetOf(d.id)).toBeDefined()
    engine.dynamic.nudgeDynamicOffset(d.id, -1, 1)
    expect(offsetOf(d.id)).toBeUndefined() // absent = default, JSON stays clean
  })

  it('is a no-op for a missing dynamic id', () => {
    expect(engine.dynamic.nudgeDynamicOffset('no-such-id', 1, 1)).toBe(false)
  })

  it('undo restores the prior offset (one step per press)', () => {
    const d = engine.dynamic.addDynamic(1, { beat: frac(0, 1), text: levelToGlyphString('p') })!
    engine.dynamic.nudgeDynamicOffset(d.id, 0, -1)
    engine.dynamic.nudgeDynamicOffset(d.id, 0, -1)
    expect(offsetOf(d.id)).toMatchObject({ y: -2 })

    expect(engine.undo()).toBe(true)
    expect(offsetOf(d.id)).toMatchObject({ y: -1 })
  })
})
