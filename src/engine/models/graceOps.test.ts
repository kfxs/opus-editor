import { describe, it, expect, beforeEach } from 'vitest'
import { ScoreModel } from './ScoreModel'
import * as graceOps from './graceOps'
import { attackOf, findSlot } from './slotLookup'
import { deleteNoteWithRepair } from './deleteNoteOps'
import { fracCreate as frac, fracToNumber } from '@/utils/fraction'
import { DEFAULT_FAN_BEAMS, DEFAULT_FAN_COUNT } from '@/utils/fannedBeam'
import type { Chord, Score } from '@/types/music'

/**
 * {@link graceOps} — the GRACE NOTE model (docs/plans/grace-notes-plan.md §1–§2, P0).
 *
 * A grace is a CHILD of its main chord (D1): nothing here may move a beat, a rest or a bar's
 * capacity, and every test that adds one checks the bar is exactly what it was. A `ScoreModel` is
 * the FIXTURE; the free functions are the subject. Nothing here is drawn.
 */
describe('graceOps', () => {
  let model: ScoreModel
  let score: Score
  beforeEach(() => {
    model = new ScoreModel('Graces')
    score = model.getScore()
  })

  const D4 = { step: 'D' as const, alter: 0 as const, octave: 4 }
  const E4 = { step: 'E' as const, alter: 0 as const, octave: 4 }
  const EIGHTH = { duration: '8' as const }

  /** A quarter C4 on beat `b` of bar 1. */
  const quarter = (b = 0) => model.addNote({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: frac(b, 1) })
  const chordOf = (noteId: string): Chord => {
    const found = findSlot(score, noteId)
    if (found?.type !== 'chord') throw new Error('expected a chord')
    return found.chord
  }
  /** The bar as rhythm — what a grace must never change. */
  const rhythm = () => model.getMeasure(1)!.slots.map(s => `${s.type}@${fracToNumber(s.beat)}:${s.duration}`)

  describe('addGrace', () => {
    it('hangs a group BEFORE the chord, and the bar does not move', () => {
      const host = quarter()
      const before = rhythm()
      const grace = graceOps.addGrace(score, host.id, 'before', D4, 'appoggiatura', EIGHTH)
      expect(grace).not.toBeNull()
      expect(chordOf(host.id).graceBefore).toEqual({ notes: [grace] })
      expect(grace!.pitches[0]).toMatchObject(D4)
      expect(rhythm()).toEqual(before)
    })

    it('an ACCIACCATURA slashes the group it creates; an appoggiatura leaves the flag ABSENT', () => {
      const a = quarter(0)
      const b = quarter(1)
      graceOps.addGrace(score, a.id, 'before', D4, 'acciaccatura', EIGHTH)
      graceOps.addGrace(score, b.id, 'before', D4, 'appoggiatura', EIGHTH)
      expect(chordOf(a.id).graceBefore!.slash).toBe(true)
      expect('slash' in chordOf(b.id).graceBefore!).toBe(false)
    })

    it('a second press APPENDS, left to right — and the form is read only when the group is created', () => {
      const host = quarter()
      graceOps.addGrace(score, host.id, 'before', D4, 'appoggiatura', { duration: '16' })
      graceOps.addGrace(score, host.id, 'before', E4, 'acciaccatura', { duration: '16' })
      const group = chordOf(host.id).graceBefore!
      expect(group.notes.map(n => n.pitches[0].step)).toEqual(['D', 'E'])
      expect('slash' in group).toBe(false) // the slash is the group's flag, not a press's
    })

    it('a grace AFTER lives on the note it FOLLOWS (D2), apart from the group before', () => {
      const host = quarter()
      graceOps.addGrace(score, host.id, 'before', D4, 'appoggiatura', EIGHTH)
      graceOps.addGrace(score, host.id, 'after', E4, 'appoggiatura', EIGHTH)
      expect(chordOf(host.id).graceBefore!.notes).toHaveLength(1)
      expect(chordOf(host.id).graceAfter!.notes[0].pitches[0].step).toBe('E')
    })

    it('dots are ABSENT unless written — the width-cache key has one spelling per music', () => {
      const host = quarter()
      const plain = graceOps.addGrace(score, host.id, 'before', D4, 'appoggiatura', { duration: '8', dots: 0 })!
      const dotted = graceOps.addGrace(score, host.id, 'before', E4, 'appoggiatura', { duration: '8', dots: 1 })!
      expect('dots' in plain).toBe(false)
      expect(dotted.dots).toBe(1)
    })

    it('⭐ hangs a grace BEFORE a REST (D7 reversed) — found, projected and removed like a chord\'s', () => {
      quarter(0)
      const rest = model.getMeasure(1)!.slots.find(s => s.type === 'rest')!
      const grace = graceOps.addGrace(score, rest.id, 'before', D4, 'acciaccatura', EIGHTH)!
      expect(rest.type === 'rest' && rest.graceBefore?.notes).toEqual([grace])
      const id = grace.pitches[0].id
      expect(graceOps.isGraceNote(score, id)).toBe(true)
      expect(model.getNote(id)).toMatchObject({ id, step: 'D', octave: 4, duration: '8' })
      expect(model.getNote(id)?.isRest).toBeFalsy()
      expect(model.getNotePitch(id)?.id).toBe(id)
      expect(graceOps.removeGrace(score, id)).toBe(true)
      expect('graceBefore' in rest).toBe(false)
    })

    it('⛔ refuses a grace AFTER a rest — after a silence it is not a notation', () => {
      const rest = model.getMeasure(1)!.slots.find(s => s.type === 'rest')!
      expect(graceOps.addGrace(score, rest.id, 'after', D4, 'appoggiatura', EIGHTH)).toBeNull()
    })

    it('⛔ refuses a FAN MEMBER and a GRACE as host — the host is a slot\'s chord', () => {
      const host = model.addNote({ step: 'C', octave: 4, duration: 'h', measure: 1, beat: frac(0, 1) })
      model.setFan(host.id, { direction: 'accel', count: DEFAULT_FAN_COUNT, beams: DEFAULT_FAN_BEAMS })
      const memberId = chordOf(host.id).fan!.members![0].pitches[0].id
      expect(graceOps.addGrace(score, memberId, 'before', D4, 'appoggiatura', EIGHTH)).toBeNull()

      const grace = graceOps.addGrace(score, host.id, 'before', D4, 'appoggiatura', EIGHTH)!
      expect(graceOps.addGrace(score, grace.pitches[0].id, 'before', E4, 'appoggiatura', EIGHTH)).toBeNull()
      expect(chordOf(host.id).graceBefore!.notes).toHaveLength(1)
    })

    it('⛔ refuses a grace BEFORE a tied continuation, and a grace AFTER a note tied on', () => {
      const head = quarter(0)
      const tail = quarter(1)
      model.updateNote(head.id, { tiedTo: tail.id })
      model.updateNote(tail.id, { tiedFrom: head.id })
      expect(graceOps.addGrace(score, tail.id, 'before', D4, 'appoggiatura', EIGHTH)).toBeNull()
      expect(graceOps.addGrace(score, head.id, 'after', D4, 'appoggiatura', EIGHTH)).toBeNull()
      // …and the two ENDS of the chain take them.
      expect(graceOps.addGrace(score, head.id, 'before', D4, 'appoggiatura', EIGHTH)).not.toBeNull()
      expect(graceOps.addGrace(score, tail.id, 'after', D4, 'appoggiatura', EIGHTH)).not.toBeNull()
    })
  })

  describe('finding a grace', () => {
    it('findSlot finds a grace pitch ONLY when asked — every mutator that assumes `slot.notes` fails closed', () => {
      const host = quarter()
      const id = graceOps.addGrace(score, host.id, 'before', D4, 'appoggiatura', EIGHTH)!.pitches[0].id
      expect(findSlot(score, id)).toBeUndefined()
      const found = findSlot(score, id, { graceNotes: true })
      expect(found?.type === 'chord' && found.grace).toMatchObject({ side: 'before', index: 0 })
      expect(graceOps.isGraceNote(score, id)).toBe(true)
      expect(graceOps.isGraceNote(score, host.id)).toBe(false)
    })

    it('attackOf answers the GRACE, so its marks are its own', () => {
      const host = quarter()
      const grace = graceOps.addGrace(score, host.id, 'before', D4, 'appoggiatura', EIGHTH)!
      expect(attackOf(findSlot(score, grace.pitches[0].id, { graceNotes: true })!)).toBe(grace)
    })

    it('getNote projects the grace as ITSELF — its written value, none of the slot\'s statements', () => {
      const host = model.addNote({ step: 'C', octave: 4, duration: 'h', measure: 1, beat: frac(2, 1), beam: 'begin', articulations: ['accent'] })
      const grace = graceOps.addGrace(score, host.id, 'before', D4, 'appoggiatura', { duration: '16', dots: 1 })!
      const note = model.getNote(grace.pitches[0].id)!
      expect(note).toMatchObject({ step: 'D', octave: 4, duration: '16', dots: 1, measure: 1 })
      expect(fracToNumber(note.beat)).toBe(2) // it stands at its chord's beat — it has none of its own
      expect(note.beam).toBeUndefined()
      expect(note.articulations).toBeUndefined()
    })

    it('updateNote re-pitches the grace and marks it, and touches nothing of the chord', () => {
      const host = quarter()
      const grace = graceOps.addGrace(score, host.id, 'before', D4, 'appoggiatura', EIGHTH)!
      const id = grace.pitches[0].id
      model.updateNote(id, { step: 'F', alter: 1, octave: 5, articulations: ['staccato'], duration: 'w' })
      expect(grace.pitches[0]).toMatchObject({ step: 'F', alter: 1, octave: 5 })
      expect(grace.articulations).toEqual(['staccato'])
      expect(grace.duration).toBe('8') // a rhythm field is the SLOT's — ignored, as for a fan member
      expect(chordOf(host.id).notes[0]).toMatchObject({ step: 'C', octave: 4 })
      expect(chordOf(host.id).articulations).toBeUndefined()
    })
  })

  describe('removeGrace', () => {
    it('the last pitch takes the grace, the last grace takes the GROUP — never `{ notes: [] }`', () => {
      const host = quarter()
      const a = graceOps.addGrace(score, host.id, 'before', D4, 'appoggiatura', EIGHTH)!
      const b = graceOps.addGrace(score, host.id, 'before', E4, 'appoggiatura', EIGHTH)!
      expect(graceOps.removeGrace(score, a.pitches[0].id)).toBe(true)
      expect(chordOf(host.id).graceBefore!.notes).toEqual([b])
      expect(graceOps.removeGrace(score, b.pitches[0].id)).toBe(true)
      expect('graceBefore' in chordOf(host.id)).toBe(false)
    })

    it('one pitch of a grace CHORD leaves the grace standing', () => {
      const host = quarter()
      const grace = graceOps.addGrace(score, host.id, 'before', D4, 'appoggiatura', EIGHTH)!
      grace.pitches.push({ id: 'g-upper', ...E4 })
      expect(graceOps.removeGrace(score, 'g-upper')).toBe(true)
      expect(chordOf(host.id).graceBefore!.notes[0].pitches.map(p => p.step)).toEqual(['D'])
    })

    it('refuses anything that is not a grace', () => {
      const host = quarter()
      expect(graceOps.removeGrace(score, host.id)).toBe(false)
      expect(chordOf(host.id).notes).toHaveLength(1)
    })
  })

  describe('delete (deleteNoteWithRepair)', () => {
    it('⭐ a grace deletes as a grace — no rest minted, the main note untouched', () => {
      const host = quarter()
      const grace = graceOps.addGrace(score, host.id, 'before', D4, 'appoggiatura', EIGHTH)!
      const before = rhythm()
      expect(deleteNoteWithRepair(model, grace.pitches[0].id)).toBe(true)
      expect(rhythm()).toEqual(before)
      expect(chordOf(host.id).notes[0].id).toBe(host.id)
      expect('graceBefore' in chordOf(host.id)).toBe(false)
    })

    it('deleting the MAIN note takes its graces with it (they belong to it)', () => {
      const host = quarter()
      const grace = graceOps.addGrace(score, host.id, 'before', D4, 'appoggiatura', EIGHTH)!
      deleteNoteWithRepair(model, host.id)
      expect(model.getNote(grace.pitches[0].id)).toBeUndefined()
    })
  })

  describe('the three group flags — absent is the default', () => {
    it('slash on and off, addressed by the main note or by a grace in the group', () => {
      const host = quarter()
      const grace = graceOps.addGrace(score, host.id, 'before', D4, 'appoggiatura', EIGHTH)!
      expect(graceOps.setGraceSlash(score, host.id, 'before', true)).toBe(true)
      expect(graceOps.setGraceSlash(score, host.id, 'before', true)).toBe(false) // no change, no edit
      expect(graceOps.setGraceSlash(score, grace.pitches[0].id, 'before', false)).toBe(true)
      expect('slash' in chordOf(host.id).graceBefore!).toBe(false)
    })

    it('the stem: null DELETES the field rather than pinning UP', () => {
      const host = quarter()
      graceOps.addGrace(score, host.id, 'before', D4, 'appoggiatura', EIGHTH)
      expect(graceOps.setGraceStem(score, host.id, 'before', 'down')).toBe(true)
      expect(chordOf(host.id).graceBefore!.stemDirection).toBe('down')
      expect(graceOps.setGraceStem(score, host.id, 'before', null)).toBe(true)
      expect('stemDirection' in chordOf(host.id).graceBefore!).toBe(false)
    })

    it('refuses a side with no group, and a grace of the OTHER side\'s group', () => {
      const host = quarter()
      const before = graceOps.addGrace(score, host.id, 'before', D4, 'appoggiatura', EIGHTH)!
      expect(graceOps.setGraceSlash(score, host.id, 'after', true)).toBe(false)
      graceOps.addGrace(score, host.id, 'after', E4, 'appoggiatura', EIGHTH)
      expect(graceOps.setGraceSlash(score, before.pitches[0].id, 'after', true)).toBe(false)
    })
  })

  describe('the tie chain\'s END — where a grace after lives', () => {
    it('detachGraceAfterOfChain walks to the last piece and takes its group; attach will not overwrite', () => {
      const head = quarter(0)
      const tail = quarter(1)
      model.updateNote(head.id, { tiedTo: tail.id })
      model.updateNote(tail.id, { tiedFrom: head.id })
      graceOps.addGrace(score, tail.id, 'after', D4, 'appoggiatura', EIGHTH)
      const group = graceOps.detachGraceAfterOfChain(score, head.id)!
      expect(group.notes).toHaveLength(1)
      expect('graceAfter' in chordOf(tail.id)).toBe(false)

      graceOps.addGrace(score, head.id, 'before', E4, 'appoggiatura', EIGHTH) // unrelated side
      expect(graceOps.attachGraceAfter(score, head.id, group)).toBe(true)
      expect(graceOps.attachGraceAfter(score, head.id, { notes: [] })).toBe(false)
      expect(chordOf(head.id).graceAfter).toBe(group)
    })
  })

  describe('graceProblems — report, never repair', () => {
    it('a clean score reports nothing', () => {
      const host = quarter()
      graceOps.addGrace(score, host.id, 'before', D4, 'appoggiatura', EIGHTH)
      expect(graceOps.graceProblems(score)).toEqual([])
    })

    it('reports a grace AFTER a rest, an empty group, a grace with no pitches, and a shared id — and changes none of them', () => {
      const host = quarter(0)
      const other = quarter(1)
      chordOf(host.id).graceBefore = { notes: [] }
      chordOf(host.id).graceAfter = { notes: [{ pitches: [], duration: '8' }] }
      chordOf(other.id).graceBefore = { notes: [{ pitches: [{ id: host.id, ...D4 }], duration: '8' }] }
      const rest = model.getMeasure(1)!.slots.find(s => s.type === 'rest')!
      ;(rest as unknown as Record<string, unknown>).graceAfter = { notes: [] }

      const problems = graceOps.graceProblems(score)
      expect(problems).toHaveLength(4)
      expect(problems.join('\n')).toMatch(/REST carries graceAfter/)
      expect(problems.join('\n')).toMatch(/group with no notes/)
      expect(problems.join('\n')).toMatch(/has no pitches/)
      expect(problems.join('\n')).toMatch(/not unique/)
      expect(chordOf(host.id).graceBefore).toEqual({ notes: [] }) // reported, not repaired
    })
  })

  it('⭐ survives the JSON round trip exactly — which is what undo restores through', () => {
    const host = quarter()
    graceOps.addGrace(score, host.id, 'before', D4, 'acciaccatura', EIGHTH)
    graceOps.addGrace(score, host.id, 'after', E4, 'appoggiatura', { duration: '16' })
    graceOps.setGraceStem(score, host.id, 'after', 'down')
    const loaded = ScoreModel.fromJSON(model.toJSON())
    const found = findSlot(loaded.getScore(), host.id)
    expect(found?.type === 'chord' && found.chord.graceBefore).toEqual(chordOf(host.id).graceBefore)
    expect(found?.type === 'chord' && found.chord.graceAfter).toEqual(chordOf(host.id).graceAfter)
  })
})

describe('graceOps.setGraceWritten — a grace\'s written value (plan §3)', () => {
  it('⭐ sets the duration and the dots on the GRACE, and nothing in the bar moves', () => {
    const model = new ScoreModel()
    const host = model.addNote({ step: 'E', octave: 5, duration: 'q', measure: 1, beat: frac(0, 1) })
    const grace = graceOps.addGrace(model.getScore(), host.id, 'before', { step: 'D', alter: 0, octave: 5 }, 'appoggiatura', { duration: '8' })!
    const slotsBefore = JSON.stringify(model.getMeasure(1)!.slots.map(s => [s.type, s.duration, fracToNumber(s.beat)]))
    expect(graceOps.setGraceWritten(model.getScore(), grace.pitches[0].id, { duration: '16', dots: 1 })).toBe(true)
    expect(grace).toMatchObject({ duration: '16', dots: 1 })
    expect(graceOps.setGraceWritten(model.getScore(), grace.pitches[0].id, { dots: 0 })).toBe(true)
    expect('dots' in grace, 'absent is the only spelling of no dots').toBe(false)
    expect(JSON.stringify(model.getMeasure(1)!.slots.map(s => [s.type, s.duration, fracToNumber(s.beat)]))).toBe(slotsBefore)
  })

  it('answers false for a slot\'s own note — it is not a grace', () => {
    const model = new ScoreModel()
    const host = model.addNote({ step: 'E', octave: 5, duration: 'q', measure: 1, beat: frac(0, 1) })
    expect(graceOps.setGraceWritten(model.getScore(), host.id, { duration: '16' })).toBe(false)
  })
})
