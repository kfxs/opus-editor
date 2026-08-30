import { describe, it, expect } from 'vitest'
import { ScoreModel } from './ScoreModel'
import { clearRemovedContentOverrides, clearRestHiddenAt, setEngravingOverride } from './overrideOps'
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
 *
 * Its sibling `clearRestHiddenAt` draws the same line one position at a time, and is tested
 * here for the same reason — 🚨 **HIS SECOND REPORT, 2026-08-30**: hide a rest, then overwrite it
 * with a note, and the exported score still carried `{kind:'restHidden'}` under the beat the note
 * now occupies (24 such entries had piled up in the Prelude example). The position still holds a
 * SLOT, so the clear above never sees it.
 *
 * ⛔ It drops the HIDDEN flag and nothing else. The `restShift` at that same address stays — see
 * `docs/rest-shift-plan.md` §4 and `ScoreModel.test.ts`'s "resurrects on a plain rest→note→rest",
 * a decision this fix is not allowed to retire behind its back. `docs/rest-hide-plan.md` §"A hide
 * does not resurrect" is where the asymmetry is argued.
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

describe('a note taking a rest\'s position takes the rest\'s HIDDEN flag with it', () => {
  /** Bar 1, one voice, a quarter rest at beat 0 — hidden by hand, and lifted by hand. */
  const hiddenRestAtBeat0 = () => {
    const model = new ScoreModel()
    model.addMeasure()
    const rest = model.addNote({ isRest: true, duration: 'q', measure: 1, beat: frac(0, 1) })
    const measureId = model.getMeasure(1)!.id
    const key = restPositionKey(measureId, 0, frac(0, 1), undefined)
    setEngravingOverride(model.getScore(), key, { kind: 'restHidden' } as RestHiddenOverride)
    setEngravingOverride(model.getScore(), key, { kind: 'restShift', steps: 3 } as RestShiftOverride)
    return { model, restId: rest.id, key }
  }

  it('drops the hidden flag and prunes the compartment', () => {
    const score = bareScore()
    const key = restPositionKey('m1', 0, frac(0, 1), undefined)
    setEngravingOverride(score, key, { kind: 'restHidden' } as RestHiddenOverride)

    expect(clearRestHiddenAt(score, key)).toBe(true)
    expect(score.engravingOverrides).toBeUndefined()
    // Nothing filed there: nothing to drop, and no compartment minted to say so.
    expect(clearRestHiddenAt(score, key)).toBe(false)
  })

  it('⛔ leaves the SHIFT at the same address standing — rest-shift-plan.md §4 accepts it', () => {
    const score = bareScore()
    const key = restPositionKey('m1', 0, frac(0, 1), undefined)
    setEngravingOverride(score, key, { kind: 'restHidden' } as RestHiddenOverride)
    setEngravingOverride(score, key, { kind: 'restShift', steps: 3 } as RestShiftOverride)

    clearRestHiddenAt(score, key)
    expect(restShiftOverrideOf(score, key)?.steps).toBe(3)
  })

  it('🚨 the edit-in-place rest→note conversion drops it — his report', () => {
    const { model, restId, key } = hiddenRestAtBeat0()

    model.updateNote(restId, { step: 'A', alter: 0, octave: 3, isRest: false })

    expect(restHiddenOf(model.getScore(), key)).toBe(false)
    // ...and the shift stays, unread, exactly as §4 says (`ScoreModel.test.ts`\'s resurrection case).
    expect(restShiftOverrideOf(model.getScore(), key)?.steps).toBe(3)
  })

  it('a note ENTERED over the hidden rest drops it too — the same edit by the other door', () => {
    const { model, key } = hiddenRestAtBeat0()

    model.addNote({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })

    expect(restHiddenOf(model.getScore(), key)).toBe(false)
    expect(restShiftOverrideOf(model.getScore(), key)?.steps).toBe(3)
  })

  it('⛔ but a rest replaced by another REST keeps it — that churn is what a position key is FOR', () => {
    const { model, key } = hiddenRestAtBeat0()

    model.addNote({ isRest: true, duration: 'h', measure: 1, beat: frac(0, 1) })

    expect(restHiddenOf(model.getScore(), key)).toBe(true)
  })

  it('reaches only the beats the note actually covers', () => {
    const { model } = hiddenRestAtBeat0()
    const measureId = model.getMeasure(1)!.id
    const later = restPositionKey(measureId, 0, frac(2, 1), undefined)
    model.addNote({ isRest: true, duration: 'q', measure: 1, beat: frac(2, 1) })
    setEngravingOverride(model.getScore(), later, { kind: 'restHidden' } as RestHiddenOverride)

    model.addNote({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })

    expect(restHiddenOf(model.getScore(), later)).toBe(true)
  })
})
