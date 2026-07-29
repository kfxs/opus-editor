import { describe, it, expect } from 'vitest'
import { StaveNote } from 'vexflow'
import { FanStaveNote, fanRoomPx, fanMaxSpanPx, shareFanRoom, FAN_MAX_SPAN_STRETCH } from './fanRoom'
import { fanColumns, DEFAULT_FAN_COUNT, DEFAULT_FAN_BEAMS } from '@/utils/fannedBeam'
import { LAYOUT_CONFIG } from './layoutConfig'
import type { ChordRest, FanMark } from '@/types/music'

/**
 * Subject: `./fanRoom` — how much horizontal room a fanned slot asks for, and the note that asks.
 *
 * ⚠️ The PICTURE is not testable here: jsdom measures every glyph as 0×0, so where the heads landed
 * is a browser question (`e2e/fan.e2e.ts`). What is real in this environment is the arithmetic — how
 * many columns a ramp claims — and the one behaviour the whole fix turns on: **that the width
 * survives `preFormat`**, which is what the first attempt got wrong (`TickContext.addTickable`
 * clears the note's `preFormatted` latch, so a width set from outside was recomputed away).
 */
const FAN: FanMark = { direction: 'accel', count: DEFAULT_FAN_COUNT, beams: DEFAULT_FAN_BEAMS }

describe('fanRoomPx', () => {
  it('is one ordinary note column per column the ramp asks for', () => {
    expect(fanRoomPx(FAN)).toBe(fanColumns(FAN) * LAYOUT_CONFIG.MIN_NOTE_SPACING)
  })

  it('grows with the group — more attacks over the same time need more room, not less', () => {
    const six = fanRoomPx({ ...FAN, count: 6 })
    const twelve = fanRoomPx({ ...FAN, count: 12 })
    expect(twelve).toBeGreaterThan(six)
    // …and the DURATION is nowhere in the answer: that is the whole point of the fix — the room
    // follows the members, so a group collapsed out of sixteenths asks for what one out of quarters
    // asks for. The mark carries no duration at all.
    expect(Object.keys(FAN)).not.toContain('length')
  })

  it('a steeper ramp asks for more than a gentle one', () => {
    // The tightest gap is what a column must fit, and a 1→4 feather ends far tighter than 1→2.
    expect(fanRoomPx({ ...FAN, beams: 4 })).toBeGreaterThan(fanRoomPx({ ...FAN, beams: 2 }))
  })

  it('the drawn cap is that room, with a little room to stretch', () => {
    expect(fanMaxSpanPx(FAN)).toBeCloseTo(fanRoomPx(FAN) * FAN_MAX_SPAN_STRETCH)
    expect(FAN_MAX_SPAN_STRETCH).toBeGreaterThan(1) // a stretched bar still spreads its music
  })
})

describe('FanStaveNote', () => {
  /** A note built for a fan whose ramp wants `columns` ordinary columns. */
  const build = (columns: number) =>
    new FanStaveNote({ keys: ['c/4'], duration: 'q' }, { ...FAN, count: columns, beams: 1 })
  const roomOf = (columns: number) => fanRoomPx({ ...FAN, count: columns, beams: 1 })

  it('⭐ asserts its room INSIDE preFormat, so a re-format cannot take it back', () => {
    const note = build(8)
    const want = roomOf(8)
    note.preFormat()
    expect(note.getWidth()).toBeGreaterThanOrEqual(want)

    // What the formatter does between one format and the next: `TickContext.addTickable` clears the
    // latch, and the note re-measures. That is exactly the moment the first version of this lost its
    // width — set from outside, recomputed away, and no test would have caught it in jsdom either
    // had it not asked this question.
    note.preFormatted = false
    note.preFormat()
    expect(note.getWidth()).toBeGreaterThanOrEqual(want)
  })

  it('takes the LARGER of the two — the note it is, and the room its ramp wants', () => {
    // Never a SHRINK: a fan whose glyphs need more than its ramp does (a dense chord, a stack of
    // accidentals) keeps the width VexFlow measured. ⚠️ In jsdom that measurement is ~0, so the
    // assertion is the rule itself rather than either branch of it.
    const plain = new StaveNote({ keys: ['c/4'], duration: 'q' })
    plain.preFormat()
    const note = build(1) // a group of one is not a ramp: one column, the smallest ask there is
    note.preFormat()
    expect(note.getWidth()).toBe(Math.max(plain.getWidth(), roomOf(1)))
  })
})

describe('shareFanRoom', () => {
  const fanned = (fan: FanMark): ChordRest => ({
    id: 'f', type: 'chord', beat: { num: 0, den: 1 }, duration: 'q', measure: 1,
    notes: [{ id: 'p', step: 'C', alter: 0, octave: 4 }], fan,
  })
  const rest = (id: string): ChordRest => ({
    id, type: 'rest', beat: { num: 1, den: 1 }, duration: 'q', measure: 1,
  })

  it('hands the fan its FULL ask when the bar can pay it', () => {
    const slots = [fanned(FAN), rest('r')]
    const note = new FanStaveNote({ keys: ['c/4'], duration: 'q' }, FAN)
    shareFanRoom(slots, [note, undefined], 10_000)
    note.preFormat()
    expect(note.getWidth()).toBeGreaterThanOrEqual(fanRoomPx(FAN))
  })

  it('⭐ cuts it to the fan\'s SHARE of the columns when the bar is too small', () => {
    const slots = [fanned(FAN), rest('a'), rest('b')]
    const columns = fanColumns(FAN) + 2
    const area = 100
    const note = new FanStaveNote({ keys: ['c/4'], duration: 'q' }, FAN)
    shareFanRoom(slots, [note, undefined, undefined], area)
    note.preFormat()
    // …and the share is what stops it pushing the rests through the barline: the shares of every
    // slot sum to the bar, by construction.
    expect(note.getWidth()).toBeCloseTo(area * (fanColumns(FAN) / columns), 5)
    expect(note.getWidth()).toBeLessThan(area)
  })
})
