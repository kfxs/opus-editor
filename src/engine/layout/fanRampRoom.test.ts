import { describe, it, expect } from 'vitest'
import { fanRampRoomSpaces, fanRampSpaces, fanSpanRods } from './fanRampRoom'
import { ScoreModel } from '@/engine/models/ScoreModel'
import { setCue } from '@/engine/models/cueOps'
import { plainColumn, type Column } from './spacing'
import { fracCreate as frac } from '@/utils/fraction'
import type { FanMark } from '@/types/music'

/**
 * How wide a fan's ramp is, and how much of the bar's room it got — pure arithmetic over columns and
 * the x's the solve produced (the drawn picture is `e2e/fan.e2e.ts`'s).
 *
 * ⭐ The model this pins is his: *"the source of truth in the time space is the staff below, not the
 * staff above"*. A fan holds ONE column — its owner's, a real point in the grid — and its members are
 * the INK that column carries. So the room is the gap from that column to the next, and the ramp's
 * share of it.
 */
describe('fanRampSpaces', () => {
  const FAN: FanMark = { direction: 'accel', count: 6, beams: 3 }

  it('is the spacing rule over the members, plus the last head as tail', () => {
    const { ramp, tail } = fanRampSpaces(FAN, frac(2, 1))
    expect(ramp, 'five gaps between six members, each earned by its own duration').toBeGreaterThan(0)
    expect(tail, 'a notehead of ink after the last one').toBeGreaterThan(0)
  })

  it('⭐ a DENSER fan asks for more — which is what keeps a collapsed passage its room', () => {
    const six = fanRampSpaces(FAN, frac(2, 1)).ramp
    const twelve = fanRampSpaces({ ...FAN, count: 12 }, frac(2, 1)).ramp
    expect(twelve).toBeGreaterThan(six)
  })

  it('…and a LONGER slot asks for more than a short one at the same count', () => {
    const overAHalf = fanRampSpaces(FAN, frac(2, 1)).ramp
    const overAQuarter = fanRampSpaces(FAN, frac(1, 1)).ramp
    expect(overAHalf).toBeGreaterThan(overAQuarter)
  })
})

describe('fanRampRoomSpaces', () => {
  const FAN: FanMark = { direction: 'accel', count: 6, beams: 3 }
  const SLOT = frac(2, 1)
  /** A bar's worth of columns at whole beats, and where a solve put them. */
  const columns = (beats: number[]): Column[] => beats.map(b => plainColumn(frac(b, 1), frac(1, 1)))

  it('is the fan column’s own gap, shared with the tail its last head needs', () => {
    const cols = columns([0, 2, 4])
    const room = fanRampRoomSpaces(cols, [0, 30, 60], frac(0, 1), FAN, SLOT)!
    expect(room, 'less than the whole gap — the last head keeps its own room').toBeLessThan(30)
    expect(room).toBeGreaterThan(0)
  })

  it('⭐ grows exactly as the solve grew — that IS the bar’s force', () => {
    const cols = columns([0, 2, 4])
    const natural = fanRampRoomSpaces(cols, [0, 30, 60], frac(0, 1), FAN, SLOT)!
    const stretched = fanRampRoomSpaces(cols, [0, 90, 180], frac(0, 1), FAN, SLOT)!
    expect(stretched / natural).toBeCloseTo(3, 6)
  })

  it('reads the fan’s own column wherever it sits, not by index', () => {
    const cols = columns([0, 1, 2, 3])
    const room = fanRampRoomSpaces(cols, [0, 5, 12, 20], frac(1, 1), FAN, frac(1, 1))!
    expect(room).toBeLessThan(7) // the 1 → 2 gap, less the tail
    expect(room).toBeGreaterThan(0)
  })

  it('⚠️ answers UNDEFINED when the fan’s beat has no column of its own', () => {
    const cols = columns([0, 1, 2])
    expect(fanRampRoomSpaces(cols, [0, 5, 12], frac(7, 2), FAN, SLOT)).toBeUndefined()
  })

  it('answers undefined for a solve that does not match, a last column, or a collapsed gap', () => {
    const cols = columns([0, 1, 2])
    expect(fanRampRoomSpaces(cols, [0, 5], frac(0, 1), FAN, SLOT), 'xs and columns disagree').toBeUndefined()
    expect(fanRampRoomSpaces(cols, [0, 5, 12], frac(2, 1), FAN, SLOT), 'nothing follows it').toBeUndefined()
    expect(fanRampRoomSpaces(cols, [7, 7, 7], frac(0, 1), FAN, SLOT), 'no room at all').toBeUndefined()
  })
})

describe('⭐ a CUE fan asks for its closed-up room (cue-size-plan C8)', () => {
  it('its ramp by the armed spacing row and its last head at the cue size — less than the same fan full', () => {
    const rodsOf = (cue: boolean) => {
      const model = new ScoreModel()
      const n = model.addNote({ step: 'E', alter: 0, octave: 5, duration: 'q', measure: 1, beat: frac(0, 1) })
      model.setFan(n.id, { direction: 'accel', count: 8, beams: 3 })
      if (cue) setCue(model.getScore(), [n.id], true)
      // A grid too narrow for the ramp, so the fan's demand shows as rods.
      return fanSpanRods(model.getMeasure(1)!, [frac(0, 1), frac(4, 1)])
    }
    const full = rodsOf(false)[0]
    expect(full).toBeGreaterThan(0)
    expect(rodsOf(true)[0]).toBeLessThan(full)
  })
})

describe('🚨 two fans in one bar ask for the SAME room (his report, 2026-09-24: the second came out crushed)', () => {
  it('⭐ a gap ENDING on a fan’s beat is not in its span — each half gets the same rod', () => {
    const model = new ScoreModel()
    for (const beat of [0, 2]) {
      const n = model.addNote({ step: 'F', alter: 0, octave: 4, duration: 'h', measure: 1, beat: frac(beat, 1) })
      model.setFan(n.id, { direction: 'rit', count: 6, beams: 3 })
    }
    const rods = fanSpanRods(model.getMeasure(1)!, [frac(0, 1), frac(2, 1), frac(4, 1)])
    expect(rods[0]).toBeGreaterThan(0)
    expect(rods[1]).toBeCloseTo(rods[0], 10)
  })
})
