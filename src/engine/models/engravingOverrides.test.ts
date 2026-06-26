import { describe, it, expect, beforeEach } from 'vitest'
import { ScoreModel } from './ScoreModel'
import type { EngravingOverride } from '@/types/music'

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
    model = new ScoreModel('Test Score', 120)
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
