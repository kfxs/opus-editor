import { describe, it, expect } from 'vitest'
import { ScoreModel } from '../models/ScoreModel'
import { collectScheduledNotes } from './playbackSchedule'
import { fanMembers, DEFAULT_FAN_COUNT, DEFAULT_FAN_BEAMS } from '@/utils/fannedBeam'
import { fracCreate as frac, fracToNumber } from '@/utils/fraction'
import type { Score, FanMark } from '@/types/music'

/**
 * A FAN SOUNDS (docs/fanned-beams-plan.md §3, P3) — `count` attacks that speed up or slow down
 * across exactly the note's own duration.
 *
 * The one thing that must never break: **the group's total time is unchanged.** A fan is free
 * accelerando *within* the duration, so nothing after it may move — which is also what makes it not
 * a tempo change.
 */
const C4 = 60, E4 = 64

const FAN: FanMark = { direction: 'accel', count: DEFAULT_FAN_COUNT, beams: DEFAULT_FAN_BEAMS }

/** Attacks of `midi`, in onset order. */
const attacks = (score: Score, midi = C4) =>
  collectScheduledNotes(score).filter(e => e.midi === midi).sort((a, b) => a.startBeats - b.startBeats)

/** One fanned note of `duration` at bar 1 beat 0. */
function oneFannedNote(duration: 'w' | 'h' | 'q' = 'h', fan: FanMark = FAN) {
  const model = new ScoreModel('P')
  const note = model.addNote({ step: 'C', octave: 4, duration, measure: 1, beat: frac(0, 1) })
  model.setFan(note.id, fan)
  return model.getScore()
}

describe('a fan turns one note into its members', () => {
  it('sounds `count` attacks instead of one', () => {
    expect(attacks(oneFannedNote())).toHaveLength(DEFAULT_FAN_COUNT)
  })

  it('⭐ they fill the note EXACTLY — the clock never moves', () => {
    for (const direction of ['accel', 'rit'] as const) {
      for (const count of [2, 6, 12]) {
        for (const beams of [1, 3, 4]) {
          const events = attacks(oneFannedNote('h', { direction, count, beams }))
          expect(events[0].startBeats).toBe(0)
          const last = events[events.length - 1]
          expect(last.startBeats + last.durationBeats, `${direction} ${count}×${beams}`).toBeCloseTo(2, 9)
        }
      }
    }
  })

  it('leaves the notes after it exactly where they were', () => {
    const model = new ScoreModel('P')
    const first = model.addNote({ step: 'C', octave: 4, duration: 'h', measure: 1, beat: frac(0, 1) })
    model.addNote({ step: 'E', octave: 4, duration: 'h', measure: 1, beat: frac(2, 1) })
    const before = attacks(model.getScore(), E4)[0].startBeats
    model.setFan(first.id, FAN)
    expect(attacks(model.getScore(), E4)[0].startBeats).toBe(before)
  })

  it('accelerates — each attack is shorter than the last, and `rit` is the mirror', () => {
    const accel = attacks(oneFannedNote('h', { ...FAN, direction: 'accel' }))
    for (let k = 1; k < accel.length; k++) {
      expect(accel[k].durationBeats).toBeLessThan(accel[k - 1].durationBeats)
    }
    const rit = attacks(oneFannedNote('h', { ...FAN, direction: 'rit' }))
    for (let k = 1; k < rit.length; k++) {
      expect(rit[k].durationBeats).toBeGreaterThan(rit[k - 1].durationBeats)
    }
  })

  it('⭐ lands each attack where the DRAWING puts its notehead — one expander, two readers', () => {
    // The reason `fanMembers` is a pure function: a head 40% along the group is a note at 40% of its
    // time by construction, not because two implementations agree.
    const events = attacks(oneFannedNote())
    const members = fanMembers(FAN, frac(2, 1))
    events.forEach((event, k) => {
      expect(event.startBeats).toBeCloseTo(members[k].startFraction * 2, 9)
      expect(event.durationBeats).toBeCloseTo(fracToNumber(members[k].quarters), 9)
    })
  })

  it('every attack keeps the note\'s own pitch and velocity', () => {
    const events = attacks(oneFannedNote())
    for (const event of events) {
      expect(event.midi).toBe(C4)
      expect(event.velocity).toBe(events[0].velocity)
    }
  })

  it('scales to the note it is on — a redonda fans over four beats, a negra over one', () => {
    const whole = attacks(oneFannedNote('w'))
    const quarter = attacks(oneFannedNote('q'))
    expect(whole[0].durationBeats).toBeCloseTo(quarter[0].durationBeats * 4, 9)
  })

  it('a fanned CHORD sounds every pitch', () => {
    const model = new ScoreModel('P')
    const c = model.addNote({ step: 'C', octave: 4, duration: 'h', measure: 1, beat: frac(0, 1) })
    model.addNote({ step: 'E', octave: 4, duration: 'h', measure: 1, beat: frac(0, 1) }) // same slot
    model.setFan(c.id, FAN)
    expect(attacks(model.getScore(), C4)).toHaveLength(DEFAULT_FAN_COUNT)
    expect(attacks(model.getScore(), E4)).toHaveLength(DEFAULT_FAN_COUNT)
  })

  it('a count of 1 is just the note — no expansion, no change to the sound', () => {
    const events = attacks(oneFannedNote('h', { ...FAN, count: 1 }))
    expect(events).toHaveLength(1)
    expect(events[0].durationBeats).toBeCloseTo(2, 9)
  })

  it('removing the fan puts the single attack back', () => {
    const model = new ScoreModel('P')
    const note = model.addNote({ step: 'C', octave: 4, duration: 'h', measure: 1, beat: frac(0, 1) })
    model.setFan(note.id, FAN)
    model.setFan(note.id, null)
    expect(attacks(model.getScore())).toHaveLength(1)
  })
})

describe('the fan and the other expansions', () => {
  it('a staccato fan is staccato — the articulation shortens every member', () => {
    const model = new ScoreModel('P')
    const note = model.addNote({ step: 'C', octave: 4, duration: 'h', measure: 1, beat: frac(0, 1) })
    model.setFan(note.id, FAN)
    const plain = attacks(model.getScore())
    model.updateNote(note.id, { articulations: ['staccato'] })
    const staccato = attacks(model.getScore())
    expect(staccato).toHaveLength(plain.length)
    for (let k = 0; k < plain.length; k++) {
      expect(staccato[k].durationBeats).toBeLessThan(plain[k].durationBeats)
      expect(staccato[k].startBeats).toBeCloseTo(plain[k].startBeats, 9) // the onsets do NOT move
    }
  })

  it('an ill-formed slot carrying BOTH a fan and a tremolo plays the FAN, predictably', () => {
    // The model refuses to make one (`setFan` clears the tremolo), but imported JSON is reported and
    // never repaired — so the winner is a decision, not an accident.
    const score = oneFannedNote()
    const slot = score.measures[0].slots.find(s => s.type === 'chord')!
    if (slot.type === 'chord') slot.tremolo = 3
    expect(attacks(score)).toHaveLength(DEFAULT_FAN_COUNT)
  })
})
