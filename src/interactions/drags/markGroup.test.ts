/**
 * **Dragging a GROUP of marks** — his report, 2026-09-21: two selected hairpins, and the drag took
 * only the first. A REAL engine: the claims are about what is stored and what the undo costs.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { fracCreate as frac } from '@/utils/fraction'
import { createEditorState, type EditorState } from '../state/EditorState'
import { itemKey, type SelectionItem } from '../state/selection'
import { armMarkGroupDrag, beginMarkGroupDrag, draggableMarkGroup } from './markGroup'
import type { ElementChainDeps, MouseDownCtx } from '../elements/chain'
import type { Gesture } from './gesture'
import { DRAG_TIME_THRESHOLD_MS, type DragHost } from './gesture'
import { makeEngine } from '@/testing/makeEngine'
import type { MusicEngine } from '../../engine/MusicEngine'

vi.mock('../../engine/rendering/ScoreRenderer', async () => (await import('@/testing/engineStubs')).scoreRendererStub())
vi.mock('../../engine/audio/PlaybackEngine', async () => (await import('@/testing/engineStubs')).playbackEngineStub())

describe('a group of marks, dragged', () => {
  let engine: MusicEngine
  let state: EditorState
  let host: DragHost & { render: { previewMarks: ReturnType<typeof vi.fn>; renderScore: ReturnType<typeof vi.fn> }; release: ReturnType<typeof vi.fn> }
  let click: ReturnType<typeof vi.fn<() => void>>
  let hairpins: string[]
  let note: string

  const overridesOf = (id: string) => JSON.stringify(engine.getScore().engravingOverrides?.[id] ?? null)
  const group = () => hairpins.map(id => ({ kind: 'hairpin' as const, id }))
  const select = (...items: SelectionItem[]) => { state.selectedItems = new Map(items.map(i => [itemKey(i), i])) }

  beforeEach(() => {
    vi.useFakeTimers()
    engine = makeEngine()
    const a = engine.addNoteAtBeat({ step: 'C', alter: 0, octave: 4, duration: 'w', measure: 1, beat: frac(0, 1) })!
    const b = engine.addNoteAtBeat({ step: 'D', alter: 0, octave: 4, duration: 'w', measure: 2, beat: frac(0, 1) })!
    note = a.id
    hairpins = [engine.hairpin.createHairpin([a.id], 'cresc')!.id, engine.hairpin.createHairpin([b.id], 'dim')!.id]
    state = createEditorState()
    click = vi.fn<() => void>()
    host = {
      getEngine: () => engine,
      render: { previewMarks: vi.fn(), renderScore: vi.fn() },
      release: vi.fn(),
      setCursor: vi.fn(),
    } as never
  })

  const drag = (moves: [number, number][]) => {
    const gesture = beginMarkGroupDrag(host, group(), group()[0], { x: 100, y: 100 }, click)
    vi.advanceTimersByTime(DRAG_TIME_THRESHOLD_MS + 1)
    for (const [x, y] of moves) gesture.move(engine, x, y)
    gesture.end()
  }

  it('🚨 his report: BOTH wedges move by what the hand travelled — one undo entry', () => {
    const before = hairpins.map(overridesOf)
    drag([[120, 130]]) // 20 px right, 30 px down = 2 and 3 staff spaces

    const after = hairpins.map(overridesOf)
    expect(after[0]).not.toBe(before[0])
    expect(after[1]).toBe(after[0].split(hairpins[0]).join(hairpins[1])) // the SAME offset on each
    expect(after[0]).toContain('2')
    expect(after[0]).toContain('3')
    expect(host.render.renderScore).toHaveBeenCalledTimes(1) // ⛔ the drop renders for real
    expect(click).not.toHaveBeenCalled()

    engine.undo()
    expect(hairpins.map(overridesOf)).toEqual(before)
  })

  it('the delta is measured from the last ACCEPTED frame — frames accumulate, they do not compound', () => {
    drag([[110, 100], [120, 100]]) // two frames of 10 px = 2 spaces in all, not 1 + 2
    const stored = JSON.parse(overridesOf(hairpins[0])) as Array<Record<string, unknown>>
    expect(JSON.stringify(stored)).toContain('"x":2')
  })

  it('a frame redraws the group’s FAMILY once, however many members it has', () => {
    drag([[110, 100]])
    expect(host.render.previewMarks).toHaveBeenCalledTimes(1)
    expect(host.render.previewMarks).toHaveBeenCalledWith('hairpin', hairpins[0])
  })

  it('⭐ a press that never became a drag is a CLICK — no write, no undo, and the click runs on release', () => {
    const before = hairpins.map(overridesOf)
    const undoable = engine.canUndo()
    const gesture = beginMarkGroupDrag(host, group(), group()[0], { x: 100, y: 100 }, click)
    gesture.move(engine, 140, 140) // inside the time threshold: not a drag yet
    gesture.end()

    expect(hairpins.map(overridesOf)).toEqual(before)
    expect(engine.canUndo()).toBe(undoable)
    expect(host.render.renderScore).not.toHaveBeenCalled()
    expect(click).toHaveBeenCalledTimes(1)
    expect(host.release).toHaveBeenCalledTimes(1)
  })

  describe('draggableMarkGroup', () => {
    it('two or more marks, and no note among the selection', () => {
      select(...hairpins.map((id): SelectionItem => ({ kind: 'hairpin', id })))
      expect(draggableMarkGroup(state)).toHaveLength(2)

      select({ kind: 'hairpin', id: hairpins[0] })
      expect(draggableMarkGroup(state), 'one mark is the single drag’s').toBeNull()

      select({ kind: 'note', id: note }, ...hairpins.map((id): SelectionItem => ({ kind: 'hairpin', id })))
      expect(draggableMarkGroup(state), 'a boxed passage is not this gesture’s').toBeNull()
    })
  })

  describe('armMarkGroupDrag — THE PRESS, asked before the chain can collapse the group', () => {
    /** A registry that has drawn ONE thing: `hairpins[0]`, as a horizontal line at y = 50. */
    const pressAt = (x: number, y: number, modifiers: Partial<MouseEvent> = {}): MouseDownCtx => ({
      event: { ctrlKey: false, metaKey: false, shiftKey: false, preventDefault: vi.fn(), ...modifiers } as unknown as MouseEvent,
      engine,
      registry: {
        getByType: (type: string) => (type === 'hairpin'
          ? [{ type: 'hairpin', id: hairpins[0], bbox: { x: 0, y: 45, width: 100, height: 10 }, points: [{ x: 0, y: 50 }, { x: 100, y: 50 }] }]
          : []),
      } as never,
      x, y, closestElement: null, tupletAtClick: null,
    })
    let armed: Gesture | null
    const deps = (): ElementChainDeps => ({
      pick: vi.fn(() => true as const), pickArticulationGroup: vi.fn(() => true as const),
      groupSymbolOf: () => undefined, isDoubleClick: () => false, openEditor: vi.fn(), openScoreTextDialog: vi.fn(),
      arm: (build: Parameters<ElementChainDeps['arm']>[0]) => { armed = build({ host } as never) },
    } as unknown as ElementChainDeps)

    beforeEach(() => {
      armed = null
      select(...hairpins.map((id): SelectionItem => ({ kind: 'hairpin', id })))
    })

    it('⭐ a plain press ON a member arms the group — and picks NOTHING, so the group survives the press', () => {
      const chain = deps()
      expect(armMarkGroupDrag(pressAt(50, 50), state, chain, host)).toBe(true)
      expect(armed?.kind).toBe('markGroup')
      expect(chain.pick).not.toHaveBeenCalled()
      expect(state.selectedItems.size).toBe(2)
    })

    it('…and the release of a press that never moved runs the chain — THAT is when the mark is picked', () => {
      const chain = deps()
      armMarkGroupDrag(pressAt(50, 50), state, chain, host)
      armed!.end()
      expect(chain.pick).toHaveBeenCalledWith({ kind: 'hairpin', id: hairpins[0] }, expect.anything())
    })

    it('⛔ declines off the marks, with a modifier held, and when the selection is not a group of marks', () => {
      expect(armMarkGroupDrag(pressAt(50, 300), state, deps(), host), 'empty space').toBe(false)
      expect(armMarkGroupDrag(pressAt(50, 50, { ctrlKey: true }), state, deps(), host), 'Ctrl toggles membership').toBe(false)
      expect(armMarkGroupDrag(pressAt(50, 50, { shiftKey: true }), state, deps(), host)).toBe(false)

      select({ kind: 'hairpin', id: hairpins[0] })
      expect(armMarkGroupDrag(pressAt(50, 50), state, deps(), host), 'one mark: its own drag').toBe(false)
      expect(armed).toBeNull()
    })

    it('⛔ a press on a mark that is NOT in the group declines — the chain picks it, as a click always did', () => {
      select({ kind: 'hairpin', id: hairpins[1] }, { kind: 'dynamic', id: 'd1' } as SelectionItem)
      expect(armMarkGroupDrag(pressAt(50, 50), state, deps(), host)).toBe(false)
    })
  })
})

