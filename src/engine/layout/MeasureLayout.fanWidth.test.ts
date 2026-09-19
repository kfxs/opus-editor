import { describe, it, expect } from 'vitest'
import { ScoreModel } from '../models/ScoreModel'
import { calculateMeasureWidths } from './MeasureLayout'
import { LAYOUT_CONFIG } from './layoutConfig'
import { resolveStaffClefs, type StaffClefs } from '@/utils/clefUtils'
import { fracCreate as frac } from '@/utils/fraction'
import { DEFAULT_FAN_BEAMS } from '@/utils/fannedBeam'
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

/**
 * ⚠️ `slotColumns` / `laneColumns` / `fanColumns` were DELETED with the spacing model's P5, and the
 * describe that lived here went with them. They counted a fan's claim in units of "one ordinary
 * event's column" — `ceil(span / tightest gap) + 1` — a proxy for the room a proportional ramp
 * would want out of a tick-proportional formatter. `measureColumns` gives every member a real
 * column at its own exact beat now, so the bar asks for the sum of what those durations earn and
 * there is nothing left to approximate. What survives is everything below: the bar really does make
 * room for the members, and it is measured on the bar rather than on the proxy.
 */

describe('the bar makes room for the members', () => {
  it('a fan widens its bar by its extra columns', () => {
    const { model, id } = blanca()
    const before = widthOf(model).minWidth
    model.setFan(id, FAN)
    const after = widthOf(model).minWidth
    // ⭐ The direction is the claim, and it is the one that matters: a bar holding a fan is wider
    //   than the same bar holding the single note the fan was made from, because the members are
    //   real columns in it. The old second assertion measured against `laneColumns ×
    //   MIN_NOTE_SPACING` — the proxy P5 deleted — so it is gone with it; the members' own room is
    //   asserted note-by-note in `FannedBeam.test.ts` and on the page in `e2e/fan.e2e.ts`.
    expect(after).toBeGreaterThan(before)
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
  it('a dense fan asks for what its MEMBERS need — which is far less than `fanColumns` claimed', () => {
    // ⚠️ This asserted `minWidth ≥ laneColumns × MIN_NOTE_SPACING` — 864 px for this fixture — and
    //    that was the right test of the mechanism it was written for: `fanColumns` bought a fan's
    //    drawn span as `ceil(span / tightest gap) + 1` ORDINARY COLUMNS, several times what its
    //    heads take, and the cap then clamped the bar and the heads drew through the barline. The
    //    spacing model (P5) deleted the proxy: the members are ordinary columns, so the bar asks for
    //    the sum of what their durations earn — about 337 px here, and the cap never comes near it.
    //
    // ⭐ The requirement was never "the bar is huge". It was "the ink is inside the bar", and that is
    //   what `e2e/fan.e2e.ts` checks on the drawing, where it can actually be seen.
    const { model, id } = blanca()
    model.setFan(id, { direction: 'rit', count: 12, beams: 4 })

    const info = widthOf(model)
    expect(info.minWidth, 'a real bar, sized by its own content').toBeGreaterThan(200)
    expect(info.minWidth, '…and no longer forced past the cap by a proxy')
      .toBeLessThan(LAYOUT_CONFIG.MAX_MEASURE_WIDTH)
  })

  it('…and an ordinary bar is still capped — nothing else changed', () => {
    const model = new ScoreModel('cap')
    model.addNote({ step: 'C', octave: 4, duration: 'w', measure: 1, beat: frac(0, 1) })
    expect(widthOf(model).minWidth).toBeLessThanOrEqual(LAYOUT_CONFIG.MAX_MEASURE_WIDTH)
  })
})
