import { describe, it, expect } from 'vitest'
import { ScoreModel } from '../models/ScoreModel'
import { collectScheduledNotes, scoreTotalBeats } from './playbackSchedule'
import { fracCreate as frac } from '@/utils/fraction'
import type { Score, TempoMark } from '@/types/music'
import { buildTempoMap, beatsToSeconds, totalSeconds } from '@/utils/tempoMap'

// MIDI reference: C4 = 60, C3 = 48, E4 = 64, G4 = 67.
const C4 = 60, C3 = 48, E4 = 64

/** Wire a same-pitch tie `fromId`→`toId` directly on the score (flat note id == pitch id). */
function tie(score: Score, fromId: string, toId: string): void {
  for (const m of score.measures) {
    for (const s of m.slots) {
      if (s.type !== 'chord') continue
      for (const n of s.notes) {
        if (n.id === fromId) n.tiedTo = toId
        if (n.id === toId) n.tiedFrom = fromId
      }
    }
  }
}

describe('collectScheduledNotes', () => {
  it('schedules a single note at its absolute onset with a sensible duration', () => {
    const model = new ScoreModel('P') // one 4/4 bar, one staff
    model.addNote({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })

    const events = collectScheduledNotes(model.getScore())
    const c4 = events.filter(e => e.midi === C4)
    expect(c4).toHaveLength(1)
    expect(c4[0].startBeats).toBe(0)
    expect(c4[0].durationBeats).toBeCloseTo(1) // a quarter = 1 beat
    expect(c4[0].velocity).toBeGreaterThan(0)
  })

  it('skips rests (empty bars produce no sounding notes)', () => {
    const model = new ScoreModel('P') // one empty bar → all rests
    expect(collectScheduledNotes(model.getScore())).toHaveLength(0)
  })

  it('advances the onset by a full measure across bars (shared per-measure clock)', () => {
    const model = new ScoreModel('P')
    model.addMeasure() // bar 2
    model.addNote({ step: 'E', octave: 4, duration: 'q', measure: 2, beat: frac(0, 1) })

    const e4 = collectScheduledNotes(model.getScore()).filter(e => e.midi === E4)
    expect(e4).toHaveLength(1)
    expect(e4[0].startBeats).toBe(4) // bar 2 starts 4 beats in (4/4)
  })

  it('extends a same-pitch tie into one held note and suppresses the re-attack', () => {
    const model = new ScoreModel('P')
    model.addMeasure() // room for a cross-bar tie
    const a = model.addNote({ step: 'C', octave: 4, duration: 'h', measure: 1, beat: frac(2, 1) })
    const b = model.addNote({ step: 'C', octave: 4, duration: 'h', measure: 2, beat: frac(0, 1) })
    tie(model.getScore(), a.id, b.id)

    const c4 = collectScheduledNotes(model.getScore()).filter(e => e.midi === C4)
    expect(c4).toHaveLength(1)            // one attack, not two
    expect(c4[0].startBeats).toBe(2)      // at the head note
    expect(c4[0].durationBeats).toBeCloseTo(4) // two half notes held through
  })

  // ★ Multi-staff (Phase 5): both stacked staves schedule against the SAME shared clock.
  it('schedules every staff of a bar at the same shared onset', () => {
    const model = new ScoreModel('P')
    model.addNote({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: frac(0, 1), staff: 0 })
    model.addStaffBelow(0)
    model.addNote({ step: 'C', octave: 3, duration: 'q', measure: 1, beat: frac(0, 1), staff: 1 })

    const events = collectScheduledNotes(model.getScore())
    const at0 = events.filter(e => e.startBeats === 0).map(e => e.midi).sort((x, y) => x - y)
    // The top-staff C4 AND the bottom-staff C3 both sound at beat 0 — no per-staff drift.
    expect(at0).toEqual([C3, C4])
  })

  it('keeps staves parallel across a later measure (no per-staff accumulation)', () => {
    const model = new ScoreModel('P')
    model.addMeasure()                    // bar 2
    model.addStaffBelow(0)
    model.addNote({ step: 'C', octave: 4, duration: 'q', measure: 2, beat: frac(0, 1), staff: 0 })
    model.addNote({ step: 'C', octave: 3, duration: 'q', measure: 2, beat: frac(0, 1), staff: 1 })

    const events = collectScheduledNotes(model.getScore())
    // Both bar-2 notes land at 4 beats — staff 2 is NOT pushed after staff 1.
    expect(events.filter(e => e.midi === C4)[0].startBeats).toBe(4)
    expect(events.filter(e => e.midi === C3)[0].startBeats).toBe(4)
  })
})

describe('scoreTotalBeats', () => {
  it('sums per-measure capacity (shared spine, staff-agnostic)', () => {
    const model = new ScoreModel('P')
    model.addMeasure()
    model.addStaffBelow(0) // a 2nd staff must NOT change the total (bars are aligned)
    expect(scoreTotalBeats(model.getScore())).toBe(8) // two 4/4 bars
  })
})

/**
 * The beats→seconds recipe PlaybackEngine.play() runs: pure onsets from
 * collectScheduledNotes, converted through the tempo map (never through one scalar).
 * The engine itself needs an AudioContext, so what is asserted here is the math it does.
 */
describe('scheduling through the tempo map', () => {
  /** A one-bar score with a quarter on beat 0 and a half note on beat 1. */
  function scoreWithMarks(...marks: TempoMark[]): Score {
    const model = new ScoreModel('P')
    model.addNote({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    model.addNote({ step: 'E', octave: 4, duration: 'h', measure: 1, beat: frac(1, 1) })
    const score = model.getScore()
    if (marks.length) score.measures[0].tempos = marks
    return score
  }

  /** What play() does per event: onset + a duration measured as a DIFFERENCE of lookups. */
  function schedule(score: Score): Array<{ midi: number; start: number; duration: number }> {
    const map = buildTempoMap(score)
    return collectScheduledNotes(score).map(ev => ({
      midi: ev.midi,
      start: beatsToSeconds(map, ev.startBeats),
      duration: beatsToSeconds(map, ev.startBeats + ev.durationBeats) - beatsToSeconds(map, ev.startBeats),
    }))
  }

  it('plays a mark-free score at DEFAULT_TEMPO (120 qpm → a quarter is 0.5s)', () => {
    const [q] = schedule(scoreWithMarks())
    expect(q.start).toBe(0)
    expect(q.duration).toBeCloseTo(0.5, 10) // legato/staccato scaling aside, one beat = 0.5s
  })

  it('a ♩ = 60 mark halves the speed — every onset after it moves later', () => {
    const slow = schedule(scoreWithMarks({ id: 't', beat: frac(0, 1), bpm: 60 }))
    const [, half] = slow
    expect(half.start).toBe(1) // beat 1 at 60 qpm = 1s (it was 0.5s at 120)
  })

  it('a note STRADDLING a tempo change is measured by difference, not by one rate', () => {
    // 120 qpm from beat 0, then 60 qpm from beat 2. The half note starts at beat 1 and
    // runs to beat 3: 1 beat at 120 (0.5s) + 1 beat at 60 (1s) = 1.5s of sounding time.
    const score = scoreWithMarks(
      { id: 'a', beat: frac(0, 1), bpm: 120 },
      { id: 'b', beat: frac(2, 1), bpm: 60 },
    )
    const half = schedule(score).find(e => e.midi === E4)!
    expect(half.start).toBeCloseTo(0.5, 10)
    expect(half.duration).toBeCloseTo(1.5, 10)
    // What the old single-scalar code would have said (the whole note at the onset tempo):
    expect(half.duration).not.toBeCloseTo(1.0, 10)
  })

  it('totalSeconds lengthens when the score is told to go slower', () => {
    const fast = scoreWithMarks()
    const slow = scoreWithMarks({ id: 't', beat: frac(0, 1), bpm: 60 })
    const beats = scoreTotalBeats(fast)
    expect(totalSeconds(buildTempoMap(fast), beats)).toBe(2) // 4 beats @ 120 qpm
    expect(totalSeconds(buildTempoMap(slow), beats)).toBe(4) // 4 beats @ 60 qpm
  })
})
