import { describe, it, expect } from 'vitest'
import { ScoreModel } from '../models/ScoreModel'
import { collectScheduledNotes } from './playbackSchedule'
import { TRILL_PERIOD_SECONDS } from './trillAttacks'
import { fracCreate as frac } from '@/utils/fraction'
import type { FanMark, Score } from '@/types/music'

/**
 * ⭐⭐ **A TRILL SOUNDS** (docs/trill-plan.md §7, P5) — one note becomes an alternation with the note
 * above, at a physical speed, over whatever the note actually sounds for.
 *
 * The arithmetic of the alternation is `trillAttacks.test.ts`'s. What is asked here is everything
 * the COLLECTOR decides: which slots trill, what each pitch alternates WITH (the auxiliary is
 * per-pitch, resolved against the key and the bar), how far it runs (through ties), and what happens
 * when a note carries a trill AND another re-attack pattern.
 */
const A3 = 57, B3 = 59, C4 = 60, D4 = 62, E4 = 64, F4 = 65, FS4 = 66

/** Every attack, in onset order. */
const played = (score: Score) =>
  collectScheduledNotes(score).sort((a, b) => a.startBeats - b.startBeats)

/** The distinct midis sounded, in first-onset order. */
const midis = (score: Score) => [...new Set(played(score).map(e => e.midi))]

/** One whole note at bar 1 beat 0, trilled. */
function oneTrilledNote(step: 'C' | 'E' = 'C', duration: 'w' | 'h' | 'q' = 'w') {
  const model = new ScoreModel('P')
  const note = model.addNote({ step, alter: 0, octave: 4, duration, measure: 1, beat: frac(0, 1) })
  model.addTrill({ startNoteId: note.id })
  return { model, score: model.getScore(), noteId: note.id }
}

describe('a trill turns one note into an alternation', () => {
  it('sounds many attacks instead of one', () => {
    const { score } = oneTrilledNote()
    expect(played(score).length).toBeGreaterThan(4)
  })

  it('⭐ alternates with the note ABOVE — C4 trills with D4', () => {
    expect(midis(oneTrilledNote('C').score)).toEqual([C4, D4])
  })

  it('⭐ …and the interval is the SCALE\'s, not a constant: E4 trills with F4, a semitone', () => {
    // The whole point of deriving the auxiliary. A stored interval would make both a whole tone.
    expect(midis(oneTrilledNote('E').score)).toEqual([E4, F4])
  })

  it('⭐⭐ an accidental earlier in the BAR moves what sounds — E trills with F♯ after an F♯', () => {
    const model = new ScoreModel('P')
    model.addNote({ step: 'F', alter: 1, octave: 4, duration: 'h', measure: 1, beat: frac(0, 1) })
    const e = model.addNote({ step: 'E', alter: 0, octave: 4, duration: 'h', measure: 1, beat: frac(2, 1) })
    model.addTrill({ startNoteId: e.id })

    // ⚠️ Assert over the TRILL'S OWN span (from beat 2), not the whole bar: the F♯ at beat 0 is a
    // real note, and `midis` de-duplicates, so a whole-bar assertion cannot tell the auxiliary from
    // the note that caused it.
    const inTrill = new Set(played(model.getScore()).filter(e2 => e2.startBeats >= 2).map(e2 => e2.midi))
    expect(inTrill).toEqual(new Set([E4, FS4]))
    expect(inTrill.has(F4), 'F natural must NOT sound — the bar\'s F♯ is in force').toBe(false)
  })

  it('starts on the MAIN note (the modern default), not the auxiliary', () => {
    expect(played(oneTrilledNote('C').score)[0].midi).toBe(C4)
  })

  it('fills the note EXACTLY — a trill never overhangs, so the clock does not move', () => {
    const { score } = oneTrilledNote('C', 'w')
    const events = played(score); const last = events[events.length - 1]
    expect(last.startBeats + last.durationBeats).toBeCloseTo(4, 6)
  })

  it('⭐ the RATE is physical: a whole note gets ~4× the attacks of a crotchet', () => {
    const whole = played(oneTrilledNote('C', 'w').score).length
    const quarter = played(oneTrilledNote('C', 'q').score).length
    expect(whole / quarter).toBeGreaterThan(3)
    expect(whole / quarter).toBeLessThan(5)
    // …and the count matches the constant at the default tempo, give or take the final clamp.
    expect(quarter).toBeGreaterThan(1 / TRILL_PERIOD_SECONDS * 0.3)
  })
})

describe('how far a trill runs', () => {
  it('⭐⭐ keeps going THROUGH A TIE — the one-note trill needs no end anchor', () => {
    const model = new ScoreModel('P')
    model.addMeasure()
    const a = model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'w', measure: 1, beat: frac(0, 1) })
    const b = model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'w', measure: 2, beat: frac(0, 1) })
    model.updateNote(a.id, { tiedTo: b.id })
    model.updateNote(b.id, { tiedFrom: a.id })
    model.addTrill({ startNoteId: a.id })

    const events = played(model.getScore())
    const last = events[events.length - 1]
    // Both bars' worth: the tie-extended span, not one bar's.
    expect(last.startBeats + last.durationBeats).toBeCloseTo(8, 6)
    // …and it is still an alternation the whole way, not a trill then a held note.
    expect(events.filter(e => e.midi === D4).length).toBeGreaterThan(10)
  })

  it('covers every note of a SPAN, each with its own auxiliary', () => {
    const model = new ScoreModel('P')
    const notes = (['C', 'D', 'E'] as const).map((step, i) =>
      model.addNote({ step, alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(i, 1) }))
    model.addTrill({ startNoteId: notes[0].id, endNoteId: notes[2].id })

    const sounded = new Set(played(model.getScore()).map(e => e.midi))
    // C↔D, D↔E, E↔F — so D and E appear as both main and auxiliary, and F only as one.
    expect(sounded).toEqual(new Set([C4, D4, E4, F4]))
  })

  it('an UNTRILLED note nearby is untouched — one attack, its own length', () => {
    const model = new ScoreModel('P')
    const a = model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'h', measure: 1, beat: frac(0, 1) })
    model.addNote({ step: 'A', alter: 0, octave: 3, duration: 'h', measure: 1, beat: frac(2, 1) })
    model.addTrill({ startNoteId: a.id })

    const plain = played(model.getScore()).filter(e => e.midi === A3)
    expect(plain).toHaveLength(1)
    expect(plain[0].durationBeats).toBeCloseTo(2, 6)
  })

  it('a score with no trills sounds exactly as it did', () => {
    const model = new ScoreModel('P')
    model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'w', measure: 1, beat: frac(0, 1) })
    expect(played(model.getScore())).toHaveLength(1)
  })
})

describe('⭐ precedence — one re-attack pattern per note', () => {
  it('a TREMOLO wins: the note trills nothing, it tremolos', () => {
    const model = new ScoreModel('P')
    const note = model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'w', measure: 1, beat: frac(0, 1) })
    model.setTremolo(note.id, 3)
    model.addTrill({ startNoteId: note.id })
    // Tremolo = repeated notes at ONE pitch; a trill would have introduced D4.
    expect(midis(model.getScore())).toEqual([C4])
    expect(played(model.getScore()).length).toBeGreaterThan(1)
  })

  it('a FAN wins too — it branches on the slot, before the pitch loop is even reached', () => {
    const model = new ScoreModel('P')
    const note = model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'h', measure: 1, beat: frac(0, 1) })
    const fan: FanMark = { direction: 'accel', count: 4, beams: 2 }
    model.setFan(note.id, fan)
    model.addTrill({ startNoteId: note.id })
    expect(midis(model.getScore())).toEqual([C4])
  })

  it('…and removing the tremolo lets the trill sound', () => {
    const model = new ScoreModel('P')
    const note = model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'w', measure: 1, beat: frac(0, 1) })
    model.setTremolo(note.id, 3)
    model.addTrill({ startNoteId: note.id })
    model.setTremolo(note.id, null)
    expect(midis(model.getScore())).toEqual([C4, D4])
  })
})

describe('a trill that no longer resolves', () => {
  it('sounds as nothing — a dangling trill is silent, as it is invisible', () => {
    const model = new ScoreModel('P')
    const note = model.addNote({ step: 'B', alter: 0, octave: 3, duration: 'w', measure: 1, beat: frac(0, 1) })
    model.addTrill({ startNoteId: note.id })
    // Point it at an id nothing holds — what a re-bar would leave if the repair had not run.
    model.getScore().trills![0].startNoteId = 'gone'
    const events = played(model.getScore())
    expect(events).toHaveLength(1)
    expect(events[0].midi).toBe(B3)
  })
})
