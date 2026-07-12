import { describe, it, expect } from 'vitest'
import {
  DEFAULT_TEMPO,
  markToQpm,
  buildTempoMap,
  beatsToSeconds,
  secondsToBeats,
  totalSeconds,
  effectiveTempoAt,
  tempoMarks,
} from './tempoMap'
import { fracCreate } from './fraction'
import type { Measure, Score, TempoMark, TimeSignature } from '@/types/music'

const TS: TimeSignature = { numerator: 4, denominator: 4 }

/** Build a minimal Score whose measures (4/4 = 4 quarter-beats each) carry the given marks. */
function scoreOf(...measureTempos: TempoMark[][]): Score {
  const measures: Measure[] = measureTempos.map((tempos, i) => ({
    id: `m${i + 1}`,
    number: i + 1,
    slots: [],
    timeSignature: TS,
    tuplets: [],
    tempos: tempos.length ? tempos : undefined,
  }))
  return {
    id: 's',
    title: 't',
    measures,
    keySignature: { key: 'C', accidentals: 0 },
    defaultTimeSignature: TS,
  }
}

/** A speed-stating mark at `beatNum` (default unit = quarter). */
function mark(beatNum: number, bpm: number, extra: Partial<TempoMark> = {}): TempoMark {
  return { id: `t${beatNum}-${bpm}`, beat: fracCreate(beatNum, 1), bpm, ...extra }
}

describe('markToQpm — the unit is half the meaning', () => {
  it('reads a bare bpm as quarter-notes per minute', () => {
    expect(markToQpm(mark(0, 120))).toBe(120)
    expect(markToQpm(mark(0, 120, { unit: 'q' }))).toBe(120)
  })

  it('scales by the beat unit: half = 60 is 120 qpm, eighth = 120 is 60 qpm', () => {
    expect(markToQpm(mark(0, 60, { unit: 'h' }))).toBe(120)
    expect(markToQpm(mark(0, 120, { unit: '8' }))).toBe(60)
    expect(markToQpm(mark(0, 60, { unit: 'w' }))).toBe(240)
  })

  it('scales by dots: a dotted quarter = 60 is 90 qpm', () => {
    expect(markToQpm(mark(0, 60, { unit: 'q', dots: 1 }))).toBe(90)
    expect(markToQpm(mark(0, 60, { unit: 'h', dots: 1 }))).toBe(180)
  })

  it('is undefined for a word with no number (it prints; it does not change the speed)', () => {
    expect(markToQpm({ id: 'w', beat: fracCreate(0, 1), text: 'Allegro' })).toBeUndefined()
  })

  it('is undefined for a nonsensical bpm rather than yielding an infinite clock', () => {
    expect(markToQpm(mark(0, 0))).toBeUndefined()
    expect(markToQpm(mark(0, -20))).toBeUndefined()
    expect(markToQpm(mark(0, NaN))).toBeUndefined()
  })

  it('does NOT derive the speed from the word — bpm is the source of truth', () => {
    // 'Adagio' with an explicit 144 sounds 144. The word is never looked up.
    expect(markToQpm(mark(0, 144, { text: 'Adagio' }))).toBe(144)
  })

  it('sounds even when the metronome is not printed (showMetronome is display only)', () => {
    expect(markToQpm(mark(0, 144, { text: 'Allegro', showMetronome: false }))).toBe(144)
  })
})

describe('buildTempoMap', () => {
  it('falls back to DEFAULT_TEMPO for a score with no marks (no global tempo field)', () => {
    expect(buildTempoMap(scoreOf([], []))).toEqual([
      { startBeats: 0, qpm: DEFAULT_TEMPO, startSeconds: 0 },
    ])
  })

  it('opens at beat 0 with the mark placed there', () => {
    expect(buildTempoMap(scoreOf([mark(0, 60)]))).toEqual([
      { startBeats: 0, qpm: 60, startSeconds: 0 },
    ])
  })

  it('keeps DEFAULT_TEMPO before a first mark that is not at the start', () => {
    // m1 has no mark → 120 qpm for 4 beats (2s); m2 b0 = beat 4 → 60 qpm.
    expect(buildTempoMap(scoreOf([], [mark(0, 60)]))).toEqual([
      { startBeats: 0, qpm: 120, startSeconds: 0 },
      { startBeats: 4, qpm: 60, startSeconds: 2 },
    ])
  })

  it('accumulates startSeconds across mid-score changes', () => {
    // 120 qpm for beats 0-2 (1s), then 60 qpm from beat 2 for 2 beats (2s) → m2 at 3s.
    const map = buildTempoMap(scoreOf([mark(0, 120), mark(2, 60)], [mark(0, 240)]))
    expect(map).toEqual([
      { startBeats: 0, qpm: 120, startSeconds: 0 },
      { startBeats: 2, qpm: 60, startSeconds: 1 },
      { startBeats: 4, qpm: 240, startSeconds: 3 },
    ])
  })

  it('converts the unit, not the bpm: half = 60 in bar 2 is a 120 qpm segment', () => {
    const map = buildTempoMap(scoreOf([], [mark(0, 60, { unit: 'h' })]))
    expect(map[1].qpm).toBe(120)
  })

  it('skips word-only marks — they print, the previous speed carries on', () => {
    const word: TempoMark = { id: 'w', beat: fracCreate(2, 1), text: 'dolce' }
    expect(buildTempoMap(scoreOf([mark(0, 60), word]))).toEqual([
      { startBeats: 0, qpm: 60, startSeconds: 0 },
    ])
  })

  it('sorts marks stored out of order', () => {
    const map = buildTempoMap(scoreOf([mark(2, 60), mark(0, 120)]))
    expect(map.map(s => [s.startBeats, s.qpm])).toEqual([[0, 120], [2, 60]])
  })

  it('dedupes two marks on one beat — last wins (the clef rule, not the dynamics rule)', () => {
    const map = buildTempoMap(scoreOf([{ ...mark(0, 60), id: 'a' }, { ...mark(0, 90), id: 'b' }]))
    expect(map).toEqual([{ startBeats: 0, qpm: 90, startSeconds: 0 }])
  })

  it('places a mark on an off-slot beat with no note (marks are beat-anchored)', () => {
    const offBeat: TempoMark = { id: 'half', beat: fracCreate(1, 2), bpm: 60 }
    const map = buildTempoMap(scoreOf([offBeat])) // beat 1/2 of an empty measure
    expect(map[1]).toEqual({ startBeats: 0.5, qpm: 60, startSeconds: 0.25 })
  })

  it('honours a pickup bar’s real capacity when accumulating measure offsets', () => {
    const score = scoreOf([], [mark(0, 60)])
    score.measures[0].actualDurationOverride = fracCreate(1, 1) // 1-beat pickup, not 4
    expect(buildTempoMap(score)[1].startBeats).toBe(1)
  })
})

describe('scope — the number of clocks is a parameter, not 1', () => {
  it('a system-wide mark (no scopeId) governs every scope', () => {
    const score = scoreOf([mark(0, 60)])
    expect(buildTempoMap(score, 'orchestra-2')[0].qpm).toBe(60)
    expect(buildTempoMap(score, undefined)[0].qpm).toBe(60)
  })

  it('a scoped mark governs only its own clock', () => {
    const score = scoreOf([mark(0, 60, { scopeId: 'orchestra-1' })])
    expect(buildTempoMap(score, 'orchestra-1')[0].qpm).toBe(60)
    expect(buildTempoMap(score, 'orchestra-2')[0].qpm).toBe(DEFAULT_TEMPO)
    expect(buildTempoMap(score, undefined)[0].qpm).toBe(DEFAULT_TEMPO)
  })

  it('two scopes yield two independent clocks from one score (Gruppen, in miniature)', () => {
    const score = scoreOf([
      mark(0, 60, { scopeId: 'a' }),
      { ...mark(0, 90, { scopeId: 'b' }), id: 'b0' },
    ])
    expect(buildTempoMap(score, 'a')[0].qpm).toBe(60)
    expect(buildTempoMap(score, 'b')[0].qpm).toBe(90)
  })
})

describe('beatsToSeconds / secondsToBeats', () => {
  const map = buildTempoMap(scoreOf([mark(0, 120), mark(2, 60)], [mark(0, 240)]))
  // segments: 0b@120qpm (0s) | 2b@60qpm (1s) | 4b@240qpm (3s)

  it('converts within the first segment', () => {
    expect(beatsToSeconds(map, 0)).toBe(0)
    expect(beatsToSeconds(map, 1)).toBe(0.5)
  })

  it('converts across a tempo change', () => {
    expect(beatsToSeconds(map, 2)).toBe(1) // segment boundary
    expect(beatsToSeconds(map, 3)).toBe(2) // 1 beat at 60 qpm = 1s
    expect(beatsToSeconds(map, 6)).toBe(3.5) // 2 beats at 240 qpm = 0.5s
  })

  it('measures a note that STRADDLES a change by difference, not by one scalar', () => {
    // A half note at beat 1: 1 beat at 120 qpm (0.5s) + 1 beat at 60 qpm (1s) = 1.5s.
    const sounding = beatsToSeconds(map, 1 + 2) - beatsToSeconds(map, 1)
    expect(sounding).toBe(1.5)
    expect(sounding).not.toBe((2 * 60) / 120) // what the old scalar would have said
  })

  it('secondsToBeats is the exact inverse (the playhead must not drift)', () => {
    for (const beats of [0, 0.5, 1, 2, 3, 4, 5.25, 8]) {
      expect(secondsToBeats(map, beatsToSeconds(map, beats))).toBeCloseTo(beats, 10)
    }
  })

  it('beatsToSeconds is the exact inverse of secondsToBeats', () => {
    for (const seconds of [0, 0.25, 1, 2.5, 3, 4]) {
      expect(beatsToSeconds(map, secondsToBeats(map, seconds))).toBeCloseTo(seconds, 10)
    }
  })

  it('extrapolates past the last segment with the last tempo', () => {
    expect(beatsToSeconds(map, 8)).toBe(4) // 4 beats at 240 qpm past beat 4 (3s) = 1s
  })

  it('totalSeconds is the whole score at the map’s tempi', () => {
    // 8 beats of a two-bar 4/4 score: 2 beats @120 (1s) + 2 @60 (2s) + 4 @240 (1s) = 4s.
    expect(totalSeconds(map, 8)).toBe(4)
  })

  it('a mark-free score plays at DEFAULT_TEMPO (120 qpm → 8 beats = 4s)', () => {
    expect(totalSeconds(buildTempoMap(scoreOf([], [])), 8)).toBe(4)
  })
})

describe('effectiveTempoAt — the walk-back resolver', () => {
  it('returns DEFAULT_TEMPO when the score states no tempo', () => {
    expect(effectiveTempoAt(scoreOf([], []), 2, fracCreate(0, 1))).toBe(DEFAULT_TEMPO)
  })

  it('returns DEFAULT_TEMPO before the first mark', () => {
    const score = scoreOf([mark(2, 60)])
    expect(effectiveTempoAt(score, 1, fracCreate(1, 1))).toBe(DEFAULT_TEMPO)
    expect(effectiveTempoAt(score, 1, fracCreate(2, 1))).toBe(60) // at the mark itself
  })

  it('inherits the last mark from an earlier measure', () => {
    const score = scoreOf([mark(0, 60)], [], [])
    expect(effectiveTempoAt(score, 3, fracCreate(3, 1))).toBe(60)
  })

  it('takes the latest mark at-or-before the beat within a measure', () => {
    const score = scoreOf([mark(0, 60), mark(2, 90)])
    expect(effectiveTempoAt(score, 1, fracCreate(1, 1))).toBe(60)
    expect(effectiveTempoAt(score, 1, fracCreate(3, 1))).toBe(90)
  })

  it('walks past a word-only mark to the last mark that states a speed', () => {
    const word: TempoMark = { id: 'w', beat: fracCreate(2, 1), text: 'con moto' }
    const score = scoreOf([mark(0, 60), word])
    expect(effectiveTempoAt(score, 1, fracCreate(3, 1))).toBe(60)
  })

  it('agrees with the map it is the twin of', () => {
    const score = scoreOf([mark(0, 120), mark(2, 60)], [mark(0, 240)])
    const map = buildTempoMap(score)
    expect(effectiveTempoAt(score, 1, fracCreate(3, 1))).toBe(map[1].qpm)
    expect(effectiveTempoAt(score, 2, fracCreate(0, 1))).toBe(map[2].qpm)
  })

  it('is scope-aware', () => {
    const score = scoreOf([mark(0, 60, { scopeId: 'a' })])
    expect(effectiveTempoAt(score, 1, fracCreate(0, 1), 'a')).toBe(60)
    expect(effectiveTempoAt(score, 1, fracCreate(0, 1), 'b')).toBe(DEFAULT_TEMPO)
  })
})

describe('tempoMarks', () => {
  it('returns the measure’s marks sorted by beat, without mutating the score', () => {
    const score = scoreOf([mark(2, 60), mark(0, 90)])
    expect(tempoMarks(score, 1).map(m => m.bpm)).toEqual([90, 60])
    expect(score.measures[0].tempos!.map(m => m.bpm)).toEqual([60, 90]) // untouched
  })

  it('is empty for a measure with no marks or no such measure', () => {
    expect(tempoMarks(scoreOf([]), 1)).toEqual([])
    expect(tempoMarks(scoreOf([]), 99)).toEqual([])
  })
})
