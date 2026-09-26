/**
 * Subject: `./barRestOps` — what a STAMPED full-bar rest does to its bar
 * (docs/plans/voice-measure-rest-plan.md P0): the lane's content goes, ONE flagged whole-bar rest
 * stands in its place, and nothing outside the lane moves.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { ScoreModel } from './ScoreModel'
import type { ChordRest, Rest } from '@/types/music'
import { stampBarRest, stampedBarRestAt } from './barRestOps'
import { findSlot } from './slotLookup'
import { fracCreate as frac, fracToNumber } from '@/utils/fraction'

const v = (s: ChordRest) => s.voice ?? 0
const staffIdOf = (s: ChordRest) => s.staffId

describe('stampBarRest', () => {
  let model: ScoreModel
  beforeEach(() => {
    model = new ScoreModel('BR')
    model.addMeasure()
    model.addMeasure()
  })
  const bar = (n: number) => model.getMeasure(n)!.slots
  const lane = (n: number, voice: number) => bar(n).filter(s => v(s) === voice)

  it('voice 2 over NOTHING: the voice is made, holding one stamped whole-bar rest; voice 1 untouched', () => {
    const a = model.addNote({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    const before = lane(1, 0).map(s => s.id)

    const rest = stampBarRest(model.getScore(), 1, 0, 1)!
    expect(rest).toBeTruthy()
    const v2 = lane(1, 1)
    expect(v2).toHaveLength(1)
    const only = v2[0] as Rest
    expect(only.type).toBe('rest')
    expect(only.isMeasureRest).toBe(true)
    expect(only.stamped).toBe(true)
    expect(fracToNumber(only.actualDuration!)).toBe(4)
    expect(lane(1, 0).map(s => s.id)).toEqual(before)
    expect(model.getNote(a.id)).toBeTruthy()
  })

  it('voice 2 over NOTES: they go — a full-bar rest is a full-bar rest', () => {
    const keep = model.addNote({ step: 'G', octave: 4, duration: 'h', measure: 1, beat: frac(0, 1) })
    const x = model.addNote({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: frac(0, 1), voice: 1 })
    const y = model.addNote({ step: 'D', octave: 4, duration: 'q', measure: 1, beat: frac(1, 1), voice: 1 })

    stampBarRest(model.getScore(), 1, 0, 1)
    expect(model.getNote(x.id)).toBeUndefined()
    expect(model.getNote(y.id)).toBeUndefined()
    expect(lane(1, 1)).toHaveLength(1)
    expect(model.getNote(keep.id)).toBeTruthy()
  })

  it('a TUPLET in the lane goes with its slots', () => {
    const t = model.createTuplet(1, frac(0, 1), '8', 3, 2, 1)
    for (const [i, step] of (['A', 'B', 'C'] as const).entries()) {
      model.addNote({ step, octave: 4, duration: '8', measure: 1, beat: frac(i, 3), tupletId: t.id, actualDuration: frac(1, 3), voice: 1 })
    }
    expect(model.getMeasure(1)!.tuplets.length).toBe(1)
    expect(lane(1, 1).some(s => s.tupletId === t.id)).toBe(true)

    stampBarRest(model.getScore(), 1, 0, 1)
    expect(model.getMeasure(1)!.tuplets).toHaveLength(0)
    expect(lane(1, 1)).toHaveLength(1)
  })

  it('voice 1 too: its notes go, voice 2 stays as it was', () => {
    const a = model.addNote({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    const b = model.addNote({ step: 'A', octave: 3, duration: 'h', measure: 1, beat: frac(0, 1), voice: 1 })

    stampBarRest(model.getScore(), 1, 0, 0)
    expect(model.getNote(a.id)).toBeUndefined()
    expect(lane(1, 0)).toHaveLength(1)
    expect((lane(1, 0)[0] as Rest).stamped).toBe(true)
    expect(model.getNote(b.id)).toBeTruthy()
  })

  it('stamping again is no edit (null), and `stampedBarRestAt` finds it', () => {
    const first = stampBarRest(model.getScore(), 1, 0, 1)!
    expect(stampedBarRestAt(model.getScore(), 1, 0, 1)?.id).toBe(first.id)
    expect(stampBarRest(model.getScore(), 1, 0, 1)).toBeNull()
    expect(stampedBarRestAt(model.getScore(), 1, 0, 0)).toBeUndefined() // voice 1 holds an AUTOMATIC one
  })

  it('a bar that does not exist is no edit', () => {
    expect(stampBarRest(model.getScore(), 9, 0, 1)).toBeNull()
  })

  it('a tie ARRIVING from the bar before keeps its arc, onto the rest', () => {
    const a = model.addNote({ step: 'E', octave: 4, duration: 'q', measure: 1, beat: frac(3, 1), voice: 1 })
    const b = model.addNote({ step: 'E', octave: 4, duration: 'q', measure: 2, beat: frac(0, 1), voice: 1 })
    const pa = findSlot(model.getScore(), a.id)
    const pb = findSlot(model.getScore(), b.id)
    if (pa?.type !== 'chord' || pb?.type !== 'chord') throw new Error('fixture')
    pa.pitch.tiedTo = b.id
    pb.pitch.tiedFrom = a.id

    const rest = stampBarRest(model.getScore(), 2, 0, 1)!
    expect(pa.pitch.tiedTo).toBe(rest.id)
    expect(rest.tiedFrom).toBe(a.id)
  })

  it('a tie LEAVING for the bar after is severed at its far end', () => {
    const a = model.addNote({ step: 'E', octave: 4, duration: 'q', measure: 1, beat: frac(3, 1), voice: 1 })
    const b = model.addNote({ step: 'E', octave: 4, duration: 'q', measure: 2, beat: frac(0, 1), voice: 1 })
    const pa = findSlot(model.getScore(), a.id)
    const pb = findSlot(model.getScore(), b.id)
    if (pa?.type !== 'chord' || pb?.type !== 'chord') throw new Error('fixture')
    pa.pitch.tiedTo = b.id
    pb.pitch.tiedFrom = a.id

    stampBarRest(model.getScore(), 1, 0, 1)
    expect(pb.pitch.tiedFrom).toBeUndefined()
  })

  it('a slur on a removed head follows it onto the rest', () => {
    const a = model.addNote({ step: 'E', octave: 4, duration: 'q', measure: 1, beat: frac(0, 1), voice: 1 })
    const b = model.addNote({ step: 'F', octave: 4, duration: 'q', measure: 2, beat: frac(0, 1), voice: 1 })
    const slur = model.addSlur({ startNoteId: a.id, endNoteId: b.id } as never)

    const rest = stampBarRest(model.getScore(), 1, 0, 1)!
    const after = model.getScore().slurs?.find(s => s.id === slur.id)
    expect(after?.startNoteId).toBe(rest.id)
  })

  it('the SAME voice on another staff is not touched', () => {
    model.addStaffBelow(0)
    const lower = model.addNote({ step: 'C', octave: 3, duration: 'q', measure: 1, beat: frac(0, 1), voice: 1, staff: 1 })
    const lowerStaffId = staffIdOf(bar(1).find(s => s.type === 'chord')!)

    stampBarRest(model.getScore(), 1, 0, 1)
    expect(model.getNote(lower.id)).toBeTruthy()
    const topV2 = lane(1, 1).filter(s => s.staffId !== lowerStaffId)
    expect(topV2).toHaveLength(1)
    expect((topV2[0] as Rest).stamped).toBe(true)
  })
})
