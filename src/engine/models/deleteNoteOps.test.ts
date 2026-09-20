/**
 * DELETING ONE NOTE — {@link deleteNoteWithRepair}, the repair each kind of delete owes the bar,
 * and {@link chordNotesAt}, the staff-scoped "is this a chord?" it stands on. Through a real
 * `ScoreModel`, which is what answers `DeleteNoteModel`; the undo entry is the facade's and is not
 * asked here.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import type { Chord, FanMark } from '@/types/music'
import { fracCreate as frac, fracToNumber } from '@/utils/fraction'
import { ScoreModel } from './ScoreModel'
import { chordNotesAt, deleteNoteWithRepair } from './deleteNoteOps'

const C4 = { step: 'C', alter: 0, octave: 4 } as const

describe('deleteNoteWithRepair', () => {
  let model: ScoreModel

  beforeEach(() => {
    model = new ScoreModel() // measure 1, 4/4
  })

  const slots = () => model.getScore().measures[0].slots

  it('false — and nothing written — for an id that is gone', () => {
    const before = JSON.stringify(model.getScore())
    expect(deleteNoteWithRepair(model, 'gone')).toBe(false)
    expect(JSON.stringify(model.getScore())).toBe(before)
  })

  describe('a SINGLE note becomes a rest of its own length', () => {
    it('same duration and dots, at the same beat', () => {
      const note = model.addNote({ ...C4, duration: 'q', dots: 1, measure: 1, beat: frac(0, 1) })
      expect(deleteNoteWithRepair(model, note.id)).toBe(true)
      const rest = slots().find(s => fracToNumber(s.beat) === 0)!
      expect(rest.type).toBe('rest')
      expect(rest.duration).toBe('q')
      expect(rest.dots).toBe(1)
    })

    it('deleting one staff\'s note replaces it with a rest and leaves the other staff untouched', () => {
      // `chordNotesAt` matches on (measure, beat, voice); without staff scoping the same-beat/
      // same-voice note on the OTHER staff makes this read as a chord, so the note is removed
      // without a replacement rest and the surviving-sibling slur re-anchor grabs the wrong staff.
      model.addStaffBelow(0)
      const top = model.addNote({ step: 'C', alter: 0, octave: 5, duration: 'q', measure: 1, beat: frac(0, 1), staff: 0 })
      const bottom = model.addNote({ step: 'C', alter: 0, octave: 3, duration: 'q', measure: 1, beat: frac(0, 1), staff: 1 })

      expect(deleteNoteWithRepair(model, top.id)).toBe(true)
      const staff1Id = model.getScore().staves![1].id
      const topSlotAtZero = slots().find(s => s.staffId !== staff1Id && fracToNumber(s.beat) === 0)!
      expect(topSlotAtZero.type).toBe('rest')
      expect(topSlotAtZero.duration).toBe('q')
      expect(model.getNote(bottom.id)!.isRest).toBeFalsy()
    })

    it('replaces a LOWER staff\'s note with a rest on THAT staff, in its own voice', () => {
      // ⭐ The mirror of the case above, and the one that was missing: deleting the TOP note passes
      // whether or not the staff travels, because `addNote` defaults an absent staff to 0. His report
      // (2026-08-31, bar 1 of the Prelude): clearing the bass staff's voice-1 half note put a half
      // REST into a voice 1 the treble staff never had — a phantom voice on the wrong staff.
      // TWO half notes in that voice, the file's own shape — deleting the only note of a secondary
      // voice collapses the lane (Sibelius-style), which is a different rule and would hide this one.
      model.addStaffBelow(0)
      model.addNote({ ...C4, duration: 'h', measure: 1, beat: frac(0, 1), staff: 1, voice: 1 })
      const second = model.addNote({ ...C4, duration: 'h', measure: 1, beat: frac(2, 1), staff: 1, voice: 1 })

      expect(deleteNoteWithRepair(model, second.id)).toBe(true)

      const staff1Id = model.getScore().staves![1].id
      const atTwo = slots().filter(s => fracToNumber(s.beat) === 2)
      const replacement = atTwo.find(s => s.type === 'rest' && s.duration === 'h')!
      expect(replacement).toBeTruthy()
      expect(replacement.staffId).toBe(staff1Id)
      expect(replacement.voice).toBe(1)
      // ⛔ And nothing landed in a voice 1 on the TOP staff, which is what the bug looked like.
      expect(atTwo.some(s => s.staffId !== staff1Id && s.voice === 1)).toBe(false)
    })

    it('⭐ EVERY tie that targeted it re-points onto the replacement rest — none is dropped', () => {
      // The reported bug: a chord C4+C5 tied forward to a lone C4 (C5 let-ring).
      const c4 = model.addNote({ ...C4, duration: 'q', measure: 1, beat: frac(0, 1) })
      const c5 = model.addNote({ step: 'C', alter: 0, octave: 5, duration: 'q', measure: 1, beat: frac(0, 1) })
      const target = model.addNote({ ...C4, duration: 'q', measure: 1, beat: frac(1, 1) })
      model.updateNote(c4.id, { tiedTo: target.id })
      model.updateNote(c5.id, { tiedTo: target.id })

      deleteNoteWithRepair(model, target.id)

      const rest = slots().find(s => s.type === 'rest' && fracToNumber(s.beat) === 1)!
      expect(model.getNote(c4.id)!.tiedTo).toBe(rest.id)
      expect(model.getNote(c5.id)!.tiedTo).toBe(rest.id)
    })

    it('a slur anchored to it follows onto the rest, which has a NEW id', () => {
      const a = model.addNote({ ...C4, duration: 'q', measure: 1, beat: frac(0, 1) })
      const b = model.addNote({ step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
      model.addSlur({ startNoteId: a.id, endNoteId: b.id })

      deleteNoteWithRepair(model, b.id)

      const slurs = model.getSlurs()
      expect(slurs).toHaveLength(1)
      expect(slurs[0].endNoteId).not.toBe(b.id)
      expect(model.getNote(slurs[0].endNoteId)?.isRest).toBe(true)
    })
  })

  describe('a CHORD HEAD leaves the chord standing', () => {
    it('no rest is minted, and its slur moves to a surviving sibling', () => {
      const a = model.addNote({ ...C4, duration: 'q', measure: 1, beat: frac(0, 1) })
      const sib = model.addNote({ step: 'G', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
      const b = model.addNote({ step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
      model.addSlur({ startNoteId: a.id, endNoteId: b.id })

      expect(deleteNoteWithRepair(model, a.id)).toBe(true)

      const atZero = slots().filter(s => fracToNumber(s.beat) === 0)
      expect(atZero.map(s => s.type)).toEqual(['chord'])
      expect(model.getSlurs()[0]).toMatchObject({ startNoteId: sib.id, endNoteId: b.id })
    })
  })

  describe('a REST leaves a hole', () => {
    it('the bar is still full afterwards, and a slur anchored to the rest is dropped', () => {
      const a = model.addNote({ ...C4, duration: 'q', measure: 1, beat: frac(0, 1) })
      const rest = model.addNote({ duration: 'q', measure: 1, beat: frac(1, 1), isRest: true })
      model.addSlur({ startNoteId: a.id, endNoteId: rest.id })

      expect(deleteNoteWithRepair(model, rest.id)).toBe(true)

      expect(model.getSlurs()).toHaveLength(0)
      // Whatever rests the meter chose, beat 1 is covered again.
      expect(slots().some(s => s.type === 'rest' && fracToNumber(s.beat) === 1)).toBe(true)
    })
  })

  describe('voices', () => {
    it('deleting the last note of voice 2 collapses the bar back to a single voice', () => {
      model.addNote({ ...C4, duration: 'w', measure: 1, beat: frac(0, 1) })
      const v2 = model.addNote({ step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1), voice: 1 })

      deleteNoteWithRepair(model, v2.id)

      expect(slots().filter(s => (s.voice ?? 0) === 1)).toHaveLength(0) // no leftover voice-2 rests
      expect(slots().some(s => s.type === 'chord' && (s.voice ?? 0) === 0)).toBe(true)
    })

    it('deleting one of several voice-2 notes keeps voice 2 (rest replacement, no collapse)', () => {
      const a = model.addNote({ ...C4, duration: 'q', measure: 1, beat: frac(0, 1), voice: 1 })
      model.addNote({ step: 'D', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1), voice: 1 })

      deleteNoteWithRepair(model, a.id)

      expect(slots().filter(s => s.type === 'chord' && (s.voice ?? 0) === 1)).toHaveLength(1)
      expect(slots().some(s => s.type === 'rest' && (s.voice ?? 0) === 1 && fracToNumber(s.beat) === 0)).toBe(true)
    })
  })

  describe('a FANNED MEMBER deletes as a member', () => {
    const FAN: FanMark = { direction: 'accel', count: 4, beams: 3 }
    let memberId: string

    const chord = (): Chord => {
      const slot = slots().find(s => s.type === 'chord')!
      if (slot.type !== 'chord') throw new Error('expected a chord')
      return slot
    }

    beforeEach(() => {
      const owner = model.addNote({ ...C4, duration: 'h', measure: 1, beat: frac(0, 1) })
      model.setFan(owner.id, FAN)
      memberId = chord().fan!.members![0].pitches[0].id
    })

    it('⚠️ the BAR is left alone — no rest lands on an event that is still there', () => {
      // The trap: a member reports the SLOT's beat, so the "single note becomes a rest" branch
      // would answer for the owner's one-note chord.
      const before = slots().length
      expect(deleteNoteWithRepair(model, memberId)).toBe(true)
      expect(slots()).toHaveLength(before)
      expect(chord().fan!.count).toBe(FAN.count - 1)
    })

    it('a slur anchored to the member goes with it…', () => {
      const second = chord().fan!.members![1].pitches[0].id
      model.addSlur({ startNoteId: memberId, endNoteId: second })
      deleteNoteWithRepair(model, memberId)
      expect(model.getSlurs()).toHaveLength(0)
    })
  })
})

describe('chordNotesAt — staff- and voice-scoped', () => {
  it('heads sharing a beat are a chord only in the same voice AND staff; rests never are', () => {
    const model = new ScoreModel()
    model.addStaffBelow(0)
    const a = model.addNote({ ...C4, duration: 'q', measure: 1, beat: frac(0, 1) })
    const b = model.addNote({ step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    model.addNote({ step: 'G', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1), voice: 1 })
    model.addNote({ step: 'C', alter: 0, octave: 3, duration: 'q', measure: 1, beat: frac(0, 1), staff: 1 })

    expect(chordNotesAt(model, 1, frac(0, 1)).map(n => n.id).sort()).toEqual([a.id, b.id].sort())
    expect(chordNotesAt(model, 1, frac(0, 1), 1)).toHaveLength(1)
    expect(chordNotesAt(model, 1, frac(0, 1), 0, 1)).toHaveLength(1)
    expect(chordNotesAt(model, 1, frac(1, 1))).toHaveLength(0) // a rest stands there
  })
})
