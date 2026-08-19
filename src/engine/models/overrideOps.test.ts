/**
 * {@link overrideOps} — the WRITE side of the engraving-overrides compartment.
 *
 * The storage contract (upsert by kind, clear, prune, "absent = none", rides the undo snapshot for
 * free) plus the clients whose whole job is *accumulate and clear at the default*: the rest shift,
 * the rest hide toggle, and staff spacing. The pure READERS stay next door in
 * `engravingOverrides.test.ts` — that split mirrors the modules, and it is the point: the renderer
 * imports the readers and cannot reach these.
 *
 * A `ScoreModel` is the FIXTURE — its delegators are how these are reached. Extracted from
 * `engravingOverrides.test.ts` on 2026-07-28 by the modularity plan's Phase 3, under Phase 0's rule
 * that *a spec moves with its module*.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { ScoreModel } from './ScoreModel'
import { restPositionKey, restShiftOverrideOf, restHiddenOf, staffSpacingOverrideOf, staffSpacingAbove, tempoOffsetOverrideOf, dynamicOffsetOverrideOf } from './engravingOverrides'
import type { EngravingOverride } from '@/types/music'
import { fracCreate as frac } from '@/utils/fraction'

/**
 * Phase 0 of the engraving-overrides plan: the compartment is pure infrastructure —
 * id-keyed storage + accessors + JSON round-trip, NO clients yet. These tests pin the
 * accessor contract (upsert, get, clear, pruning) and the "absent = none, JSON stays
 * clean, rides the undo snapshot for free" invariants. The concrete `curveShape` kind
 * arrives in Phase 1; here we use a stand-in kind so the storage layer is exercised
 * without depending on a schema that is intentionally not yet pinned.
 */
describe('ScoreModel engraving overrides (Phase 0 compartment)', () => {
  let model: ScoreModel

  // A stand-in override; Phase 0 only typed the `kind` discriminator, so extra data
  // rides along as an opaque payload.
  const nudge = (dy: number): EngravingOverride => ({ kind: 'offset', dy } as EngravingOverride)
  const reshape = (): EngravingOverride => ({ kind: 'curveShape' } as EngravingOverride)

  beforeEach(() => {
    model = new ScoreModel('Test Score')
  })

  it('starts empty: no compartment on a fresh score, accessors degrade to none', () => {
    expect(model.getScore().engravingOverrides).toBeUndefined()
    expect(model.getEngravingOverrides('note-1')).toEqual([])
    expect(model.getEngravingOverride('note-1', 'offset')).toBeUndefined()
  })

  it('set creates the compartment lazily and stores by element id', () => {
    model.setEngravingOverride('note-1', nudge(2))
    expect(model.getScore().engravingOverrides).toBeDefined()
    expect(model.getEngravingOverride('note-1', 'offset')).toEqual({ kind: 'offset', dy: 2 })
    expect(model.getEngravingOverrides('note-1')).toHaveLength(1)
  })

  it('set upserts by kind: same kind replaces, different kind appends', () => {
    model.setEngravingOverride('note-1', nudge(2))
    model.setEngravingOverride('note-1', nudge(5)) // same kind → replace
    expect(model.getEngravingOverride('note-1', 'offset')).toEqual({ kind: 'offset', dy: 5 })
    expect(model.getEngravingOverrides('note-1')).toHaveLength(1)

    model.setEngravingOverride('note-1', reshape()) // different kind → append
    expect(model.getEngravingOverrides('note-1')).toHaveLength(2)
    expect(model.getEngravingOverride('note-1', 'curveShape')).toBeDefined()
    expect(model.getEngravingOverride('note-1', 'offset')).toEqual({ kind: 'offset', dy: 5 })
  })

  it('keeps overrides on different elements isolated', () => {
    model.setEngravingOverride('note-1', nudge(2))
    model.setEngravingOverride('note-2', nudge(9))
    expect(model.getEngravingOverride('note-1', 'offset')).toEqual({ kind: 'offset', dy: 2 })
    expect(model.getEngravingOverride('note-2', 'offset')).toEqual({ kind: 'offset', dy: 9 })
  })

  it('clear(id, kind) removes just that kind; clear(id) removes all for the element', () => {
    model.setEngravingOverride('note-1', nudge(2))
    model.setEngravingOverride('note-1', reshape())

    expect(model.clearEngravingOverride('note-1', 'offset')).toBe(true)
    expect(model.getEngravingOverride('note-1', 'offset')).toBeUndefined()
    expect(model.getEngravingOverride('note-1', 'curveShape')).toBeDefined()

    expect(model.clearEngravingOverride('note-1')).toBe(true)
    expect(model.getEngravingOverrides('note-1')).toEqual([])
  })

  it('clear returns false when there is nothing to remove', () => {
    expect(model.clearEngravingOverride('ghost')).toBe(false)
    model.setEngravingOverride('note-1', nudge(2))
    expect(model.clearEngravingOverride('note-1', 'curveShape')).toBe(false) // wrong kind
    expect(model.clearEngravingOverride('note-2', 'offset')).toBe(false) // wrong id
  })

  it('prunes empty entries and the whole compartment so absent = none', () => {
    model.setEngravingOverride('note-1', nudge(2))
    model.clearEngravingOverride('note-1', 'offset')
    // last kind on the element gone → element entry pruned, compartment pruned
    expect(model.getScore().engravingOverrides).toBeUndefined()
  })

  it('round-trips through JSON unchanged (export/import) and stays absent when empty', () => {
    // Empty score → no engravingOverrides key in the JSON.
    expect(model.toJSON()).not.toContain('engravingOverrides')

    model.setEngravingOverride('note-1', nudge(3))
    model.setEngravingOverride('note-1', reshape())
    model.setEngravingOverride('note-2', nudge(-1))

    const restored = ScoreModel.fromJSON(model.toJSON())
    expect(restored.getEngravingOverride('note-1', 'offset')).toEqual({ kind: 'offset', dy: 3 })
    expect(restored.getEngravingOverride('note-1', 'curveShape')).toBeDefined()
    expect(restored.getEngravingOverride('note-2', 'offset')).toEqual({ kind: 'offset', dy: -1 })
  })

  it('rides the whole-score JSON snapshot (the undo currency) unchanged', () => {
    model.setEngravingOverride('note-1', nudge(4))
    // Mirror UndoRedoManager's deep copy: structuredClone-free JSON round-trip.
    const snapshot = JSON.parse(JSON.stringify(model.getScore()))
    expect(snapshot.engravingOverrides['note-1']).toEqual([{ kind: 'offset', dy: 4 }])
  })
})

describe('ScoreModel.nudgeRestShift (accumulate / clear, position-keyed)', () => {
  let model: ScoreModel
  const key = restPositionKey('m1', 0, frac(1, 1))
  const shift = (k: string) => restShiftOverrideOf(model.getScore(), k)

  beforeEach(() => { model = new ScoreModel('Test Score') })

  it('reader returns undefined when no shift is stored', () => {
    expect(shift(key)).toBeUndefined()
  })

  it('ACCUMULATES up/down nudges into one running total', () => {
    model.nudgeRestShift(key, 1)
    model.nudgeRestShift(key, 1)
    expect(shift(key)).toEqual({ kind: 'restShift', steps: 2 })
    model.nudgeRestShift(key, -1)
    expect(shift(key)!.steps).toBe(1)
  })

  it('clears the entry (and prunes the compartment) when the net shift returns to 0', () => {
    model.nudgeRestShift(key, 2)
    model.nudgeRestShift(key, -2)
    expect(shift(key)).toBeUndefined()
    expect(model.getScore().engravingOverrides).toBeUndefined()
  })

  it('keeps per-voice seats independent (V1 up, V2 down on the same beat)', () => {
    const v0 = restPositionKey('m1', 0, frac(1, 1))
    const v1 = restPositionKey('m1', 1, frac(1, 1))
    model.nudgeRestShift(v0, 1)
    model.nudgeRestShift(v1, -1)
    expect(shift(v0)!.steps).toBe(1)
    expect(shift(v1)!.steps).toBe(-1)
  })
})

// Client #6 (rest hidden) — payloadless, presence-based toggle, position-keyed like #5.
describe('ScoreModel.toggleRestHidden (presence toggle, position-keyed)', () => {
  let model: ScoreModel
  const key = restPositionKey('m1', 0, frac(1, 1))
  const hidden = (k: string) => restHiddenOf(model.getScore(), k)

  beforeEach(() => { model = new ScoreModel('Test Score') })

  it('reader returns false when nothing is stored', () => {
    expect(hidden(key)).toBe(false)
  })

  it('toggles hidden on, then off (and prunes the compartment)', () => {
    model.toggleRestHidden(key)
    expect(hidden(key)).toBe(true)
    model.toggleRestHidden(key)
    expect(hidden(key)).toBe(false)
    expect(model.getScore().engravingOverrides).toBeUndefined()
  })

  it('coexists with a rest shift at the same position (independent kinds)', () => {
    model.nudgeRestShift(key, 1)
    model.toggleRestHidden(key)
    expect(restShiftOverrideOf(model.getScore(), key)!.steps).toBe(1)
    expect(hidden(key)).toBe(true)
    // Clearing the shift leaves the hidden flag intact.
    model.nudgeRestShift(key, -1)
    expect(restShiftOverrideOf(model.getScore(), key)).toBeUndefined()
    expect(hidden(key)).toBe(true)
  })
})

describe('ScoreModel.nudgeTempoOffset / resetTempoOffset (accumulate / clear, id-keyed)', () => {
  // Client #13 (his ask, 2026-08-19). The dynamic's contract one client later, and the two claims
  // that keep the compartment honest: it ACCUMULATES, and a net zero leaves NOTHING behind — an
  // absent override and a `{0,0}` one must not both be reachable, or the JSON has two spellings of
  // "not nudged".
  let model: ScoreModel

  beforeEach(() => { model = new ScoreModel() })

  it('⭐ accumulates both axes', () => {
    model.nudgeTempoOffset('t1', 0.25, 0)
    model.nudgeTempoOffset('t1', 0.25, -1)
    expect(tempoOffsetOverrideOf(model.getScore(), 't1')).toMatchObject({ x: 0.5, y: -1 })
  })

  it('⭐ clears the entry at a net (0,0), so "absent = default" holds', () => {
    model.nudgeTempoOffset('t1', 1, -2)
    model.nudgeTempoOffset('t1', -1, 2)
    expect(tempoOffsetOverrideOf(model.getScore(), 't1')).toBeUndefined()
    expect(model.getScore().engravingOverrides).toBeUndefined()
  })

  it('⭐ `Ctrl+Backspace` drops it whole — and DECLINES when there was nothing to drop', () => {
    // The decline is the contract: the reset key has other tenants behind this branch.
    expect(model.resetTempoOffset('t1'), 'nothing authored').toBe(false)
    model.nudgeTempoOffset('t1', 1, -2)
    expect(model.resetTempoOffset('t1')).toBe(true)
    expect(tempoOffsetOverrideOf(model.getScore(), 't1')).toBeUndefined()
  })

  it('⚠️ is INDEPENDENT of the dynamic offset — one compartment, two kinds', () => {
    model.nudgeDynamicOffset('x1', 3, 0)
    model.nudgeTempoOffset('x1', 0, -4)
    expect(dynamicOffsetOverrideOf(model.getScore(), 'x1')).toMatchObject({ x: 3, y: 0 })
    expect(tempoOffsetOverrideOf(model.getScore(), 'x1')).toMatchObject({ x: 0, y: -4 })
  })
})

describe('ScoreModel.nudgeStaffSpacing (accumulate / clear, id-keyed)', () => {
  let model: ScoreModel
  const above = (id: string) => staffSpacingOverrideOf(model.getScore(), id)?.above ?? 0
  beforeEach(() => { model = new ScoreModel('Test Score') })

  it('ACCUMULATES up/down nudges into one running total', () => {
    model.nudgeStaffSpacing('staff-1', 1)
    model.nudgeStaffSpacing('staff-1', 4)
    expect(above('staff-1')).toBe(5)
    model.nudgeStaffSpacing('staff-1', -1)
    expect(above('staff-1')).toBe(4)
  })

  it('clears the entry (and prunes the compartment) when the net value returns to 0', () => {
    model.nudgeStaffSpacing('staff-1', 4)
    model.nudgeStaffSpacing('staff-1', -4)
    expect(staffSpacingOverrideOf(model.getScore(), 'staff-1')).toBeUndefined()
    expect(model.getScore().engravingOverrides).toBeUndefined()
  })

  it('keeps per-staff seats independent', () => {
    model.nudgeStaffSpacing('staff-1', 2)
    model.nudgeStaffSpacing('staff-2', -3)
    expect(above('staff-1')).toBe(2)
    expect(above('staff-2')).toBe(-3)
  })
})

describe('ScoreModel.setStaffSpacing / resetStaffSpacing (absolute, id-keyed)', () => {
  let model: ScoreModel
  beforeEach(() => { model = new ScoreModel('Test Score') })

  it('sets an absolute value and clears on 0', () => {
    model.setStaffSpacing('staff-1', 6)
    expect(staffSpacingAbove(model.getScore(), 'staff-1')).toBe(6)
    model.setStaffSpacing('staff-1', 0)
    expect(staffSpacingOverrideOf(model.getScore(), 'staff-1')).toBeUndefined()
    expect(model.getScore().engravingOverrides).toBeUndefined()
  })

  it('resetStaffSpacing drops the override and reports whether anything was removed', () => {
    model.setStaffSpacing('staff-1', 5)
    expect(model.resetStaffSpacing('staff-1')).toBe(true)
    expect(staffSpacingAbove(model.getScore(), 'staff-1')).toBe(0)
    expect(model.resetStaffSpacing('staff-1')).toBe(false)
  })

  it('round-trips through JSON and rides the undo snapshot unchanged', () => {
    model.setStaffSpacing('staff-1', -2)
    const restored = ScoreModel.fromJSON(model.toJSON())
    expect(staffSpacingAbove(restored.getScore(), 'staff-1')).toBe(-2)
    const snapshot = JSON.parse(JSON.stringify(model.getScore()))
    expect(snapshot.engravingOverrides['staff-1']).toEqual([{ kind: 'staffSpacing', above: -2 }])
  })
})
