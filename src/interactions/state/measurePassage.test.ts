/**
 * A PASSAGE — a run of bars × a run of staves — and what is inside it.
 *
 * Subject: {@link passageOf}, {@link passageNoteIds}, {@link spansStaves}. ⭐ The claim that matters
 * is the **staff axis**: before 2026-08-29 a measure selection carried one `staff` and a two-staff
 * passage was not representable, which is what made his shift-click fall through to the note-range
 * path. These pin that the second axis exists and behaves like the first.
 */
import { describe, it, expect } from 'vitest'
import { passageOf, passageNoteIds, spansStaves } from './measurePassage'
import type { Score } from '@/types/music'

/** Two bars × two staves, one note per (bar, staff), ids like `m1s0`. */
function score(): Score {
  const slot = (measure: number, staff: number) => ({
    id: `m${measure}s${staff}`, type: 'chord', beat: { num: 0, den: 1 }, duration: 'w',
    ...(staff ? { staffId: `st${staff}` } : {}),
    notes: [{ id: `m${measure}s${staff}`, step: 'C', octave: 4 }],
  })
  return {
    id: 's', title: '',
    staves: [{ id: 'st0' }, { id: 'st1' }],
    measures: [1, 2].map(n => ({
      id: `m${n}`, number: n, timeSignature: { numerator: 4, denominator: 4 }, tuplets: [],
      slots: [slot(n, 0), slot(n, 1)],
    })),
  } as unknown as Score
}

describe('normalising the two axes', () => {
  it('orders bars low→high however the selection was made', () => {
    expect(passageOf({ anchor: 7, focus: 3, staff: 0, focusStaff: 0 }))
      .toMatchObject({ fromMeasure: 3, toMeasure: 7 })
  })

  it('⭐⭐ orders STAVES too — a passage dragged UPWARD is the same passage', () => {
    expect(passageOf({ anchor: 1, focus: 1, staff: 3, focusStaff: 1 }))
      .toMatchObject({ fromStaff: 1, toStaff: 3 })
  })

  it('a one-bar one-staff click is a passage of itself', () => {
    expect(passageOf({ anchor: 4, focus: 4, staff: 2, focusStaff: 2 }))
      .toEqual({ fromMeasure: 4, toMeasure: 4, fromStaff: 2, toStaff: 2 })
  })

  it('`spansStaves` is what tells a grand-staff selection from a one-staff one', () => {
    expect(spansStaves(passageOf({ anchor: 1, focus: 1, staff: 0, focusStaff: 0 }))).toBe(false)
    expect(spansStaves(passageOf({ anchor: 1, focus: 1, staff: 0, focusStaff: 1 }))).toBe(true)
  })
})

describe('what is inside — 🚨 the report this module exists for', () => {
  const s = score()

  it('one bar on one staff takes only that staff’s content', () => {
    expect(passageNoteIds(s, passageOf({ anchor: 1, focus: 1, staff: 0, focusStaff: 0 })))
      .toEqual(['m1s0'])
  })

  it('⭐⭐ the SAME bar across BOTH staves takes both — *"the measure but in both staves"*', () => {
    expect(passageNoteIds(s, passageOf({ anchor: 1, focus: 1, staff: 0, focusStaff: 1 })))
      .toEqual(['m1s0', 'm1s1'])
  })

  it('⭐ and it grows on BOTH axes at once — two bars × two staves', () => {
    expect(passageNoteIds(s, passageOf({ anchor: 1, focus: 2, staff: 0, focusStaff: 1 })))
      .toEqual(['m1s0', 'm1s1', 'm2s0', 'm2s1'])
  })

  it('⛔ takes nothing from a bar outside the range', () => {
    const ids = passageNoteIds(s, passageOf({ anchor: 2, focus: 2, staff: 0, focusStaff: 1 }))
    expect(ids).toEqual(['m2s0', 'm2s1'])
  })

  it('⛔ nor from a staff outside it — the lower staff alone', () => {
    expect(passageNoteIds(s, passageOf({ anchor: 1, focus: 2, staff: 1, focusStaff: 1 })))
      .toEqual(['m1s1', 'm2s1'])
  })

  it('⚠️ an empty passage is empty, ⛔ not everything', () => {
    expect(passageNoteIds(s, passageOf({ anchor: 9, focus: 9, staff: 0, focusStaff: 1 }))).toEqual([])
  })
})
