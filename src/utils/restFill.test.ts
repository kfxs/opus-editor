import { describe, it, expect } from 'vitest'
import { fillRests, pickVoiceMode, type RestSlot } from './restFill'
import { getMeterInfo } from './meter'
import { fracCreate, fracToNumber } from './fraction'
import { durationToFraction } from './durations'
import type { TimeSignature, ChordRest } from '@/types/music'

// --- helpers ---------------------------------------------------------------

const ts = (n: number, d: number): TimeSignature => ({ numerator: n, denominator: d })
const F = (n: number, d = 1) => fracCreate(n, d)

/** Fill a span and return readable [duration, dots, beat] tuples. */
function shape(start: number, startDen: number, end: number, endDen: number, t: TimeSignature, grouping?: number[]) {
  const rests = fillRests(fracCreate(start, startDen), fracCreate(end, endDen), getMeterInfo(t, grouping))
  return rests.map((r) => [r.duration, r.dots, fracToNumber(r.beat)] as [string, number, number])
}

/** Total sounding length of the emitted rests, as a float. */
function totalLen(rests: RestSlot[]): number {
  return rests.reduce((sum, r) => sum + fracToNumber(durationToFraction(r.duration, r.dots)), 0)
}

describe('restFill — fillRests', () => {
  describe('whole empty bar → a single measure rest, in every meter', () => {
    for (const [n, d] of [[4, 4], [3, 4], [6, 8], [5, 8], [12, 8], [32, 16], [16, 4]] as const) {
      it(`${n}/${d} empty bar`, () => {
        const meter = getMeterInfo(ts(n, d))
        const rests = fillRests(F(0), meter.barQuarters, meter)
        expect(rests).toHaveLength(1)
        expect(rests[0]).toMatchObject({ duration: 'w', dots: 0, isMeasureRest: true })
        expect(fracToNumber(rests[0].beat)).toBe(0)
      })
    }
  })

  describe('4/4 — simple time never crosses the bar middle', () => {
    it('quarter at beat 0 → fill [1,4): q + h', () => {
      expect(shape(1, 1, 4, 1, ts(4, 4))).toEqual([
        ['q', 0, 1],
        ['h', 0, 2],
      ])
    })

    it('half at beat 2 → fill [0,2): a single half rest', () => {
      expect(shape(0, 1, 2, 1, ts(4, 4))).toEqual([['h', 0, 0]])
    })

    it('mid-bar-crossing gap [1,3) → two quarter rests, not a half', () => {
      expect(shape(1, 1, 3, 1, ts(4, 4))).toEqual([
        ['q', 0, 1],
        ['q', 0, 2],
      ])
    })

    it('off-beat gap [0.5,2) → eighth then quarter (realigns to the beat)', () => {
      expect(shape(1, 2, 2, 1, ts(4, 4))).toEqual([
        ['8', 0, 0.5],
        ['q', 0, 1],
      ])
    })
  })

  describe('compound time → dotted felt-beat rests', () => {
    it('6/8: full felt beat of silence [1.5,3) → one dotted-quarter rest', () => {
      expect(shape(3, 2, 3, 1, ts(6, 8))).toEqual([['q', 1, 1.5]])
    })

    it('6/8: eighth then rest-of-beat [0.5,1.5) → a quarter rest', () => {
      expect(shape(1, 2, 3, 2, ts(6, 8))).toEqual([['q', 0, 0.5]])
    })

    it('12/8: two adjacent beats before the middle [0,3) → a dotted-half rest', () => {
      expect(shape(0, 1, 3, 1, ts(12, 8))).toEqual([['h', 1, 0]])
    })

    it('12/8: a mid-bar-crossing gap [1.5,4.5) → two dotted-quarters, split at the middle', () => {
      expect(shape(3, 2, 9, 2, ts(12, 8))).toEqual([
        ['q', 1, 1.5],
        ['q', 1, 3],
      ])
    })
  })

  describe('irregular meters respect the additive grouping', () => {
    it('5/8 (2+3): eighth then group-2 silence [0.5,2.5) → eighth + dotted-quarter', () => {
      expect(shape(1, 2, 5, 2, ts(5, 8))).toEqual([
        ['8', 0, 0.5],
        ['q', 1, 1],
      ])
    })

    it('7/8 (2+2+3): gap [1,3.5) → quarter then a dotted-quarter for the 3-group', () => {
      expect(shape(1, 1, 7, 2, ts(7, 8))).toEqual([
        ['q', 0, 1],
        ['q', 1, 2],
      ])
    })
  })

  describe('pickVoiceMode — STRICT is never chosen', () => {
    const bar = getMeterInfo(ts(4, 4)).barQuarters // 4 quarters
    const chord = (beat: number, duration: any, dots = 0): ChordRest => ({
      id: `c${beat}`, type: 'chord', beat: fracCreate(beat, 1), duration, dots, measure: 1,
      actualDuration: durationToFraction(duration, dots), notes: [],
    })
    const measureRest = (): ChordRest => ({
      id: 'mr', type: 'rest', beat: fracCreate(0, 1), duration: 'w', measure: 1,
      actualDuration: bar, isMeasureRest: true,
    })

    it('a normal, exactly-full bar → FULL', () => {
      expect(pickVoiceMode([chord(0, 'h'), chord(2, 'h')], bar)).toBe('full')
    })

    it('an under-full (pickup-style) bar → FULL', () => {
      expect(pickVoiceMode([chord(0, 'q')], bar)).toBe('full')
    })

    it('an over-full bar → SOFT (keep every note, render crowded)', () => {
      expect(pickVoiceMode([chord(0, 'w'), chord(4, 'q')], bar)).toBe('soft')
    })

    it('a bar holding a measure rest → SOFT (whole-rest ticks ≠ capacity in general)', () => {
      expect(pickVoiceMode([measureRest()], getMeterInfo(ts(3, 4)).barQuarters)).toBe('soft')
      expect(pickVoiceMode([measureRest()], bar)).toBe('soft')
    })
  })

  describe('invariants', () => {
    it('emitted rests always sum exactly to the gap length', () => {
      const spans: Array<[number, number, number, number, TimeSignature]> = [
        [1, 1, 4, 1, ts(4, 4)],
        [1, 2, 2, 1, ts(4, 4)],
        [3, 2, 3, 1, ts(6, 8)],
        [1, 2, 5, 2, ts(5, 8)],
        [1, 1, 7, 2, ts(7, 8)],
        [3, 2, 9, 2, ts(12, 8)],
        [1, 4, 13, 4, ts(13, 16)],
      ]
      for (const [sn, sd, en, ed, t] of spans) {
        const meter = getMeterInfo(t)
        const rests = fillRests(fracCreate(sn, sd), fracCreate(en, ed), meter)
        expect(totalLen(rests)).toBeCloseTo(en / ed - sn / sd, 9)
      }
    })

    it('empty span returns nothing', () => {
      expect(fillRests(F(2), F(2), getMeterInfo(ts(4, 4)))).toEqual([])
      expect(fillRests(F(3), F(2), getMeterInfo(ts(4, 4)))).toEqual([])
    })
  })
})
