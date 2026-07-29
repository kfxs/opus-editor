import { describe, it, expect } from 'vitest'
import { ScoreModel } from '../models/ScoreModel'
import { calculateMeasureWidths } from './MeasureLayout'
import { LAYOUT_CONFIG } from './layoutConfig'
import { resolveStaffClefs, type StaffClefs } from '@/utils/clefUtils'
import { fracCreate as frac } from '@/utils/fraction'
import { DEFAULT_FAN_BEAMS, fanColumns, laneColumns, slotColumns } from '@/utils/fannedBeam'
import type { Score, FanMark } from '@/types/music'

/**
 * 🚨 THE WIDTH — the one silent failure the fan can cause (docs/fanned-beams-plan.md §3, P1).
 *
 * A fanned slot is drawn as `count` noteheads but is ONE slot, and bar width floors at
 * `slots.length × MIN_NOTE_SPACING`. Nothing throws when this is wrong; the heads simply pile up on
 * top of each other. The arithmetic is real under jsdom (only glyph MEASUREMENT is stubbed —
 * reference_jsdom_cannot_measure_glyphs), so the floor is testable even though the picture is not.
 */
function clefs(score: Score): Map<string | undefined, StaffClefs> {
  return new Map((score.staves ?? [{ id: undefined }]).map(s => [s.id, resolveStaffClefs(score, s.id)]))
}

const widthOf = (model: ScoreModel) =>
  calculateMeasureWidths(model.getScore(), clefs(model.getScore()), { mode: 'linear' }).get(1)!

/** One blanca at beat 0 of bar 1 — the note the feature is designed around. */
function blanca(): { model: ScoreModel; id: string } {
  const model = new ScoreModel('fan width')
  const note = model.addNote({ step: 'C', octave: 4, duration: 'h', measure: 1, beat: frac(0, 1) })
  return { model, id: note.id }
}

const FAN: FanMark = { direction: 'accel', count: 6, beams: DEFAULT_FAN_BEAMS }

describe('slotColumns / laneColumns', () => {
  it('an ordinary slot is one column, a fanned one is what its RAMP needs', () => {
    const { model, id } = blanca()
    const before = model.getMeasure(1)!.slots.length
    expect(laneColumns(model.getMeasure(1)!.slots)).toBe(before)

    model.setFan(id, FAN)
    const fanned = model.getMeasure(1)!.slots.find(s => s.type === 'chord')!
    // ⭐ MORE than the member count, and that is the fix for the collapse reported from use: the
    // heads are placed proportionally, so the room the group needs is set by its TIGHTEST gap.
    expect(slotColumns(fanned)).toBe(fanColumns(FAN))
    expect(slotColumns(fanned)).toBeGreaterThan(FAN.count)
    expect(laneColumns(model.getMeasure(1)!.slots)).toBe(before - 1 + fanColumns(FAN))
  })

  it('a rit asks for MORE room than an accel — it opens with its fastest notes', () => {
    // Not a quirk: for an accel the shortest note is LAST and has no gap after it, so the tightest
    // gap is the second-shortest. A rit's shortest note is first, and its gap is inside the group.
    expect(fanColumns({ ...FAN, direction: 'rit' })).toBeGreaterThan(fanColumns(FAN))
  })

  it('more beams mean a steeper ramp, and a steeper ramp needs more room', () => {
    expect(fanColumns({ ...FAN, beams: 4 })).toBeGreaterThan(fanColumns({ ...FAN, beams: 2 }))
    // No ramp at all: N even notes need N-1 gaps of one column, plus the column after the last head.
    expect(fanColumns({ ...FAN, beams: 1 })).toBe(FAN.count)
  })
})

describe('the bar makes room for the members', () => {
  it('a fan widens its bar by its extra columns', () => {
    const { model, id } = blanca()
    const before = widthOf(model).minWidth
    model.setFan(id, FAN)
    const after = widthOf(model).minWidth
    // Five more columns of `MIN_NOTE_SPACING`, unless the bar was already wider than its floor —
    // so the assertion is the direction and the floor, not an exact delta.
    expect(after).toBeGreaterThan(before)
    expect(after).toBeGreaterThanOrEqual(
      laneColumns(model.getMeasure(1)!.slots) * LAYOUT_CONFIG.MIN_NOTE_SPACING,
    )
  })

  it('a bigger count asks for more room', () => {
    const { model, id } = blanca()
    model.setFan(id, { ...FAN, count: 4 })
    const four = widthOf(model).minWidth
    model.setFan(id, { ...FAN, count: 10 })
    expect(widthOf(model).minWidth).toBeGreaterThan(four)
  })

  it('removing the fan gives the room back', () => {
    const { model, id } = blanca()
    const before = widthOf(model).minWidth
    model.setFan(id, FAN)
    model.setFan(id, null)
    expect(widthOf(model).minWidth).toBe(before)
  })

  it('⚠️ the incompressible floor moves WITH the width — never past it', () => {
    // The trap the `widestSpacingFloor` comment names: a floor larger than the width it floors
    // makes the bar incompressible, so both counts have to use `laneColumns` or neither.
    const { model, id } = blanca()
    model.setFan(id, { ...FAN, count: 12 })
    const info = widthOf(model)
    expect(info.floorWidth).toBeLessThanOrEqual(info.minWidth)
  })
})

/**
 * ⭐⭐ **THE CAP IS A PREFERENCE; THE FLOOR IS THE MUSIC** — his report, on a fan of eight
 * thirty-seconds. `MAX_MEASURE_WIDTH` ("one measure must not dominate a line") was applied last, so
 * a bar whose content genuinely needed more was held at the cap and everything past it was drawn
 * through the barline. His question is the rule: *"there is still space in the line… the bar can
 * grow more."*
 */
describe('a bar that cannot compress outgrows MAX_MEASURE_WIDTH', () => {
  it('a dense fan takes the room its columns need, cap or no cap', () => {
    const { model, id } = blanca()
    // 12 members at 4 beams: a ramp whose tightest gap is a quarter of its longest, so its columns
    // come to more than the cap allows a bar to be.
    model.setFan(id, { direction: 'rit', count: 12, beams: 4 })
    const columns = laneColumns(model.getMeasure(1)!.slots)
    expect(columns * LAYOUT_CONFIG.MIN_NOTE_SPACING,
      'fixture: this bar wants more than the cap')
      .toBeGreaterThan(LAYOUT_CONFIG.MAX_MEASURE_WIDTH)

    const info = widthOf(model)
    expect(info.minWidth, 'so the bar grew past it')
      .toBeGreaterThanOrEqual(columns * LAYOUT_CONFIG.MIN_NOTE_SPACING)
  })

  it('…and an ordinary bar is still capped — nothing else changed', () => {
    const model = new ScoreModel('cap')
    model.addNote({ step: 'C', octave: 4, duration: 'w', measure: 1, beat: frac(0, 1) })
    expect(widthOf(model).minWidth).toBeLessThanOrEqual(LAYOUT_CONFIG.MAX_MEASURE_WIDTH)
  })
})
