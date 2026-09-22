/**
 * **Align in a Row** (`Ctrl+Shift+R`) — his ask, 2026-09-22. A REAL engine over a REAL registry that a
 * spec seeds by hand: the claim is about what is stored after the press, given where the last render
 * says the marks were.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { fracCreate as frac } from '@/utils/fraction'
import { createEditorState, type EditorState } from '../state/EditorState'
import { itemKey, type SelectionItem } from '../state/selection'
import { alignMarkRow } from './alignRow'
import { selectedElementKeys } from './selectedKeys'
import type { KeysCtx } from './keys'
import { makeEngine } from '@/testing/makeEngine'
import { ElementRegistry, type ElementType } from '../../engine/ElementRegistry'
import type { MusicEngine } from '../../engine/MusicEngine'
import type { DynamicOffsetOverride, HairpinEndpointOffsetOverride } from '@/types/music'
import { levelToGlyphString } from '@/utils/dynamics'

vi.mock('../../engine/rendering/ScoreRenderer', async () => (await import('@/testing/engineStubs')).scoreRendererStub())
vi.mock('../../engine/audio/PlaybackEngine', async () => (await import('@/testing/engineStubs')).playbackEngineStub())

const SPACE_PX = 10

describe('Align in a Row', () => {
  let engine: MusicEngine
  let state: EditorState
  let ctx: KeysCtx
  let registry: ElementRegistry
  let render: ReturnType<typeof vi.fn<() => void>>
  let hairpins: string[]
  let noteIds: string[]

  const select = (...items: SelectionItem[]) => {
    state.selectedItems = new Map(items.map(i => [itemKey(i), i]))
    state.selectedElement = null
  }
  const asHairpins = (ids: string[]) => ids.map((id): SelectionItem => ({ kind: 'hairpin', id }))
  /** The last render's word on a mark: a box whose vertical centre is `centreY`, in bar `measure`. */
  const drawn = (type: ElementType, id: string, measure: number, centreY: number) =>
    registry.add({ type, id, measure, staff: 0, bbox: { x: 100 * measure, y: centreY - 5, width: 40, height: 10 } })
  const hairpinYs = (id: string) => {
    const over = (engine.getScore().engravingOverrides?.[id] ?? []) as HairpinEndpointOffsetOverride[]
    const ends = over.find(o => o.kind === 'hairpinEndpointOffset')
    return [ends?.start?.y ?? 0, ends?.end?.y ?? 0]
  }
  const dynamicY = (id: string) => {
    const over = (engine.getScore().engravingOverrides?.[id] ?? []) as DynamicOffsetOverride[]
    return over.find(o => o.kind === 'dynamicOffset')?.y ?? 0
  }

  beforeEach(() => {
    engine = makeEngine()
    const a = engine.addNoteAtBeat({ step: 'C', alter: 0, octave: 4, duration: 'w', measure: 1, beat: frac(0, 1) })!
    const b = engine.addNoteAtBeat({ step: 'D', alter: 0, octave: 4, duration: 'w', measure: 2, beat: frac(0, 1) })!
    noteIds = [a.id, b.id]
    hairpins = [
      engine.hairpin.createHairpin([a.id], 'cresc')!.id,
      engine.hairpin.createHairpin([b.id], 'dim')!.id,
    ]
    registry = new ElementRegistry()
    for (const measure of [1, 2]) {
      registry.setStaffGeometry({
        measure, staff: 0, lineSpacing: SPACE_PX, noteStartX: 100 * measure, noteEndX: 100 * measure + 90, clef: 'treble',
        lineYPositions: [100, 110, 120, 130, 140],
      })
    }
    vi.spyOn(engine, 'getElementRegistry').mockReturnValue(registry)
    state = createEditorState()
    render = vi.fn<() => void>()
    ctx = { engine, state, render, afterMarkPress: vi.fn() }
  })

  it('⭐ two wedges at different heights meet at the AVERAGE — one undo entry, one render', () => {
    drawn('hairpin', hairpins[0], 1, 200) // 2 spaces apart: they meet 1 space from each
    drawn('hairpin', hairpins[1], 2, 220)
    select(...asHairpins(hairpins))

    expect(alignMarkRow(ctx)).toBe(true)

    expect(hairpinYs(hairpins[0])).toEqual([1, 1])   // down by one space (screen +y)
    expect(hairpinYs(hairpins[1])).toEqual([-1, -1]) // up by one
    expect(render).toHaveBeenCalledTimes(1)
    expect(ctx.afterMarkPress).not.toHaveBeenCalled()

    engine.undo()
    expect(hairpinYs(hairpins[0])).toEqual([0, 0])
    expect(hairpinYs(hairpins[1])).toEqual([0, 0])
  })

  it('a mark carrying a nudge already keeps it and adds the journey — the row is where it WAS DRAWN', () => {
    engine.hairpin.nudgeHairpin(hairpins[0], 0, 0.5)
    drawn('hairpin', hairpins[0], 1, 205) // drawn where its nudge put it
    drawn('hairpin', hairpins[1], 2, 225)
    select(...asHairpins(hairpins))
    alignMarkRow(ctx)
    expect(hairpinYs(hairpins[0])).toEqual([1.5, 1.5])
    expect(hairpinYs(hairpins[1])).toEqual([-1, -1])
  })

  it('⭐ a DYNAMIC and a wedge share the row — each through its own family’s nudge', () => {
    const p = engine.dynamic.addDynamic(1, { beat: frac(0, 1), text: levelToGlyphString('p') })!
    drawn('dynamic', p.id, 1, 190)
    drawn('hairpin', hairpins[1], 2, 230)
    select({ kind: 'dynamic', id: p.id }, ...asHairpins([hairpins[1]]))
    expect(alignMarkRow(ctx)).toBe(true)
    expect(dynamicY(p.id)).toBe(2)
    expect(hairpinYs(hairpins[1])).toEqual([-2, -2])
  })

  it('a member drawn on a SMALL staff travels the same pixels in fewer of its own spaces', () => {
    registry.setStaffGeometry({
      measure: 2, staff: 0, lineSpacing: SPACE_PX / 2, noteStartX: 200, noteEndX: 290, clef: 'treble',
      lineYPositions: [100, 105, 110, 115, 120],
    })
    drawn('hairpin', hairpins[0], 1, 200)
    drawn('hairpin', hairpins[1], 2, 220)
    select(...asHairpins(hairpins))
    alignMarkRow(ctx)
    expect(hairpinYs(hairpins[0])).toEqual([1, 1])
    expect(hairpinYs(hairpins[1])).toEqual([-2, -2]) // 10 px is two of ITS spaces
  })

  it('already in a row → nothing written, and the verb declines', () => {
    drawn('hairpin', hairpins[0], 1, 200)
    drawn('hairpin', hairpins[1], 2, 200)
    select(...asHairpins(hairpins))
    const before = JSON.stringify(engine.getScore().engravingOverrides ?? null)
    expect(alignMarkRow(ctx)).toBe(false)
    expect(JSON.stringify(engine.getScore().engravingOverrides ?? null)).toBe(before)
    expect(render).not.toHaveBeenCalled()
  })

  it('⛔ a member the last render did not draw is left out; fewer than two drawn → decline', () => {
    drawn('hairpin', hairpins[0], 1, 200)
    select(...asHairpins(hairpins))
    expect(alignMarkRow(ctx)).toBe(false)
    expect(hairpinYs(hairpins[0])).toEqual([0, 0])
  })

  it('⛔ a selection holding a NOTE, or a single mark, is not a group', () => {
    drawn('hairpin', hairpins[0], 1, 200)
    drawn('hairpin', hairpins[1], 2, 220)
    select({ kind: 'note', id: noteIds[0] }, ...asHairpins(hairpins))
    expect(alignMarkRow(ctx)).toBe(false)
    select(...asHairpins([hairpins[0]]))
    expect(alignMarkRow(ctx)).toBe(false)
  })

  it('⭐ the dispatch: `alignRow` reaches the group only with NO single element selected', () => {
    drawn('hairpin', hairpins[0], 1, 200)
    drawn('hairpin', hairpins[1], 2, 220)
    select(...asHairpins(hairpins))
    const keys = selectedElementKeys(() => engine, state, () => ctx)
    state.selectedElement = { kind: 'hairpin', id: hairpins[0] }
    expect(keys.alignRow()).toBe(false)
    state.selectedElement = null
    expect(keys.alignRow()).toBe(true)
  })
})
