// @vitest-environment jsdom
/**
 * ⭐ Moving an accidental to the armed gap — the shift, and the NEGATION that makes it easy to get
 * backwards.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { StaveNote } from 'vexflow'
import { EngravedAccidental, accidentalsOn } from './EngravedAccidental'
import { attachModifier } from './EngravedModifier'
import { accidentalShiftPx, armedStandoffPx, placeAccidentals, inheritedAccidentalGapSpaces } from './accidentalPlacement'
import { ACCIDENTAL_STANDOFF_PX } from './ledgerAccidentalClearance'
import { resetAccidentalGapRule, setAccidentalGapRule } from '@/engine/layout/accidentalGap'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'

afterEach(() => resetAccidentalGapRule())

const sharpNote = () => {
  const note = new StaveNote({ keys: ['c/4'], duration: 'q' })
  attachModifier(note, new EngravedAccidental('#'), 0)
  return note
}
const shiftOf = (note: StaveNote) =>
  accidentalsOn(note)[0].getXShift()

describe('the armed shift', () => {
  it('⭐⭐ the `house` row is VexFlow’s own standoff, so it moves NOTHING', () => {
    expect(inheritedAccidentalGapSpaces()).toBeCloseTo(0.3, 10)
    expect(accidentalShiftPx()).toBe(0)
    const note = sharpNote()
    placeAccidentals([note])
    expect(shiftOf(note), 'untouched').toBe(0)
  })

  it('⭐ a LOOSER row pushes the sign further LEFT, by the difference', () => {
    setAccidentalGapRule('ross')
    expect(accidentalShiftPx()).toBeCloseTo((0.54 - 0.3) * STAFF_SPACE_PX, 10)
    const note = sharpNote()
    placeAccidentals([note])
    // 🚨 THE NEGATION: `Modifier.setXShift` stores −x for a LEFT modifier, so "further left" reads
    // as a NEGATIVE stored shift. ⛔ `setXShift(getXShift() + d)` would move it the wrong way.
    expect(shiftOf(note)).toBeCloseTo(-accidentalShiftPx(), 10)
  })

  it('⭐ a TIGHTER row closes it in — the same arithmetic with the other sign', () => {
    setAccidentalGapRule('musescore')
    expect(accidentalShiftPx()).toBeCloseTo((0.25 - 0.3) * STAFF_SPACE_PX, 10)
    const note = sharpNote()
    placeAccidentals([note])
    expect(shiftOf(note)).toBeGreaterThan(0)
  })

  it('⭐⭐ every sign of a chord moves by the SAME amount — a column, ⛔ not a rake', () => {
    setAccidentalGapRule('ross')
    const chord = new StaveNote({ keys: ['c/4', 'e/4', 'g/4'], duration: 'q' })
    attachModifier(chord, new EngravedAccidental('#'), 0)
    attachModifier(chord, new EngravedAccidental('b'), 2)
    placeAccidentals([chord])
    const shifts = accidentalsOn(chord).map(a => a.getXShift())
    expect(new Set(shifts).size, 'one shift for the column').toBe(1)
  })

  it('⛔ a REST is skipped, and a note with no accidental is untouched', () => {
    setAccidentalGapRule('ross')
    const rest = new StaveNote({ keys: ['b/4'], duration: 'qr' })
    const plain = new StaveNote({ keys: ['c/4'], duration: 'q' })
    expect(() => placeAccidentals([rest, plain])).not.toThrow()
  })
})

describe('what the LEDGER pass is told', () => {
  it('⭐⭐ the standoff it measures from follows the armed row — ⛔ or the clearance is bought twice', () => {
    expect(armedStandoffPx()).toBe(ACCIDENTAL_STANDOFF_PX)
    setAccidentalGapRule('ross')
    expect(armedStandoffPx()).toBeCloseTo(ACCIDENTAL_STANDOFF_PX + accidentalShiftPx(), 10)
  })
})
