import { describe, it, expect } from 'vitest'
import { flattenRegion, relayEvents, type RebarEvent, type BarPlan } from './rebar'
import { getMeterInfo } from './meter'
import { fracCreate, fracToNumber } from './fraction'
import type { TimeSignature, Measure, Chord, NotePitch } from '@/types/music'

/**
 * Subject: `./rebar` — **WHAT A NOTE IS DRAWN AS, surviving a re-lay** ({@link RebarEvent.written}).
 *
 * The relay exists to re-engrave a stream of sounding lengths: that is what lets a paste split a
 * note at a barline, regenerate ties and fill the rest. The cost is that it must decide a SPELLING
 * for every length, and `decomposeSpan` — its decomposer — applies the RESTS' metric rule (a value
 * may not cross a beat stronger than its own endpoints). A note has no such rule, so re-deriving
 * one is a wrong answer to a question the author already answered.
 *
 * 🚨 **HIS REPORT, 2026-08-30** (the Prelude, the bass staff of bar 1 copied onto bar 2): a **dotted
 * eighth tied to a quarter** came back as a **16th + an eighth + a quarter** — same length, three
 * notes where he had drawn two. A tie chain collapses into ONE event on the way in (that is what
 * lets the paste re-split it), and a single authored shape cannot describe 7/4 of a beat, so the
 * whole spelling was dropped and the length re-tiled. ⭐ The chain is one event and SEVERAL figures,
 * so `written` is a sequence.
 *
 * What still re-derives, and must: a fragment SPLIT at a barline (its halves are new shapes), and a
 * length whose spelling was never known (a collapsed fan, a measure rest).
 */

const ts = (n: number, d: number): TimeSignature => ({ numerator: n, denominator: d })
const F = (n: number, d = 1) => fracCreate(n, d)

/** Readable [duration, dots, beat, tieFrom, tieTo] tuples for a bar. */
function shape(bar: BarPlan) {
  return bar.map(p => [p.duration, p.dots, fracToNumber(p.beat), p.tieFromPrev ? 'F' : '', p.tieToNext ? 'T' : ''])
}

let nextId = 0
const id = () => `id${nextId++}`
const pitch = (ties: Partial<NotePitch> = {}): NotePitch => ({ id: id(), step: 'E', alter: 0, octave: 4, ...ties })
const chord = (beat: Fraction, duration: Chord['duration'], notes: NotePitch[], dots = 0): Chord =>
  ({ id: id(), type: 'chord', beat, duration, dots, measure: 1, notes })
const measure = (slots: Chord[]): Measure => ({ id: id(), number: 1, slots, timeSignature: ts(4, 4), tuplets: [] })
type Fraction = ReturnType<typeof F>

const relayWhole = (events: RebarEvent[]) => relayEvents(events, getMeterInfo(ts(4, 4)), { targetBars: 1, bounded: false })

describe('the authored shape survives a re-lay', () => {
  it('a dotted quarter stays a dotted quarter — not a quarter tied to an eighth', () => {
    const bars = relayWhole([{ offset: F(0), duration: F(3, 2), pitches: [{ step: 'E', alter: 0, octave: 4 }], written: [{ duration: 'q', dots: 1 }] }])
    expect(shape(bars[0])[0]).toEqual(['q', 1, 0, '', ''])
  })

  it('⛔ and without a recorded shape the same length re-tiles by the METRE — the behaviour being overridden', () => {
    const bars = relayWhole([{ offset: F(0), duration: F(3, 2), pitches: [{ step: 'E', alter: 0, octave: 4 }] }])
    expect(shape(bars[0]).length).toBeGreaterThan(1)
  })
})

describe('🚨 a TIE CHAIN keeps the figures it was written as — his report', () => {
  /** The Prelude's shape: a dotted eighth at beat 1/4 tied to a quarter at beat 1. */
  const chainMeasure = () => {
    const head = pitch({ tiedTo: 'tail' })
    const tail = pitch()
    head.tiedTo = tail.id
    tail.tiedFrom = head.id
    return measure([chord(F(1, 4), '8', [head], 1), chord(F(1), 'q', [tail])])
  }

  it('flattens to ONE event carrying BOTH shapes, in order', () => {
    const events = flattenRegion([chainMeasure()], 0)
    expect(events).toHaveLength(1)
    expect(fracToNumber(events[0].duration)).toBeCloseTo(1.75)
    expect(events[0].written).toEqual([{ duration: '8', dots: 1 }, { duration: 'q', dots: 0 }])
  })

  it('and re-lays as the dotted eighth tied to the quarter — not 16th + 8th + quarter', () => {
    // Just the notes: the relay fills the silence either side, which is not what this is about.
    const bars = relayWhole(flattenRegion([chainMeasure()], 0)).map(bar => bar.filter(p => !p.isRest))
    expect(shape(bars[0])).toEqual([
      ['8', 1, 0.25, '', 'T'],
      ['q', 0, 1, 'F', ''],
    ])
  })

  it('⚠️ a chain with ONE unspellable piece re-derives whole — a partial sequence would not sum', () => {
    const events: RebarEvent[] = [{
      offset: F(0), duration: F(7, 4), pitches: [{ step: 'E', alter: 0, octave: 4 }],
      // As `flattenRegion` would leave it when the tail's written value did not describe its length.
      written: undefined,
    }]
    expect(relayWhole(events)[0].length).toBeGreaterThan(2)
  })
})

describe('what must still be re-derived', () => {
  it('a note SPLIT at a barline — its halves are new shapes, and neither is what was written', () => {
    // A dotted quarter starting a quarter before the barline of a 4/4 bar.
    const bars = relayEvents(
      [{ offset: F(15, 4), duration: F(3, 2), pitches: [{ step: 'E', alter: 0, octave: 4 }], written: [{ duration: 'q', dots: 1 }] }],
      getMeterInfo(ts(4, 4)),
      { targetBars: 2, bounded: false },
    )
    // The tail piece lands in the next bar; the authored dotted quarter cannot describe either half.
    expect(bars[1].some(p => !p.isRest)).toBe(true)
    expect(bars[0].filter(p => !p.isRest).every(p => !(p.duration === 'q' && p.dots === 1))).toBe(true)
  })
})
