import { describe, it, expect } from 'vitest'
import { ScoreModel } from '@/engine/models/ScoreModel'
import { fracCreate as frac } from '@/utils/fraction'
import type { Measure, NoteParams } from '@/types/music'
import { measureColumns } from './measureColumns'
import { plainColumn, type Column } from './spacing'
import type { InkBox } from './kerning'
import {
  DYNAMICS_LINE,
  columnsBetween,
  columnsUnder,
  dynamicsLineAt,
  mergeInkBands,
  dynamicsLineBaseline,
  staffInkBand,
  type DynamicMarkInk,
} from './dynamicsLine'

/**
 * THE DYNAMICS LINE — one baseline per `(system, staff, placement)`
 * (docs/dynamics-line-and-hairpins-plan.md P0).
 *
 * ⭐ Everything here is headless *because* the module is: it reads the ink boxes the spacing model
 * already computed from constants, and it takes the MARK's own ink as a parameter rather than
 * measuring a glyph — jsdom would answer 0 and agree with itself
 * (`reference_jsdom_cannot_measure_glyphs`). Whether the drawn marks land on the drawn line is
 * P1's, in the browser suite.
 */

/** A mark's ink either side of its baseline, in staff spaces — roughly what a level glyph measures
 *  today (`rendering/dynamicStyle.ts`: 0.68 and 0.18 of a 30 px glyph, over a 10 px space). */
const MARK: DynamicMarkInk = { above: 2.04, below: 0.54 }

const box = (top: number, bottom: number, staff?: string, size = 1): InkBox =>
  ({ left: 0, right: 0, top, bottom, kind: 'note', staff, size })

const column = (...ink: InkBox[]): Column => ({ ...plainColumn(frac(0, 1), frac(1, 1)), ink })

/** A one-staff bar of whole notes at `steps`, and the columns it produces. */
function barOf(pitches: Array<{ step: string; octave: number }>): Column[] {
  const model = new ScoreModel()
  pitches.forEach((pitch, i) => {
    if (i > 0) model.addMeasure()
    model.addNote({ ...pitch, duration: 'w', measure: i + 1, beat: frac(0, 1) } as NoteParams)
  })
  const measures: Measure[] = pitches.map((_, i) => model.getMeasure(i + 1)!)
  return measures.flatMap(measure => measureColumns(measure))
}

describe('the rule — clear the ink, floored at the staff', () => {
  it('a BELOW line clears the lowest ink by the padding, and the baseline hangs the mark from it', () => {
    // Ink to 7 spaces — well past the staff, so the floor is not what decides.
    const band = { top: 2, bottom: 7 }
    expect(dynamicsLineBaseline(band, 'below', MARK)).toBeCloseTo(7 + DYNAMICS_LINE.PADDING + MARK.above, 10)
  })

  it('⭐ but never closer to the staff than the minimum — a bar of middle-line notes does not pull its dynamics up', () => {
    // This is the §2.2 defect being fixed: VexFlow hangs the mark off the NOTE, so a high passage
    // puts its `p` inside the staff. The floor is measured from the bottom LINE, not from the music.
    const high = { top: -1, bottom: 1 }
    const floor = 4 + DYNAMICS_LINE.MIN_FROM_STAFF + MARK.above
    expect(dynamicsLineBaseline(high, 'below', MARK)).toBeCloseTo(floor, 10)
    // …and ink that stops just inside the staff cannot beat it either.
    expect(dynamicsLineBaseline({ top: 0, bottom: 4 }, 'below', MARK)).toBeCloseTo(floor, 10)
  })

  it('a staff with NO ink at all still has a line — the floor is the whole answer', () => {
    expect(dynamicsLineBaseline(null, 'below', MARK)).toBeCloseTo(4 + DYNAMICS_LINE.MIN_FROM_STAFF + MARK.above, 10)
  })

  it('ABOVE is the mirror, and it hangs the mark by its OTHER edge', () => {
    // The baseline is above the staff (negative), and it is the mark's ink BOTTOM that must clear.
    expect(dynamicsLineBaseline({ top: -3, bottom: 2 }, 'above', MARK))
      .toBeCloseTo(-3 - DYNAMICS_LINE.PADDING - MARK.below, 10)
    expect(dynamicsLineBaseline({ top: 1, bottom: 3 }, 'above', MARK))
      .toBeCloseTo(-DYNAMICS_LINE.MIN_FROM_STAFF - MARK.below, 10)
  })
})

describe('reading the ink', () => {
  it('⭐⭐ a mark clears the ink UNDER IT, and a low note ELSEWHERE leaves it alone', () => {
    // The rule he chose: one line, and only a mark standing over a dip deviates. Same two bars,
    // measured at two scopes — the mark's own column, and the pair.
    const [high, low] = [barOf([{ step: 'B', octave: 4 }]), barOf([{ step: 'C', octave: 3 }])]
    const underTheMark = staffInkBand(high, undefined, undefined)!
    const bothBars = staffInkBand([...high, ...low], undefined, undefined)!

    expect(bothBars.bottom).toBeGreaterThan(underTheMark.bottom)
    // ⭐ …and the mark does not move, because the wider scope is not what it is measured against.
    expect(dynamicsLineBaseline(underTheMark, 'below', MARK))
      .toBeLessThan(dynamicsLineBaseline(bothBars, 'below', MARK))
  })

  it('a bar of high notes sits at the floor — outside the staff, where every mark shares it', () => {
    // A whole note on the middle line reaches 2.6, and the bar's own barline bounds the band at the
    // bottom line; either way nothing hangs below the staff, so the floor is what answers.
    const band = staffInkBand(barOf([{ step: 'B', octave: 4 }]), undefined, undefined)!
    expect(band.bottom).toBe(4)
    expect(dynamicsLineBaseline(band, 'below', MARK))
      .toBeCloseTo(4 + DYNAMICS_LINE.MIN_FROM_STAFF + MARK.above, 10)
  })

  it('⛔ a system-wide box — the barline, an empty bar\'s measure rest — can never move a line', () => {
    // Both span exactly the staff (0…4), which the floor already covers. Pinned because they are the
    // boxes that carry no staff id, so they land on the first staff's band by normalisation.
    const empty = new ScoreModel()
    const band = staffInkBand(measureColumns(empty.getMeasure(1)!), undefined, undefined)!
    expect(band).toEqual({ top: 0, bottom: 4 })
    expect(dynamicsLineBaseline(band, 'below', MARK))
      .toBeCloseTo(4 + DYNAMICS_LINE.MIN_FROM_STAFF + MARK.above, 10)
  })

  it('⭐ the staff\'s SIZE does not enter: a band is in its own staff\'s spaces, already', () => {
    // An `InkBox`'s left/right arrive scaled and its top/bottom deliberately do not (`kerning.ts`),
    // and the mark is drawn inside the staff's own scale group — so a 0.7 staff's line is the same
    // number as a full one's, and multiplying by the ratio here would land it twice-scaled.
    const full = staffInkBand([column(box(2, 7, undefined, 1))], undefined, undefined)
    const small = staffInkBand([column(box(2, 7, undefined, 0.7))], undefined, undefined)
    expect(small).toEqual(full)
  })
})

describe('which ink is MINE — the staff', () => {
  /** A grand staff whose lower staff holds a note far below it. */
  function grandStaff(): { columns: Column[]; upper: string; lower: string } {
    const model = new ScoreModel()
    model.addNote({ step: 'B', octave: 4, duration: 'w', measure: 1, beat: frac(0, 1) } as NoteParams)
    model.addStaffBelow(0)
    model.addNote({ step: 'C', octave: 3, duration: 'w', measure: 1, beat: frac(0, 1), staff: 1 } as NoteParams)
    const [upper, lower] = model.getScore().staves!.map(staff => staff.id)
    return { columns: measureColumns(model.getMeasure(1)!), upper, lower }
  }

  it('⚠️⚠️ the FIRST staff\'s boxes carry NO staff id, and asking by its real id must still find them', () => {
    // The silent one. `slotInk` copies `slot.staffId`, which is absent for the first staff even when
    // the score has staves — so a strict comparison hands the upper staff an empty band and puts its
    // dynamics at the floor while the music hangs three spaces lower.
    const { columns, upper, lower } = grandStaff()
    const byId = staffInkBand(columns, upper, upper)
    const byAbsence = staffInkBand(columns, undefined, upper)
    expect(byId).toEqual(byAbsence)
    expect(byId!.bottom).toBeLessThan(staffInkBand(columns, lower, upper)!.bottom)
  })

  it('⚠️ a low note on the LOWER staff does not move the UPPER staff\'s line', () => {
    const { columns, upper, lower } = grandStaff()
    const alone = staffInkBand(measureColumns(new ScoreModel().getMeasure(1)!), undefined, undefined)
    expect(staffInkBand(columns, upper, upper)!.bottom).toBeLessThanOrEqual(alone!.bottom)
    // The lower staff's own line, meanwhile, does clear its ledgered C3.
    expect(dynamicsLineBaseline(staffInkBand(columns, lower, upper), 'below', MARK))
      .toBeGreaterThan(dynamicsLineBaseline(staffInkBand(columns, upper, upper), 'below', MARK))
  })

  it('a staff that drew nothing on this system reports no band', () => {
    const { columns, upper } = grandStaff()
    expect(staffInkBand(columns, 'a-staff-with-no-music', upper)).toBeNull()
  })
})

describe('columnsUnder — which ink a mark is measured against', () => {
  /** One bar: a high note on beat 0, a low one on beat 2. */
  function twoNoteBar(): Column[] {
    const model = new ScoreModel()
    model.addNote({ step: 'B', octave: 4, duration: 'h', measure: 1, beat: frac(0, 1) } as NoteParams)
    model.addNote({ step: 'C', octave: 3, duration: 'h', measure: 1, beat: frac(2, 1) } as NoteParams)
    return measureColumns(model.getMeasure(1)!)
  }

  it('⭐⭐ the mark\'s OWN column — a dip later in the same bar does not drag it down', () => {
    const columns = twoNoteBar()
    const onBeat0 = dynamicsLineAt(columns, frac(0, 1), undefined, undefined, 'below', MARK)
    const onBeat2 = dynamicsLineAt(columns, frac(2, 1), undefined, undefined, 'below', MARK)

    expect(onBeat0).toBeCloseTo(4 + DYNAMICS_LINE.MIN_FROM_STAFF + MARK.above, 10) // the shared line
    expect(onBeat2).toBeGreaterThan(onBeat0) // the one over the dip, and only that one
  })

  it('falls FORWARD to the next column, as the mark itself does to find its note', () => {
    const columns = twoNoteBar()
    // Nothing starts at beat 1; the mark hangs off the next event, so it clears that event's ink.
    expect(dynamicsLineAt(columns, frac(1, 1), undefined, undefined, 'below', MARK))
      .toBeCloseTo(dynamicsLineAt(columns, frac(2, 1), undefined, undefined, 'below', MARK), 10)
  })

  it('past the last column there is nothing to clear, and the floor answers', () => {
    expect(columnsUnder(twoNoteBar(), frac(99, 1))).toEqual([])
    expect(dynamicsLineAt(twoNoteBar(), frac(99, 1), undefined, undefined, 'below', MARK))
      .toBeCloseTo(4 + DYNAMICS_LINE.MIN_FROM_STAFF + MARK.above, 10)
  })

  it('⚠️ and it is still per STAFF: the lower staff\'s ink at the same beat is not the upper\'s', () => {
    const model = new ScoreModel()
    model.addNote({ step: 'B', octave: 4, duration: 'w', measure: 1, beat: frac(0, 1) } as NoteParams)
    model.addStaffBelow(0)
    model.addNote({ step: 'C', octave: 3, duration: 'w', measure: 1, beat: frac(0, 1), staff: 1 } as NoteParams)
    const [upper, lower] = model.getScore().staves!.map(staff => staff.id)
    const columns = measureColumns(model.getMeasure(1)!)

    const above = dynamicsLineAt(columns, frac(0, 1), upper, upper, 'below', MARK)
    const below = dynamicsLineAt(columns, frac(0, 1), lower, upper, 'below', MARK)
    expect(above).toBeCloseTo(4 + DYNAMICS_LINE.MIN_FROM_STAFF + MARK.above, 10)
    expect(below).toBeGreaterThan(above)
  })
})

describe('columnsBetween + mergeInkBands — the SPANNER\'s wider slice', () => {
  /** Four columns, one per quarter of a 4/4 bar. */
  const bar = (): Column[] => [0, 1, 2, 3].map(b => ({ ...plainColumn(frac(b, 1), frac(1, 1)), ink: [] }))

  it('takes [from, to) — a wedge reaches to its end without standing over what begins there', () => {
    const taken = columnsBetween(bar(), frac(1, 1), frac(3, 1))
    expect(taken.map(c => c.beat.num)).toEqual([1, 2])
  })

  it('takes the whole bar when handed the bar\'s capacity as the end', () => {
    expect(columnsBetween(bar(), frac(0, 1), frac(4, 1))).toHaveLength(4)
  })

  it('is empty when the slice contains no column', () => {
    expect(columnsBetween(bar(), frac(1, 2), frac(3, 4))).toHaveLength(0)
  })

  it('⭐ a wedge is measured against every column it covers, not just its first', () => {
    // A dip in the MIDDLE of the span has to move the whole wedge: it is a straight line, so a
    // band that ignored the middle would draw it through the notes it spans.
    const columns: Column[] = [
      { ...plainColumn(frac(0, 1), frac(1, 1)), ink: [box(2, 4)] },
      { ...plainColumn(frac(1, 1), frac(1, 1)), ink: [box(2, 11)] }, // the dip
      { ...plainColumn(frac(2, 1), frac(1, 1)), ink: [box(2, 4)] },
    ]
    const spanned = columnsBetween(columns, frac(0, 1), frac(3, 1))
    const band = staffInkBand(spanned, undefined, undefined)
    expect(band).toEqual({ top: 2, bottom: 11 })
    // …and the line clears it, rather than sitting at the floor as it would over the first column.
    const line = dynamicsLineBaseline(band, 'below', MARK)
    expect(line).toBeCloseTo(11 + DYNAMICS_LINE.PADDING + MARK.above, 5)
  })

  it('mergeInkBands widens, and survives either side being null', () => {
    expect(mergeInkBands(null, null)).toBeNull()
    expect(mergeInkBands({ top: 1, bottom: 5 }, null)).toEqual({ top: 1, bottom: 5 })
    expect(mergeInkBands(null, { top: 1, bottom: 5 })).toEqual({ top: 1, bottom: 5 })
    expect(mergeInkBands({ top: 2, bottom: 5 }, { top: -1, bottom: 4 })).toEqual({ top: -1, bottom: 5 })
  })
})
