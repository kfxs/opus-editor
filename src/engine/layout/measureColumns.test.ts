import { describe, it, expect } from 'vitest'
import { ScoreModel } from '@/engine/models/ScoreModel'
import { fracCreate as frac } from '@/utils/fraction'
import { naturalWidth } from './spacing'
import { measureColumns, PROVISIONAL_PAIR_PADDING } from './measureColumns'
import type { Measure, NoteParams } from '@/types/music'

/**
 * A measure's columns — the bridge from the music to the rule (docs/spacing-model-plan.md P2).
 *
 * ⭐ Everything here works headless *because* it is duration-only: the widths below are the rule's
 * answer, not the ink's, and the ink measures 0×0 in node (docs/spacing-model-research.md §5.4). The
 * real drawn gaps are pinned in `e2e/spacing.e2e.ts`.
 */

const bar = (model: ScoreModel, n = 1): Measure => model.getMeasure(n)!
const beats = (measure: Measure) => measureColumns(measure).map(c => c.beat.num / c.beat.den)
const spans = (measure: Measure) => measureColumns(measure).map(c => c.duration.num / c.duration.den)

/** A bar of `n` notes of one duration, filling 4/4. */
function evenBar(count: number, duration: NoteParams['duration']): ScoreModel {
  const model = new ScoreModel()
  for (let i = 0; i < count; i++) {
    model.addNote({ step: 'C', octave: 4, duration, measure: 1, beat: frac(i * 4, count) } as NoteParams)
  }
  return model
}

describe('measureColumns', () => {
  it('is one column per event, plus the BARLINE as the last one', () => {
    const model = evenBar(4, 'q')
    expect(beats(bar(model))).toEqual([0, 1, 2, 3, 4])
    // Each column's span is the distance to the NEXT — the barline's is zero, nothing follows it.
    expect(spans(bar(model))).toEqual([1, 1, 1, 1, 0])
  })

  it('⭐ TWO VOICES at one beat are ONE column — the change every piano score sees', () => {
    const model = evenBar(4, 'q')
    for (const beat of [0, 1, 2, 3]) {
      model.addNote({ step: 'G', octave: 4, duration: 'q', measure: 1, beat: frac(beat, 1), voice: 2 } as NoteParams)
    }
    expect(bar(model).slots.length, 'eight slots in the model').toBe(8)
    expect(beats(bar(model)), 'and four columns on the page').toEqual([0, 1, 2, 3, 4])
  })

  it('⚠️ a column\'s span is to the NEXT COLUMN, not the note\'s own written value', () => {
    // Voice 1 holds a whole note; voice 2 plays four quarters under it. The whole note's COLUMN is
    // followed a quarter later, so it earns a quarter's space — it is still a whole note, and is
    // still drawn as one.
    const model = new ScoreModel()
    model.addNote({ step: 'C', octave: 4, duration: 'w', measure: 1, beat: frac(0, 1) } as NoteParams)
    for (const beat of [0, 1, 2, 3]) {
      model.addNote({ step: 'G', octave: 4, duration: 'q', measure: 1, beat: frac(beat, 1), voice: 2 } as NoteParams)
    }
    expect(spans(bar(model))).toEqual([1, 1, 1, 1, 0])
  })

  it('merges the STAVES: a position is the system\'s, not one staff\'s', () => {
    const model = new ScoreModel()
    model.addStaffBelow(0)
    const [upper, lower] = model.getScore().staves!.map(s => s.id)
    for (const beat of [0, 1, 2, 3]) {
      model.addNote({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: frac(beat, 1), staffId: upper } as NoteParams)
    }
    for (const beat of [0, 2]) {
      model.addNote({ step: 'C', octave: 3, duration: 'h', measure: 1, beat: frac(beat, 1), staffId: lower } as NoteParams)
    }
    // Four columns, not six: the left hand's beat 2 IS the right hand's beat 2.
    expect(beats(bar(model))).toEqual([0, 1, 2, 3, 4])
  })

  it('a bar with nothing in it still has a column — something is drawn there', () => {
    const model = new ScoreModel()
    const empty: Measure = { ...bar(model), slots: [] }
    expect(beats(empty)).toEqual([0, 4])
    expect(spans(empty), 'and the gap before the barline is the whole bar').toEqual([4, 0])
  })

  it('takes a pickup bar\'s own capacity, so its barline is where the bar ends', () => {
    const model = new ScoreModel()
    model.addNote({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) } as NoteParams)
    const pickup: Measure = { ...bar(model), actualDurationOverride: frac(1, 1) }
    expect(beats(pickup)).toEqual([0, 1])
  })

  it('⭐ a FAN\'s members are ordinary columns, at their own exact beats', () => {
    const model = new ScoreModel()
    const note = model.addNote({ step: 'C', octave: 4, duration: 'h', measure: 1, beat: frac(0, 1) } as NoteParams)
    model.setFan(note.id, { direction: 'accel', count: 4, beams: 3 })

    const columns = measureColumns(bar(model))
    // Four members inside the half note's span, then the rest filling beats 2–4, then the barline.
    expect(columns.length).toBeGreaterThanOrEqual(6)
    expect(columns[0].beat).toEqual(frac(0, 1))
    for (const [i, column] of columns.slice(1, 4).entries()) {
      expect(column.beat.num / column.beat.den, 'each member sits after the one before')
        .toBeGreaterThan(columns[i].beat.num / columns[i].beat.den)
      expect(column.beat.num / column.beat.den, 'and inside the slot it belongs to').toBeLessThan(2)
    }
    // An accelerando: each member is shorter than the last, so each gap is tighter.
    const memberSpans = columns.slice(0, 4).map(c => c.duration.num / c.duration.den)
    for (const [i, span] of memberSpans.slice(1).entries()) expect(span).toBeLessThan(memberSpans[i])
  })

  it('never mints a column at or past the barline', () => {
    const model = evenBar(4, 'q')
    const columns = measureColumns(bar(model))
    const barline = columns[columns.length - 1]
    expect(barline.beat).toEqual(frac(4, 1))
    expect(columns.filter(c => c.beat.num / c.beat.den >= 4)).toHaveLength(1)
  })

  it('carries the provisional padding on every column — the ink half\'s stand-in until P3', () => {
    for (const column of measureColumns(bar(evenBar(4, 'q')))) {
      expect(column.padding).toBe(PROVISIONAL_PAIR_PADDING)
      expect(column.extent, 'and no ink at all yet').toEqual({ left: 0, right: 0 })
      expect(column.authored).toBe(0)
    }
  })
})

describe('the width these columns ask for', () => {
  const asks = (model: ScoreModel) => naturalWidth(measureColumns(bar(model)))

  it('⭐⭐ sixteen 16ths ask for TWICE four quarters — not four times, which is what we did', () => {
    // THE headline of the whole model, and the one assertion that works headless because it is
    // duration-only. Before P2 a bar's room was ∝ its EVENT COUNT and this ratio was ~4
    // (docs/spacing-model-research.md §6, where it measured 3.9 on the page).
    const quarters = asks(evenBar(4, 'q'))
    const sixteenths = asks(evenBar(16, '16'))
    expect(quarters, 'four quarters at Gould\'s 3½ spaces each').toBeCloseTo(14, 6)
    // The 16th's own 1.75 is under the provisional floor of 1.8, so sixteen of them come to 28.8
    // rather than 28 — the floor lifting the short end, exactly where §1.1 says it should.
    expect(sixteenths).toBeCloseTo(16 * PROVISIONAL_PAIR_PADDING, 6)
    expect(sixteenths / quarters).toBeCloseTo(2.06, 2)
  })

  it('⭐ and a QUARTER is wider than an EIGHTH — the inversion P0 measured, undone', () => {
    // On the page before P2: an eighth was drawn 3.36 staff spaces and a quarter 1.94, because an
    // unbeamed eighth carries a flag at width time and ink was the only quantity that varied.
    const perGap = (model: ScoreModel, gaps: number) => asks(model) / gaps
    expect(perGap(evenBar(4, 'q'), 4)).toBeCloseTo(3.5, 6)
    expect(perGap(evenBar(8, '8'), 8)).toBeCloseTo(2.475, 3)
    expect(perGap(evenBar(4, 'q'), 4)).toBeGreaterThan(perGap(evenBar(8, '8'), 8))
  })

  it('⭐ is METER-INDEPENDENT: the same four quarters ask the same in 4/4 and in 4/2', () => {
    // VexFlow's softmax spaces by the event's FRACTION OF THE BAR, so a quarter is 1.33× an eighth
    // in 4/4 and 1.78× in 2/4 (research §5.2). Nothing about the meter reaches this answer.
    const common = evenBar(4, 'q')
    const alla = evenBar(4, 'q')
    alla.setTimeSignature(1, { numerator: 4, denominator: 2 })
    // Same notes, different bar length — so the trailing gap to the barline changes and nothing else.
    const gaps = (model: ScoreModel) => measureColumns(bar(model)).slice(0, 3).map(c => c.duration.num / c.duration.den)
    expect(gaps(alla)).toEqual(gaps(common))
  })

  it('a two-voice bar asks for what its COLUMNS need, not what its slots do', () => {
    const single = asks(evenBar(4, 'q'))
    const doubled = evenBar(4, 'q')
    for (const beat of [0, 1, 2, 3]) {
      doubled.addNote({ step: 'G', octave: 4, duration: 'q', measure: 1, beat: frac(beat, 1), voice: 2 } as NoteParams)
    }
    expect(asks(doubled), 'a second voice on the same beats needs no more room').toBeCloseTo(single, 6)
  })
})
