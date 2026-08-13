import { describe, it, expect } from 'vitest'
import { ScoreModel } from '@/engine/models/ScoreModel'
import { fracCreate as frac } from '@/utils/fraction'
import type { NoteParams } from '@/types/music'
import { measureColumns } from './measureColumns'
import type { Column } from './spacing'
import { columnsUnder, type MarkInk } from './inkBand'
import { DYNAMICS_LINE, dynamicsLineAt } from './dynamicsLine'

/**
 * THE DYNAMICS LINE — one baseline per `(system, staff, placement)`
 * (docs/dynamics-line-and-hairpins-plan.md P0).
 *
 * ⚠️ **Most of this file moved to `inkBand.test.ts`** when the trill became the rule's second client
 * (docs/trill-plan.md §4, P2) — *a spec moves with its module*. The arithmetic (`clearanceBaseline`,
 * `staffInkBand`, the column slices) is shared and is tested there, against arbitrary constants.
 *
 * What is left is what is genuinely about the DYNAMICS family: `dynamicsLineAt`, i.e. the local rule
 * — a mark is measured against its OWN column, so one dip does not drag the line — carrying this
 * family's own two numbers. The 2.1 floor showing up in every expectation is the point: it is what
 * makes marks over ordinary music share one line.
 *
 * ⭐ Headless *because* the module is: it reads the ink boxes the spacing model already computed
 * from constants, and takes the MARK's own ink as a parameter rather than measuring a glyph — jsdom
 * would answer 0 and agree with itself (`reference_jsdom_cannot_measure_glyphs`). Whether the drawn
 * marks land on the drawn line is the browser suite's.
 */

/** A mark's ink either side of its baseline, in staff spaces — roughly what a level glyph measures
 *  today (`rendering/dynamicStyle.ts`: 0.68 and 0.18 of a 30 px glyph, over a 10 px space). */
const MARK: MarkInk = { above: 2.04, below: 0.54 }

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

    expect(onBeat0).toBeCloseTo(4 + DYNAMICS_LINE.minFromStaff + MARK.above, 10) // the shared line
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
      .toBeCloseTo(4 + DYNAMICS_LINE.minFromStaff + MARK.above, 10)
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
    expect(above).toBeCloseTo(4 + DYNAMICS_LINE.minFromStaff + MARK.above, 10)
    expect(below).toBeGreaterThan(above)
  })
})
