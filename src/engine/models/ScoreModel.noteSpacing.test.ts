import { describe, it, expect } from 'vitest'
import { ScoreModel } from './ScoreModel'
import {
  spacingPositionKey,
  parseSpacingPositionKey,
  leadingSpaceOverrideOf,
  measureLeadingSpaces,
  measureUserSpacePx,
  restPositionKey,
} from './engravingOverrides'
import { STAFF_SPACE_PX } from './staffSize'
import { fracCreate } from '@/utils/fraction'

/**
 * Client #10 — user-authored horizontal space (docs/note-spacing-plan.md §1).
 *
 * The key is the design: no voice segment and no staff segment, because a space belongs to the
 * COLUMN. Everything below either pins that shape or pins the two rules that hang off it — the
 * write-time clamp, and "absent = the engraver's own spacing".
 */
describe('spacingPositionKey', () => {
  it('carries neither a voice nor a staff — one column, one key', () => {
    const key = spacingPositionKey('m1', fracCreate(3, 2))
    expect(key).toBe('m1:space:b3/2')
    expect(key).not.toMatch(/:v\d/)
    expect(key).not.toMatch(/:s[^p]/)
  })

  it('reduces the beat, so 2/4 and 1/2 are the same column', () => {
    expect(spacingPositionKey('m1', fracCreate(2, 4))).toBe(spacingPositionKey('m1', fracCreate(1, 2)))
  })

  it('starts with `{measureId}:`, which is what sweeps it into the measure shape key', () => {
    expect(spacingPositionKey('m7', fracCreate(1, 1)).startsWith('m7:')).toBe(true)
  })

  it('cannot collide with a rest position key at the same bar and beat', () => {
    const beat = fracCreate(1, 1)
    expect(spacingPositionKey('m1', beat)).not.toBe(restPositionKey('m1', 0, beat))
    expect(spacingPositionKey('m1', beat)).not.toBe(restPositionKey('m1', 0, beat, 'staff-2'))
  })

  it('round-trips through parseSpacingPositionKey', () => {
    const key = spacingPositionKey('measure-abc', fracCreate(5, 4))
    expect(parseSpacingPositionKey(key)).toEqual({ measureId: 'measure-abc', beat: fracCreate(5, 4) })
  })

  it('parse declines anything that is not a spacing key', () => {
    expect(parseSpacingPositionKey(restPositionKey('m1', 0, fracCreate(1, 1)))).toBeUndefined()
    expect(parseSpacingPositionKey('some-uuid')).toBeUndefined()
  })
})

describe('ScoreModel.setNoteSpacing', () => {
  const beat = fracCreate(1, 1)
  const setup = () => {
    const model = new ScoreModel()
    return { model, key: spacingPositionKey(model.getScore().measures[0].id, beat) }
  }

  it('stores the space in staff-spaces', () => {
    const { model, key } = setup()
    model.setNoteSpacing(key, 2, -10)
    expect(leadingSpaceOverrideOf(model.getScore(), key)?.space).toBe(2)
  })

  it('clears at zero, so absent = the engraver’s own spacing', () => {
    const { model, key } = setup()
    model.setNoteSpacing(key, 2, -10)
    model.setNoteSpacing(key, 0, -10)
    expect(leadingSpaceOverrideOf(model.getScore(), key)).toBeUndefined()
  })

  it('clamps a negative space to the caller’s floor — the clamp is on the way IN', () => {
    const { model, key } = setup()
    expect(model.setNoteSpacing(key, -5, -1.5)).toBe(-1.5)
    expect(leadingSpaceOverrideOf(model.getScore(), key)?.space).toBe(-1.5)
  })

  it('a clamp that lands exactly on zero clears the entry rather than storing 0', () => {
    const { model, key } = setup()
    model.setNoteSpacing(key, 3, 0)
    expect(model.setNoteSpacing(key, -4, 0)).toBe(0)
    expect(leadingSpaceOverrideOf(model.getScore(), key)).toBeUndefined()
  })

  it('does not snapshot — the facade owns undo, or a drag pushes one entry per frame', () => {
    const { model, key } = setup()
    const before = JSON.stringify(model.getScore())
    model.setNoteSpacing(key, 1, -10)
    // The only proof available at this layer: the model changed, and nothing else did the saving.
    expect(JSON.stringify(model.getScore())).not.toBe(before)
  })
})

describe('measureLeadingSpaces / measureUserSpacePx', () => {
  const build = () => {
    const model = new ScoreModel()
    const m = model.getScore().measures[0].id
    model.setNoteSpacing(spacingPositionKey(m, fracCreate(2, 1)), 3, -10)
    model.setNoteSpacing(spacingPositionKey(m, fracCreate(1, 1)), 1, -10)
    return { model, m }
  }

  it('enumerates a bar’s spaces in BEAT order, whatever order they were written', () => {
    const { model, m } = build()
    expect(measureLeadingSpaces(model.getScore(), m).map(s => s.beat.num / s.beat.den)).toEqual([1, 2])
  })

  it('sums them to pixels at the layout’s own staff space', () => {
    const { model, m } = build()
    expect(measureUserSpacePx(model.getScore(), m)).toBe(4 * STAFF_SPACE_PX)
  })

  it('sees nothing in a bar nobody touched', () => {
    const model = new ScoreModel()
    model.addMeasure()
    const [first, second] = model.getScore().measures
    model.setNoteSpacing(spacingPositionKey(first.id, fracCreate(1, 1)), 2, -10)
    expect(measureLeadingSpaces(model.getScore(), second.id)).toEqual([])
    expect(measureUserSpacePx(model.getScore(), second.id)).toBe(0)
  })

  it('ignores the OTHER position-keyed clients living in the same bar’s prefix', () => {
    const model = new ScoreModel()
    const m = model.getScore().measures[0].id
    model.nudgeRestShift(restPositionKey(m, 0, fracCreate(1, 1)), 2)
    expect(measureLeadingSpaces(model.getScore(), m)).toEqual([])
  })
})
