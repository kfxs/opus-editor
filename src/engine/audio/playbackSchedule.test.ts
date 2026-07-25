import { describe, it, expect } from 'vitest'
import { ScoreModel } from '../models/ScoreModel'
import {
  collectScheduledNotes,
  scoreTotalBeats,
  UNMEASURED_THRESHOLD,
  PENDERECKI_ONSET_JITTER,
} from './playbackSchedule'
import { durationFlags } from '@/utils/durations'
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

/**
 * TREMOLO PLAYBACK (docs/tremolo-plan.md §5, P3) — one `ScheduledNote` becomes N.
 *
 * The whole of §5's reasoning is checkable here, because this collector is pure: no AudioContext, no
 * Tone, and the tempo map it needs is pure too. What the tests are really pinning is that the period
 * comes from the note as WRITTEN while the fill covers what SOUNDS — the single decision that makes
 * tuplets, dots and ties come out exact instead of needing an invented rounding rule.
 */
describe('collectScheduledNotes — tremolo', () => {
  /** Attacks of `midi`, in onset order. */
  const attacks = (score: Score, midi = C4) =>
    collectScheduledNotes(score).filter(e => e.midi === midi).sort((a, b) => a.startBeats - b.startBeats)

  /** The same, with an injected rng — for the one mark whose schedule is deliberately random. */
  const pendereckiAttacks = (score: Score, rng: () => number, midi = C4) =>
    collectScheduledNotes(score, buildTempoMap(score), rng)
      .filter(e => e.midi === midi).sort((a, b) => a.startBeats - b.startBeats)

  /** One note of `duration` at bar 1 beat 0 carrying `strokes`, in an `over/4` bar. */
  function oneTremoloNote(duration: 'w' | 'h' | 'q' | '8' | '16', strokes: 1 | 2 | 3 | 4 | 5, dots = 0) {
    const model = new ScoreModel('P')
    if (duration === 'w') model.setTimeSignature(1, { numerator: 4, denominator: 4 })
    const note = model.addNote({ step: 'C', octave: 4, duration, dots, measure: 1, beat: frac(0, 1) })
    model.setTremolo(note.id, strokes)
    return model.getScore()
  }

  describe('rule 1 — measured: beams of the repeat = the written flags + the strokes', () => {
    // §5's table, verbatim. A quarter and an eighth with one stroke BOTH give two attacks — but the
    // eighth's are twice as fast, because the same two attacks fill half the time.
    it.each([
      ['w' as const, 1 as const, 8, 0.5],
      ['h' as const, 1 as const, 4, 0.5],
      ['q' as const, 1 as const, 2, 0.5],
      ['8' as const, 1 as const, 2, 0.25],
      ['16' as const, 1 as const, 2, 0.125],
      ['q' as const, 2 as const, 4, 0.25],
      ['h' as const, 2 as const, 8, 0.25],
      ['q' as const, 3 as const, 8, 0.125],
    ])('%s + %i stroke(s) → %i attacks every %f beats', (duration, strokes, count, period) => {
      const got = attacks(oneTremoloNote(duration, strokes))
      expect(got).toHaveLength(count)
      got.forEach((e, i) => expect(e.startBeats).toBeCloseTo(i * period))
    })

    it('a dotted quarter with one stroke is exactly 3 eighths — no rounding rule needed', () => {
      const got = attacks(oneTremoloNote('q', 1, 1))
      expect(got).toHaveLength(3)
      expect(got.map(e => e.startBeats)).toEqual([0, 0.5, 1])
    })

    it('fills the note and no more — the last attack stops at the note end', () => {
      const got = attacks(oneTremoloNote('q', 1))
      const end = got[got.length - 1].startBeats + got[got.length - 1].durationBeats
      expect(end).toBeCloseTo(1) // a quarter, not 1.5
    })

    it('a TUPLET reads the sounding length: a triplet eighth + 1 stroke is 2 attacks in 1/3 beat', () => {
      const model = new ScoreModel('P')
      const note = model.addNote({ step: 'C', octave: 4, duration: '8', measure: 1, beat: frac(0, 1) })
      // Sounding 1/3 of a beat while WRITTEN as an eighth (1/2) — the tuplet ratio.
      const slot = model.getMeasure(1)!.slots.find(s => s.type === 'chord')!
      slot.actualDuration = frac(1, 3)
      model.setTremolo(note.id, 1)
      const got = attacks(model.getScore())
      expect(got).toHaveLength(2) // NOT 4/3 of an attack
      expect(got[1].startBeats).toBeCloseTo(1 / 6)
    })

    it('a TIED note keeps repeating across the tie at its own period', () => {
      const model = new ScoreModel('P')
      model.addMeasure()
      const a = model.addNote({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: frac(3, 1) })
      const b = model.addNote({ step: 'C', octave: 4, duration: 'q', measure: 2, beat: frac(0, 1) })
      model.setTremolo(a.id, 1)
      model.setTremolo(b.id, 1) // both halves carry it (§6) — the continuation must not re-attack twice
      tie(model.getScore(), a.id, b.id)
      const got = attacks(model.getScore())
      // Two beats of eighths, filled from the head: 3, 3.5, 4, 4.5 — and nothing extra from the tail.
      expect(got.map(e => e.startBeats)).toEqual([3, 3.5, 4, 4.5])
    })

    it('keeps the CLASSIC readings literal — 32nds, in tempo — which is why the threshold is 4', () => {
      // Three strokes on a quarter, two on an eighth, one on a sixteenth: the standard rule of thumb
      // says all three are 32nds, and at a threshold of 4 all three are still MEASURED, so they are
      // played as real 32nds rather than handed to the physical rate. At 3 they would not be.
      for (const [duration, strokes] of [['q', 3], ['8', 2], ['16', 1]] as const) {
        expect(durationFlags(duration) + strokes).toBe(3)
        expect(durationFlags(duration) + strokes).toBeLessThan(UNMEASURED_THRESHOLD)
      }
      // A 32nd is 0.125 beats, whatever note value it was written as.
      expect(attacks(oneTremoloNote('q', 3))[1].startBeats).toBeCloseTo(0.125)
      expect(attacks(oneTremoloNote('8', 2))[1].startBeats).toBeCloseTo(0.125)
      expect(attacks(oneTremoloNote('16', 1))[1].startBeats).toBeCloseTo(0.125)
    })

    it('leaves a note with no tremolo as exactly one attack', () => {
      const model = new ScoreModel('P')
      model.addNote({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
      expect(attacks(model.getScore())).toHaveLength(1)
    })

    it('repeats every pitch of a CHORD together — the mark is on the event', () => {
      const model = new ScoreModel('P')
      const c = model.addNote({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
      model.addNote({ step: 'E', octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
      model.setTremolo(c.id, 1)
      expect(attacks(model.getScore(), C4).map(e => e.startBeats)).toEqual([0, 0.5])
      expect(attacks(model.getScore(), E4).map(e => e.startBeats)).toEqual([0, 0.5])
    })
  })

  describe('rule 2 — unmeasured: a PHYSICAL period that ignores the tempo', () => {
    /** A half note carrying `strokes`, at `qpm`. */
    function atTempo(strokes: 1 | 2 | 3 | 4 | 5 | 'penderecki', qpm: number): Score {
      const model = new ScoreModel('P')
      const note = model.addNote({ step: 'C', octave: 4, duration: 'h', measure: 1, beat: frac(0, 1) })
      model.setTremolo(note.id, strokes)
      const mark: TempoMark = { id: 't', beat: frac(0, 1), text: `${qpm}`, unit: 'q', bpm: qpm }
      model.getMeasure(1)!.tempos = [mark]
      return model.getScore()
    }

    it('crosses the threshold at TOTAL BEAMS, so the same stroke count differs by note value', () => {
      // A half note carries 0 flags, so its stroke count IS its total beams: 3 stays measured, 4 does
      // not. An eighth carries 1, so THREE strokes already reach 4 — same mark, different reading.
      expect(durationFlags('h') + 3).toBeLessThan(UNMEASURED_THRESHOLD)
      expect(durationFlags('h') + 4).toBeGreaterThanOrEqual(UNMEASURED_THRESHOLD)
      expect(durationFlags('8') + 3).toBeGreaterThanOrEqual(UNMEASURED_THRESHOLD)

      expect(attacks(oneTremoloNote('h', 3))).toHaveLength(16) // measured: 32nds across 2 beats
      // Measured 64ths would be 32 attacks; the physical 0.05s rate over 1s gives 20.
      expect(attacks(oneTremoloNote('h', 4))).toHaveLength(20)
    })

    it('is FASTER than the fastest measured reading — an extra stroke must never slow the note down', () => {
      // The constraint that ties the two constants together: at 120 qpm a measured 32nd (3 beams) is
      // 16 attacks/sec, so the physical rate has to beat that, or 3 strokes → 4 would decelerate.
      const measured = attacks(oneTremoloNote('h', 3)).length   // 3 beams, in tempo
      const unmeasured = attacks(oneTremoloNote('h', 4)).length  // 4 beams, physical
      expect(unmeasured).toBeGreaterThan(measured)
    })

    it('keeps the REAL-WORLD rate when the tempo halves — the count doubles', () => {
      const fast = attacks(atTempo(4, 120))
      const slow = attacks(atTempo(4, 60))
      // A half note is 1s at 120qpm and 2s at 60qpm; at a fixed 0.05s period that is 20 then 40.
      expect(fast).toHaveLength(20)
      expect(slow).toHaveLength(40)
    })

    it('a MEASURED tremolo does the opposite — same count at any tempo, because it is in beats', () => {
      expect(attacks(atTempo(1, 120))).toHaveLength(4)
      expect(attacks(atTempo(1, 60))).toHaveLength(4)
    })

    it('plays the Penderecki mark at the unmeasured rate', () => {
      // A neutral roll (0.5 → zero spread) is the unjittered baseline: the same 20 as 4 strokes.
      expect(pendereckiAttacks(atTempo('penderecki', 120), () => 0.5)).toHaveLength(20)
    })
  })

  /**
   * RULE 3 — Penderecki: rule 2's speed, plus the thing that makes it Penderecki. Both readings are
   * "as fast as possible"; only this one says the speed itself VARIES, so rule 2 must stay strictly
   * even and the jitter is what separates them.
   *
   * The randomness is INJECTED, which is the only reason any of this is testable: a bare
   * `Math.random()` inside a pure collector would give a green suite that proves nothing about what
   * you hear.
   */
  describe('rule 3 — Penderecki: irregular, and deterministic under a seeded rng', () => {
    /**
     * A deterministic stand-in for `Math.random`, cycling a fixed sequence — for pinning the
     * EXTREMES (all 0 = every gap as short as allowed, all 1 = as long).
     *
     * ⚠️ Not for "is it uneven?": each attack draws TWICE (spacing, then velocity), so a cycle of
     * even length hands every *step* the same value and the schedule comes out perfectly regular —
     * which looked like the jitter being broken when it was the stub aliasing against the draw order.
     */
    const seeded = (...values: number[]) => {
      let i = 0
      return () => values[i++ % values.length]
    }

    /** A tiny LCG: varied values, no aliasing, and identical for identical seeds. */
    const lcg = (seed = 1) => () => {
      seed = (seed * 1103515245 + 12345) % 2147483648
      return seed / 2147483648
    }

    /** Four strokes on the same note — unmeasured, but NOT Penderecki. */
    const fourStrokeScore = (qpm = 120): Score => {
      const model = new ScoreModel('P')
      const note = model.addNote({ step: 'C', octave: 4, duration: 'h', measure: 1, beat: frac(0, 1) })
      model.setTremolo(note.id, 4)
      model.getMeasure(1)!.tempos = [{ id: 't', beat: frac(0, 1), text: `${qpm}`, unit: 'q', bpm: qpm }]
      return model.getScore()
    }

    const pendereckiScore = (qpm = 120): Score => {
      const model = new ScoreModel('P')
      const note = model.addNote({ step: 'C', octave: 4, duration: 'h', measure: 1, beat: frac(0, 1) })
      model.setTremolo(note.id, 'penderecki')
      model.getMeasure(1)!.tempos = [{ id: 't', beat: frac(0, 1), text: `${qpm}`, unit: 'q', bpm: qpm }]
      return model.getScore()
    }

    it('spaces the attacks UNEVENLY — the gaps differ, which rule 2 never does', () => {
      // Alternating extremes: every other gap is short, then long.
      const got = pendereckiAttacks(pendereckiScore(), lcg(7))
      const gaps = got.slice(1).map((e, i) => e.startBeats - got[i].startBeats)
      const unique = new Set(gaps.map(g => g.toFixed(6)))
      expect(unique.size).toBeGreaterThan(1)
    })

    it('keeps every gap within ±PENDERECKI_ONSET_JITTER of the period', () => {
      const got = pendereckiAttacks(pendereckiScore(), lcg(3))
      const gaps = got.slice(1, -1).map((e, i) => e.startBeats - got[i].startBeats)
      // At 120 qpm the physical period is 0.05 s = 0.1 beats.
      const period = 0.1
      for (const gap of gaps) {
        expect(gap).toBeGreaterThanOrEqual(period * (1 - PENDERECKI_ONSET_JITTER) - 1e-9)
        expect(gap).toBeLessThanOrEqual(period * (1 + PENDERECKI_ONSET_JITTER) + 1e-9)
      }
    })

    it('never runs past the end of the note, however the jitter falls', () => {
      for (const rng of [seeded(0), seeded(1), seeded(0.5), lcg(1), lcg(99)]) {
        const got = pendereckiAttacks(pendereckiScore(), rng)
        const last = got[got.length - 1]
        expect(last.startBeats + last.durationBeats).toBeLessThanOrEqual(2 + 1e-9) // a half note
      }
    })

    it('varies the VELOCITY too — an even attack at a wobbling rate still reads as a machine', () => {
      const got = pendereckiAttacks(pendereckiScore(), lcg(11))
      expect(new Set(got.map(e => e.velocity.toFixed(6))).size).toBeGreaterThan(1)
    })

    it('keeps velocity a normalized 0–1 even at the loudest roll', () => {
      const got = pendereckiAttacks(pendereckiScore(), seeded(1))
      for (const e of got) {
        expect(e.velocity).toBeLessThanOrEqual(1)
        expect(e.velocity).toBeGreaterThan(0)
      }
    })

    it('is REPRODUCIBLE under the same seed — the purity the tests depend on', () => {
      const a = pendereckiAttacks(pendereckiScore(), lcg(42))
      const b = pendereckiAttacks(pendereckiScore(), lcg(42))
      expect(a.map(e => e.startBeats)).toEqual(b.map(e => e.startBeats))
    })

    it('⚠️ leaves rule 2 STRICTLY EVEN — the jitter belongs to this mark alone', () => {
      // The same wild rng, on 4 strokes (unmeasured, not Penderecki): identical gaps throughout.
      const score = fourStrokeScore()
      const got = collectScheduledNotes(score, buildTempoMap(score), lcg(5))
        .filter(e => e.midi === C4).sort((a, b) => a.startBeats - b.startBeats)
      const gaps = got.slice(1).map((e, i) => e.startBeats - got[i].startBeats)
      expect(new Set(gaps.map(g => g.toFixed(6))).size).toBe(1)
      expect(new Set(got.map(e => e.velocity.toFixed(6))).size).toBe(1)
    })

    it('re-rolls per playback: two passes with the real rng are not identical', () => {
      const score = pendereckiScore()
      const onsets = () => collectScheduledNotes(score).filter(e => e.midi === C4).map(e => e.startBeats)
      // ~20 continuous draws — two runs matching exactly is not a thing that happens.
      expect(onsets()).not.toEqual(onsets())
    })
  })
})
