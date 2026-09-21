/**
 * **The arrows on a GROUP of marks** — his report, 2026-09-21: two Ctrl-clicked hairpins would not
 * move. A REAL engine: the claim is about what is stored and how many undo entries it costs.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { fracCreate as frac } from '@/utils/fraction'
import { createEditorState, type EditorState } from '../state/EditorState'
import { itemKey, type SelectionItem } from '../state/selection'
import { nudgeMarkGroup, resetMarkGroup } from './groupKeys'
import { selectedElementKeys } from './selectedKeys'
import type { KeysCtx } from './keys'
import { makeEngine } from '@/testing/makeEngine'
import type { MusicEngine } from '../../engine/MusicEngine'
import type { HairpinEndpointOffsetOverride } from '@/types/music'

vi.mock('../../engine/rendering/ScoreRenderer', async () => (await import('@/testing/engineStubs')).scoreRendererStub())
vi.mock('../../engine/audio/PlaybackEngine', async () => (await import('@/testing/engineStubs')).playbackEngineStub())

describe('the arrows on a group of marks', () => {
  let engine: MusicEngine
  let state: EditorState
  let ctx: KeysCtx
  let render: ReturnType<typeof vi.fn<() => void>>
  let hairpins: string[]
  let note: string

  const select = (...items: SelectionItem[]) => {
    state.selectedItems = new Map(items.map(i => [itemKey(i), i]))
    state.selectedElement = null
  }
  const asHairpins = (ids: string[]) => ids.map((id): SelectionItem => ({ kind: 'hairpin', id }))
  /** Every authored override of `id`, as plain JSON — what moved, without naming the family's field. */
  const overridesOf = (id: string) => JSON.stringify(engine.getScore().engravingOverrides?.[id] ?? null)

  beforeEach(() => {
    engine = makeEngine()
    // His score: a whole note in each of two bars, a wedge on each.
    const a = engine.addNoteAtBeat({ step: 'C', alter: 0, octave: 4, duration: 'w', measure: 1, beat: frac(0, 1) })!
    const b = engine.addNoteAtBeat({ step: 'D', alter: 0, octave: 4, duration: 'w', measure: 2, beat: frac(0, 1) })!
    note = a.id
    hairpins = [
      engine.hairpin.createHairpin([a.id], 'cresc')!.id,
      engine.hairpin.createHairpin([b.id], 'dim')!.id,
    ]
    state = createEditorState()
    render = vi.fn<() => void>()
    ctx = { engine, state, render, afterMarkPress: vi.fn() }
  })

  it('🚨 his report: ↑ moves BOTH selected hairpins — one undo entry, one render', () => {
    select(...asHairpins(hairpins))
    const before = hairpins.map(overridesOf)

    expect(nudgeMarkGroup(ctx, 0, -0.25)).toBe(true)

    const after = hairpins.map(overridesOf)
    expect(after[0]).not.toBe(before[0])
    expect(after[1]).not.toBe(before[1])
    expect(after[0]).toBe(after[1].split(hairpins[1]).join(hairpins[0])) // the SAME nudge on each
    expect(render).toHaveBeenCalledTimes(1)
    expect(ctx.afterMarkPress).not.toHaveBeenCalled() // the members' own renders were silenced

    engine.undo()
    expect(hairpins.map(overridesOf)).toEqual(before)
  })

  it('the COARSE step is the same path with a bigger number', () => {
    select(...asHairpins(hairpins))
    nudgeMarkGroup(ctx, 0, -1)
    const stored = engine.getScore().engravingOverrides?.[hairpins[0]] as HairpinEndpointOffsetOverride[] | undefined
    expect(JSON.stringify(stored)).toContain('-1')
  })

  it('⛔ ←/→ DECLINE on a group — a horizontal arrow is a walk that can re-anchor', () => {
    select(...asHairpins(hairpins))
    expect(nudgeMarkGroup(ctx, 0.25, 0)).toBe(false)
    expect(render).not.toHaveBeenCalled()
  })

  it('⛔ a selection holding a NOTE declines — ↑/↓ re-pitch the passage, as before', () => {
    select({ kind: 'note', id: note }, ...asHairpins(hairpins))
    expect(nudgeMarkGroup(ctx, 0, -0.25)).toBe(false)
    expect(hairpins.map(overridesOf)).toEqual(['null', 'null'])
  })

  it('a single item is not a group — that is the selected element’s own row', () => {
    select(...asHairpins([hairpins[0]]))
    expect(nudgeMarkGroup(ctx, 0, -0.25)).toBe(false)
  })

  it('`Ctrl+Backspace` puts every member back, and DECLINES when none had moved', () => {
    select(...asHairpins(hairpins))
    expect(resetMarkGroup(ctx)).toBe(false)
    nudgeMarkGroup(ctx, 0, -0.5)
    expect(resetMarkGroup(ctx)).toBe(true)
    expect(hairpins.map(overridesOf)).toEqual(['null', 'null'])
  })

  it('⭐ the dispatch reaches the group when NO single element is selected', () => {
    select(...asHairpins(hairpins))
    const keys = selectedElementKeys(() => engine, state, () => ctx)
    expect(keys.nudge(0, -0.25)).toBe(true)
    expect(overridesOf(hairpins[1])).not.toBe('null')
    // …and reanchor / cycle stay the single element's: a group has no armed square.
    expect(keys.reanchor(1)).toBe(false)
    expect(keys.cycle(1)).toBe(false)
  })
})
