import { describe, it, expect } from 'vitest'
import { ScoreModel } from './ScoreModel'
import { clearRemovedContentOverrides, setEngravingOverride } from './overrideOps'
import { restPositionKey, restShiftOverrideOf, restHiddenOf, noteOffsetOverrideOf, leadingSpaceOverrideOf, spacingPositionKey } from './engravingOverrides'
import { fracCreate as frac } from '@/utils/fraction'
import type { Score, RestShiftOverride, RestHiddenOverride, NoteOffsetOverride, LeadingSpaceOverride } from '@/types/music'

/**
 * Subject: `./overrideOps.clearRemovedContentOverrides` — the auto-reset a CLEAR owes the
 * engraving-overrides compartment.
 *
 * 🚨 **HIS REPORT, 2026-08-30** (the Prelude, staff 2 of bar 1): the bar cleared, and its fresh
 * whole-bar rest drew six steps high. The old rest's hand-lift is filed under a POSITION
 * (`{measureId}:s{staffId}:v0:b0/1`), the clear refilled that same position, and the new rest
 * inherited a nudge authored for a rest that no longer exists.
 *
 * ⭐ A position key outliving its element is the DESIGN (rest ids churn on every edit — see
 * `nudgeRestShift`), so only the operation can say which side of the line an edit falls on. These
 * are the two halves of that judgement: what a clear must drop, and what it must NOT touch.
 */

const bareScore = (): Score => ({ id: 's', title: 't', measures: [] })

describe('clearRemovedContentOverrides', () => {
  it('🚨 drops the rest shift at a position the clear is about to refill — his report', () => {
    const score = bareScore()
    const key = restPositionKey('m1', 0, frac(0, 1), 'staff-2')
    setEngravingOverride(score, key, { kind: 'restShift', steps: 6 } as RestShiftOverride)

    expect(clearRemovedContentOverrides(score, 'm1', 'staff-2', [])).toBe(1)
    expect(restShiftOverrideOf(score, key)).toBeUndefined()
  })

  it('drops every voice and every beat in that bar-staff, not just the one addressed', () => {
    const score = bareScore()
    setEngravingOverride(score, restPositionKey('m1', 0, frac(0, 1), 'staff-2'), { kind: 'restShift', steps: 6 } as RestShiftOverride)
    setEngravingOverride(score, restPositionKey('m1', 1, frac(1, 2), 'staff-2'), { kind: 'restShift', steps: -2 } as RestShiftOverride)
    setEngravingOverride(score, restPositionKey('m1', 0, frac(1, 1), 'staff-2'), { kind: 'restHidden' } as RestHiddenOverride)

    expect(clearRemovedContentOverrides(score, 'm1', 'staff-2', [])).toBe(3)
    expect(restHiddenOf(score, restPositionKey('m1', 0, frac(1, 1), 'staff-2'))).toBe(false)
  })

  it('⚠️ the FIRST staff is the keys with no `:s` segment — and it cannot reach the others', () => {
    const score = bareScore()
    const first = restPositionKey('m1', 0, frac(0, 1), undefined)
    const second = restPositionKey('m1', 0, frac(0, 1), 'staff-2')
    setEngravingOverride(score, first, { kind: 'restShift', steps: 3 } as RestShiftOverride)
    setEngravingOverride(score, second, { kind: 'restShift', steps: 6 } as RestShiftOverride)

    expect(clearRemovedContentOverrides(score, 'm1', undefined, [])).toBe(1)
    expect(restShiftOverrideOf(score, first)).toBeUndefined()
    // The other staff's rest is still lifted: a clear of staff 0 is not a clear of the system.
    expect(restShiftOverrideOf(score, second)?.steps).toBe(6)
  })

  it('leaves ANOTHER measure alone — the key carries the measure id for exactly this reason', () => {
    const score = bareScore()
    const other = restPositionKey('m2', 0, frac(0, 1), 'staff-2')
    setEngravingOverride(score, other, { kind: 'restShift', steps: 6 } as RestShiftOverride)

    expect(clearRemovedContentOverrides(score, 'm1', 'staff-2', [])).toBe(0)
    expect(restShiftOverrideOf(score, other)?.steps).toBe(6)
  })

  it('drops the note offsets of the deleted slots — their ids can never be reached again', () => {
    const score = bareScore()
    setEngravingOverride(score, 'slot-a', { kind: 'noteOffset', x: 1.5 } as NoteOffsetOverride)
    setEngravingOverride(score, 'slot-b', { kind: 'noteOffset', x: -1 } as NoteOffsetOverride)

    expect(clearRemovedContentOverrides(score, 'm1', 'staff-2', ['slot-a'])).toBe(1)
    expect(noteOffsetOverrideOf(score, 'slot-a')).toBeUndefined()
    // A slot that survived the clear keeps its nudge.
    expect(noteOffsetOverrideOf(score, 'slot-b')?.x).toBe(-1)
  })

  it('⛔ does NOT touch the column keys — a leading space is shared by both staves', () => {
    const score = bareScore()
    const column = spacingPositionKey('m1', frac(1, 2))
    setEngravingOverride(score, column, { kind: 'leadingSpace', space: 2 } as LeadingSpaceOverride)

    expect(clearRemovedContentOverrides(score, 'm1', undefined, [])).toBe(0)
    expect(leadingSpaceOverrideOf(score, column)?.space).toBe(2)
  })

  it('prunes the compartment when it empties, so "absent = none" holds', () => {
    const score = bareScore()
    setEngravingOverride(score, restPositionKey('m1', 0, frac(0, 1), 'staff-2'), { kind: 'restShift', steps: 6 } as RestShiftOverride)
    clearRemovedContentOverrides(score, 'm1', 'staff-2', [])
    expect(score.engravingOverrides).toBeUndefined()
  })
})

describe('clearMeasureStaff takes the hand-positioning with the content', () => {
  it('🚨 the refilled rest starts at its DEFAULT position, not the old one\'s', () => {
    const model = new ScoreModel()
    model.addMeasure()
    const staffId = model.addStaffBelow(0)
    model.addNote({ step: 'C', octave: 3, duration: 'q', measure: 1, beat: frac(0, 1), staff: 1 })
    const measureId = model.getMeasure(1)!.id
    const key = restPositionKey(measureId, 0, frac(0, 1), staffId)
    setEngravingOverride(model.getScore(), key, { kind: 'restShift', steps: 6 } as RestShiftOverride)

    expect(model.clearMeasureStaff(1, 1)).toBe(true)
    expect(restShiftOverrideOf(model.getScore(), key)).toBeUndefined()
  })

  it('leaves the OTHER staff\'s hand-positioning standing', () => {
    const model = new ScoreModel()
    model.addMeasure()
    model.addStaffBelow(0)
    model.addNote({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    const measureId = model.getMeasure(1)!.id
    const firstStaffKey = restPositionKey(measureId, 0, frac(0, 1), undefined)
    setEngravingOverride(model.getScore(), firstStaffKey, { kind: 'restShift', steps: 4 } as RestShiftOverride)

    model.clearMeasureStaff(1, 1)
    expect(restShiftOverrideOf(model.getScore(), firstStaffKey)?.steps).toBe(4)
  })
})
