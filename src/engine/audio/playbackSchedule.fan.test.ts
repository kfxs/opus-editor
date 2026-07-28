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
  /**
   * ⭐ A staccato on the OWNER shortens the owner and nobody else — the marks are per attack now
   * (`Attack`, docs/fanned-beam-pitches-plan.md §3), and the drawing has said so since it started
   * marking members individually. This asserted "every member" until then, which is the same claim
   * the engraving had already stopped making.
   */
  it('a staccato on the OWNER shortens the owner alone', () => {
    const model = new ScoreModel('P')
    const note = model.addNote({ step: 'C', octave: 4, duration: 'h', measure: 1, beat: frac(0, 1) })
    model.setFan(note.id, FAN)
    const plain = attacks(model.getScore())
    model.updateNote(note.id, { articulations: ['staccato'] })
    const staccato = attacks(model.getScore())

    expect(staccato).toHaveLength(plain.length)
    expect(staccato[0].durationBeats, 'member 0 IS the chord, so it takes the mark')
      .toBeLessThan(plain[0].durationBeats)
    for (let k = 1; k < plain.length; k++) {
      expect(staccato[k].durationBeats, `member ${k} was not marked`).toBeCloseTo(plain[k].durationBeats, 9)
    }
    // Whoever is marked, the onsets never move: the ramp is the rhythm and a mark is not.
    for (let k = 0; k < plain.length; k++) {
      expect(staccato[k].startBeats).toBeCloseTo(plain[k].startBeats, 9)
    }
  })

  /**
   * ⭐ The other half, and the one the engraving was waiting for: mark ONE member and only that
   * member is short. An accent on member 3 used to be drawn and not heard.
   */
  it('⭐ a staccato on ONE member shortens that member alone', () => {
    const model = new ScoreModel('P')
    const note = model.addNote({ step: 'C', octave: 4, duration: 'h', measure: 1, beat: frac(0, 1) })
    model.setFan(note.id, FAN)
    const plain = attacks(model.getScore())
    const slot = model.getScore().measures[0].slots.find(s => s.type === 'chord')!
    if (slot.type !== 'chord') throw new Error('expected a chord')
    model.updateNote(slot.fan!.members![1].pitches[0].id, { articulations: ['staccato'] })
    const marked = attacks(model.getScore())

    expect(marked).toHaveLength(plain.length)
    // members[1] is member 2 of the group — index 2 in the attack list.
    expect(marked[2].durationBeats, 'the marked member is short').toBeLessThan(plain[2].durationBeats)
    for (const k of [0, 1, 3, 4, 5].filter(i => i < plain.length)) {
      expect(marked[k].durationBeats, `member ${k} was not marked`).toBeCloseTo(plain[k].durationBeats, 9)
    }
  })

  it('⭐ an ACCENT on one member lifts that member’s velocity alone', () => {
    const model = new ScoreModel('P')
    const note = model.addNote({ step: 'C', octave: 4, duration: 'h', measure: 1, beat: frac(0, 1) })
    model.setFan(note.id, FAN)
    const plain = attacks(model.getScore())
    const slot = model.getScore().measures[0].slots.find(s => s.type === 'chord')!
    if (slot.type !== 'chord') throw new Error('expected a chord')
    model.updateNote(slot.fan!.members![2].pitches[0].id, { articulations: ['accent'] })
    const marked = attacks(model.getScore())

    expect(marked[3].velocity, 'the accented member is louder').toBeGreaterThan(plain[3].velocity)
    for (const k of [0, 1, 2, 4, 5].filter(i => i < plain.length)) {
      expect(marked[k].velocity, `member ${k} keeps the slot's dynamic`).toBeCloseTo(plain[k].velocity, 9)
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

/**
 * ⭐ P4 — EACH MEMBER SOUNDS ITS OWN PITCH (docs/fanned-beam-pitches-plan.md §2 P4).
 *
 * The expansion moved OUT of the per-pitch loop to do this. While every member shared the slot's
 * pitches, running the whole ramp once per chord tone was right; the moment they can differ it is
 * two rhythms laid over each other.
 */
describe('a fan sounds its members’ own pitches', () => {
  /** A fanned blanca whose members climb D4, E4, F4 — and the typed note stays C4. */
  function risingFan(count = 4) {
    const model = new ScoreModel('P')
    const note = model.addNote({ step: 'C', octave: 4, duration: 'h', measure: 1, beat: frac(0, 1) })
    model.setFan(note.id, { direction: 'accel', count, beams: 3 })
    const slot = model.getMeasure(1)!.slots.find(s => s.type === 'chord')!
    if (slot.type !== 'chord') throw new Error('expected a chord')
    const steps = ['D', 'E', 'F', 'G', 'A'] as const
    slot.fan!.members!.forEach((m, k) => { m.pitches[0].step = steps[k % steps.length] })
    return { model, slot, note }
  }

  it('⭐ one attack per member, each at its OWN midi, in order', () => {
    const { model } = risingFan(4)
    const events = collectScheduledNotes(model.getScore()).sort((a, b) => a.startBeats - b.startBeats)
    expect(events).toHaveLength(4)
    expect(events.map(e => e.midi)).toEqual([60, 62, 64, 65]) // C4 D4 E4 F4
  })

  it('⭐ and it is still ONE run of the ramp — not one per chord tone', () => {
    // The bug the restructure removes: with the expansion inside the per-pitch loop, a fanned CHORD
    // emitted the whole ramp once for every pitch of the slot.
    const { model, slot } = risingFan(3)
    model.addNote({ step: 'G', octave: 5, duration: 'h', measure: 1, beat: frac(0, 1) }) // slot chord tone
    expect(slot.notes).toHaveLength(2)
    const events = collectScheduledNotes(model.getScore())
    // Member 0 is the slot's chord (2 pitches); members 1 and 2 are one pitch each.
    expect(events).toHaveLength(4)
    const onsets = [...new Set(events.map(e => e.startBeats.toFixed(6)))]
    expect(onsets).toHaveLength(3) // three members ⇒ three onsets, whatever the chord holds
  })

  it('a member CHORD sounds all of its pitches at that member’s onset', () => {
    const { model, slot } = risingFan(3)
    slot.fan!.members![0].pitches.push({ id: 'x', step: 'B', alter: 0, octave: 4 })
    const events = collectScheduledNotes(model.getScore()).sort((a, b) => a.startBeats - b.startBeats)
    expect(events).toHaveLength(4)
    expect(events[1].startBeats).toBeCloseTo(events[2].startBeats, 9) // the member's two pitches
    expect([events[1].midi, events[2].midi].sort()).toEqual([62, 71]) // D4 + B4
  })

  it('⭐ the members still fill the note EXACTLY — pitches changed nothing about the clock', () => {
    const { model } = risingFan(5)
    const events = collectScheduledNotes(model.getScore()).sort((a, b) => a.startBeats - b.startBeats)
    const last = events[events.length - 1]
    expect(last.startBeats + last.durationBeats).toBeCloseTo(2, 9) // a blanca, to the last unit
    expect(events[0].startBeats).toBe(0)
  })

  /**
   * ⭐ The DYNAMIC is still the gesture's, and that is not the same oversight the articulation was:
   * a dynamic attaches to a POSITION in the bar, and every member of a fan sounds inside one
   * position. Only the articulation is per attack.
   */
  it('every member wears the SLOT’s dynamic — a dynamic marks a position, not an attack', () => {
    const { model, note } = risingFan(4)
    const plain = collectScheduledNotes(model.getScore())
    // Mark the OWNER: its own attack changes, and the others keep the dynamic untouched.
    model.updateNote(note.id, { articulations: ['staccato'] })
    const after = collectScheduledNotes(model.getScore()).sort((a, b) => a.startBeats - b.startBeats)
    expect(after).toHaveLength(plain.length)
    for (const e of after) expect(e.velocity).toBe(plain[0].velocity)
  })

  it('a mark with no stored members sounds at the slot’s pitch — as it draws', () => {
    const score = oneFannedNote()
    const slot = score.measures[0].slots.find(s => s.type === 'chord')!
    if (slot.type !== 'chord') throw new Error('expected a chord')
    delete slot.fan!.members
    const events = collectScheduledNotes(score)
    expect(events).toHaveLength(DEFAULT_FAN_COUNT)
    expect(new Set(events.map(e => e.midi))).toEqual(new Set([C4]))
  })
})
