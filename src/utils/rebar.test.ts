import { describe, it, expect } from 'vitest'
import { flattenRegion, relayEvents, type RebarEvent, type RebarPitch, type BarPlan } from './rebar'
import { getMeterInfo } from './meter'
import { fracCreate, fracToNumber } from './fraction'
import { durationToFraction } from './durations'
import type { TimeSignature, Measure, Chord, Rest, NotePitch } from '@/types/music'

// --- helpers ---------------------------------------------------------------

const ts = (n: number, d: number): TimeSignature => ({ numerator: n, denominator: d })
const F = (n: number, d = 1) => fracCreate(n, d)
const P = (step: any, octave = 4, alter: any = 0): RebarPitch => ({ step, alter, octave })

/** A plain note/chord event at [off, off+dur) quarter beats. */
function note(off: number, dur: number, pitches: RebarPitch[] = [P('C')]): RebarEvent {
  return { offset: F(off), duration: F(dur), pitches }
}

/** Readable [duration, dots, beat, tieFrom, tieTo, isRest] tuples for a bar. */
function shape(bar: BarPlan) {
  return bar.map((p) => [
    p.duration,
    p.dots,
    fracToNumber(p.beat),
    p.tieFromPrev ? 'F' : '',
    p.tieToNext ? 'T' : '',
    p.isRest ? 'r' : 'n',
  ])
}

/** Sum of sounding length of non-rest pieces across all bars. */
function noteLen(bars: BarPlan[]): number {
  let total = 0
  for (const bar of bars)
    for (const p of bar)
      if (!p.isRest) total += fracToNumber(durationToFraction(p.duration, p.dots))
  return total
}

const unbounded = (targetBars: number) => ({ targetBars, bounded: false })

// --- relayEvents -----------------------------------------------------------

describe('rebar — relayEvents', () => {
  it('4/4 → 3/4: a run of four quarters re-bars across moved barlines (no ties needed)', () => {
    const bars = relayEvents(
      [note(0, 1), note(1, 1), note(2, 1), note(3, 1)],
      getMeterInfo(ts(3, 4)),
      unbounded(1),
    )
    expect(bars).toHaveLength(2)
    expect(shape(bars[0])).toEqual([
      ['q', 0, 0, '', '', 'n'],
      ['q', 0, 1, '', '', 'n'],
      ['q', 0, 2, '', '', 'n'],
    ])
    // bar 1: one quarter + a half-rest filling [1,3)
    expect(shape(bars[1])).toEqual([
      ['q', 0, 0, '', '', 'n'],
      ['h', 0, 1, '', '', 'r'],
    ])
    expect(noteLen(bars)).toBeCloseTo(4, 9)
  })

  it('4/4 → 3/4: a half note straddling the new barline splits into two tied quarters', () => {
    // gap [0,2) then a half note [2,4); in 3/4 the half crosses the bar 0/1 line at 3.
    const bars = relayEvents([note(2, 2)], getMeterInfo(ts(3, 4)), unbounded(1))
    expect(bars).toHaveLength(2)
    expect(shape(bars[0])).toEqual([
      ['h', 0, 0, '', '', 'r'], // rest fill [0,2)
      ['q', 0, 2, '', 'T', 'n'], // first half of the split, tied forward
    ])
    expect(shape(bars[1])).toEqual([
      ['q', 0, 0, 'F', '', 'n'], // continuation, tied back
      ['h', 0, 1, '', '', 'r'], // rest fill [1,3)
    ])
    expect(noteLen(bars)).toBeCloseTo(2, 9)
  })

  it('4/4 → 6/8: a quarter crossing the dotted-beat boundary becomes two tied eighths', () => {
    // note at quarter-beat 1 spans [1,2), crossing the 6/8 main beat at 1.5.
    const bars = relayEvents([note(1, 1)], getMeterInfo(ts(6, 8)), unbounded(1))
    expect(bars).toHaveLength(1)
    const s = shape(bars[0])
    // among the pieces, the note splits into 8@1 (tied) + 8@1.5 (tied back)
    expect(s).toContainEqual(['8', 0, 1, '', 'T', 'n'])
    expect(s).toContainEqual(['8', 0, 1.5, 'F', '', 'n'])
    expect(noteLen(bars)).toBeCloseTo(1, 9)
  })

  it('chords keep every pitch on both sides of a tie split', () => {
    const chord = [P('C'), P('E')]
    const bars = relayEvents([note(2, 2, chord)], getMeterInfo(ts(3, 4)), unbounded(1))
    const first = bars[0].find((p) => p.tieToNext)!
    const second = bars[1].find((p) => p.tieFromPrev)!
    expect(first.pitches).toEqual(chord)
    expect(second.pitches).toEqual(chord)
  })

  it('an atomic (tuplet) event is placed whole, never split', () => {
    const atomic: RebarEvent = {
      offset: F(0),
      duration: F(1),
      atomic: true,
      payload: {
        def: { id: 't1', startBeat: F(0), baseDuration: '8', numNotes: 3, notesOccupied: 2 },
        slots: [],
      },
    }
    const bars = relayEvents([atomic], getMeterInfo(ts(3, 4)), unbounded(1))
    const atomicPieces = bars.flat().filter((p) => p.atomic)
    expect(atomicPieces).toHaveLength(1)
    expect(atomicPieces[0].payload?.def.id).toBe('t1')
  })

  it('unbounded: shorter content keeps trailing measure-rest bars up to the target', () => {
    const bars = relayEvents([note(0, 1)], getMeterInfo(ts(4, 4)), unbounded(3))
    expect(bars).toHaveLength(3)
    expect(bars[1]).toHaveLength(1)
    expect(bars[1][0].isMeasureRest).toBe(true)
    expect(bars[2][0].isMeasureRest).toBe(true)
  })

  it('unbounded: longer content grows past the target bar count', () => {
    // eight quarters in 2/4 → four bars even though target is 1
    const evs = Array.from({ length: 8 }, (_, i) => note(i, 1))
    const bars = relayEvents(evs, getMeterInfo(ts(2, 4)), unbounded(1))
    expect(bars).toHaveLength(4)
    expect(noteLen(bars)).toBeCloseTo(8, 9)
  })

  it('an all-rests region becomes measure-rest bars matching the target', () => {
    const bars = relayEvents([], getMeterInfo(ts(4, 4)), unbounded(2))
    expect(bars).toHaveLength(2)
    expect(bars.every((b) => b.length === 1 && b[0].isMeasureRest)).toBe(true)
  })

  it('bounded: overflow folds into the last allowed bar (crowded), never lost', () => {
    // four quarters but the region is pinned to a single 2/4 bar
    const bars = relayEvents(
      [note(0, 1), note(1, 1), note(2, 1), note(3, 1)],
      getMeterInfo(ts(2, 4)),
      { targetBars: 1, bounded: true },
    )
    expect(bars).toHaveLength(1)
    expect(noteLen(bars)).toBeCloseTo(4, 9) // all four quarters survive
  })
})

// --- flattenRegion ---------------------------------------------------------

describe('rebar — flattenRegion', () => {
  let nextId = 0
  const id = () => `id${nextId++}`
  const pitch = (step: any, octave = 4, ties: Partial<NotePitch> = {}): NotePitch => ({
    id: id(),
    step,
    alter: 0,
    octave,
    ...ties,
  })
  const chord = (measure: number, beat: number, duration: any, notes: NotePitch[], dots = 0): Chord => ({
    id: id(),
    type: 'chord',
    beat: F(beat),
    duration,
    dots,
    measure,
    notes,
  })
  const rest = (measure: number, beat: number, duration: any): Rest => ({
    id: id(),
    type: 'rest',
    beat: F(beat),
    duration,
    measure,
  })
  const measure = (number: number, slots: any[], t = ts(4, 4)): Measure => ({
    id: id(),
    number,
    slots,
    timeSignature: t,
    tuplets: [],
  })

  it('drops plain rests (they become gaps) and keeps absolute offsets', () => {
    const m = measure(1, [rest(1, 0, 'h'), chord(1, 2, 'h', [pitch('C')])])
    const events = flattenRegion([m])
    expect(events).toHaveLength(1)
    expect(fracToNumber(events[0].offset)).toBe(2)
    expect(fracToNumber(events[0].duration)).toBe(2)
  })

  it('offsets continue across measures using each bar length', () => {
    const m1 = measure(1, [chord(1, 0, 'w', [pitch('C')])])
    const m2 = measure(2, [chord(2, 0, 'q', [pitch('D')])])
    const events = flattenRegion([m1, m2])
    expect(events.map((e) => fracToNumber(e.offset))).toEqual([0, 4])
  })

  it('collapses a tie chain across the barline into one logical note', () => {
    // C half tied across a 4/4 barline: half at m1 beat 2 → half at m2 beat 0
    const a = pitch('C')
    const b = pitch('C')
    a.tiedTo = b.id
    b.tiedFrom = a.id
    const m1 = measure(1, [chord(1, 2, 'h', [a])])
    const m2 = measure(2, [chord(2, 0, 'h', [b])])
    const events = flattenRegion([m1, m2])
    expect(events).toHaveLength(1)
    expect(fracToNumber(events[0].offset)).toBe(2)
    expect(fracToNumber(events[0].duration)).toBe(4) // two halves merged
  })

  it('keeps a tuplet as a single atomic event', () => {
    const t: Measure['tuplets'][number] = {
      id: 'tp', startBeat: F(0), baseDuration: '8', numNotes: 3, notesOccupied: 2,
    }
    const slots = [
      { ...chord(1, 0, '8', [pitch('C')]), tupletId: 'tp' },
      { ...chord(1, 1, '8', [pitch('D')]), tupletId: 'tp' },
      { ...chord(1, 2, '8', [pitch('E')]), tupletId: 'tp' },
    ]
    const m = measure(1, slots)
    m.tuplets = [t]
    const events = flattenRegion([m])
    expect(events).toHaveLength(1)
    expect(events[0].atomic).toBe(true)
    expect(events[0].payload?.def.id).toBe('tp')
    expect(events[0].payload?.slots).toHaveLength(3)
  })
})
