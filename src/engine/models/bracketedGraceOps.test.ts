import { describe, it, expect, beforeEach } from 'vitest'
import { ScoreModel } from './ScoreModel'
import * as bracketedOps from './bracketedGraceOps'
import * as graceOps from './graceOps'
import { findSlot } from './slotLookup'
import { fracCreate as frac, fracToNumber } from '@/utils/fraction'
import type { Chord, Score } from '@/types/music'

/**
 * {@link bracketedOps} — the BRACKETED grace model (docs/plans/bracketed-grace-plan.md P0).
 *
 * It belongs to its TARGET (B2): a main chord, either side, or a grace, before only. Nothing here may
 * move a beat, a rest or a bar's capacity. A `ScoreModel` is the FIXTURE; the free functions are the
 * subject. Nothing here is drawn.
 */
describe('bracketedGraceOps', () => {
  let model: ScoreModel
  let score: Score
  beforeEach(() => {
    model = new ScoreModel('Bracketed')
    score = model.getScore()
  })

  const Bb3 = { step: 'B' as const, alter: -1 as const, octave: 3 }
  const D5 = { step: 'D' as const, alter: 0 as const, octave: 5 }
  const E4 = { step: 'E' as const, alter: 0 as const, octave: 4 }

  const quarter = (b = 0) => model.addNote({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: frac(b, 1) })
  const chordOf = (noteId: string): Chord => {
    const found = findSlot(score, noteId)
    if (found?.type !== 'chord') throw new Error('expected a chord')
    return found.chord
  }
  const rhythm = () => model.getMeasure(1)!.slots.map(s => `${s.type}@${fracToNumber(s.beat)}:${s.duration}`)

  describe('addBracketed — on a MAIN chord', () => {
    it('BEFORE: a list on the chord, the head as spelled, and the bar does not move', () => {
      const host = quarter()
      const before = rhythm()
      const made = bracketedOps.addBracketed(score, host.id, 'before', Bb3)
      expect(made).not.toBeNull()
      expect(chordOf(host.id).bracketedBefore).toEqual([made])
      expect(made!.pitches[0]).toMatchObject(Bb3)
      expect('bracketedAfter' in chordOf(host.id)).toBe(false)
      expect(rhythm()).toEqual(before)
    })

    it('AFTER: the trill note\'s side, on its own list', () => {
      const host = quarter()
      const made = bracketedOps.addBracketed(score, host.id, 'after', D5)
      expect(chordOf(host.id).bracketedAfter).toEqual([made])
      expect('bracketedBefore' in chordOf(host.id)).toBe(false)
    })

    it('⭐ B3: several are a LIST, and the new one stands BESIDE its target — last before it, first after it', () => {
      const host = quarter()
      const b1 = bracketedOps.addBracketed(score, host.id, 'before', Bb3)
      const b2 = bracketedOps.addBracketed(score, host.id, 'before', E4)
      const a1 = bracketedOps.addBracketed(score, host.id, 'after', E4)
      const a2 = bracketedOps.addBracketed(score, host.id, 'after', D5)
      expect(chordOf(host.id).bracketedBefore).toEqual([b1, b2])
      expect(chordOf(host.id).bracketedAfter).toEqual([a2, a1])
    })

    it('an INDEX places it, clamped to the list', () => {
      const host = quarter()
      const b1 = bracketedOps.addBracketed(score, host.id, 'before', Bb3)
      const first = bracketedOps.addBracketed(score, host.id, 'before', E4, 0)
      const past = bracketedOps.addBracketed(score, host.id, 'before', D5, 99)
      expect(chordOf(host.id).bracketedBefore).toEqual([first, b1, past])
    })

    it('refuses BEFORE a tied continuation and AFTER a note tied on — the graces\' rule', () => {
      const host = quarter()
      const chord = chordOf(host.id)
      chord.notes[0].tiedFrom = 'elsewhere'
      expect(bracketedOps.addBracketed(score, host.id, 'before', Bb3)).toBeNull()
      delete chord.notes[0].tiedFrom
      chord.notes[0].tiedTo = 'elsewhere'
      expect(bracketedOps.addBracketed(score, host.id, 'after', D5)).toBeNull()
      expect(bracketedOps.addBracketed(score, host.id, 'before', Bb3)).not.toBeNull()
    })
  })

  describe('addBracketed — on a GRACE (the pre-bend into the first appoggiatura)', () => {
    it('BEFORE the grace: the list lives on the GRACE, not on the chord', () => {
      const host = quarter()
      const grace = graceOps.addGrace(score, host.id, 'before', E4, 'appoggiatura', { duration: '8' })!
      const made = bracketedOps.addBracketed(score, grace.pitches[0].id, 'before', Bb3)
      expect(grace.bracketedBefore).toEqual([made])
      expect('bracketedBefore' in chordOf(host.id)).toBe(false)
    })

    it('⛔ B5: AFTER a grace is refused', () => {
      const host = quarter()
      const grace = graceOps.addGrace(score, host.id, 'before', E4, 'appoggiatura', { duration: '8' })!
      expect(bracketedOps.addBracketed(score, grace.pitches[0].id, 'after', Bb3)).toBeNull()
      expect('bracketedAfter' in grace).toBe(false)
    })

    it('a grace hung on a REST is a target (B10: the grace is, the rest never)', () => {
      const rest = model.getMeasure(1)!.slots.find(s => s.type === 'rest')!
      const grace = graceOps.addGrace(score, rest.id, 'before', E4, 'appoggiatura', { duration: '8' })!
      expect(bracketedOps.addBracketed(score, grace.pitches[0].id, 'before', Bb3)).not.toBeNull()
      expect(grace.bracketedBefore).toHaveLength(1)
    })
  })

  describe('⭐ a REST is a target — B10 REVERSED (his report, 2026-09-23: "similar to grace stamp on empty measure")', () => {
    it('BEFORE a rest: its own list, and the bar does not move', () => {
      quarter()
      const before = rhythm()
      const rest = model.getMeasure(1)!.slots.find(s => s.type === 'rest')!
      const made = bracketedOps.addBracketed(score, rest.id, 'before', Bb3)
      expect(rest.bracketedBefore).toEqual([made])
      expect(rhythm()).toEqual(before)
    })

    it('⛔ AFTER a rest is refused — after a silence is not a notation', () => {
      const rest = model.getMeasure(1)!.slots.find(s => s.type === 'rest')!
      expect(bracketedOps.addBracketed(score, rest.id, 'after', Bb3)).toBeNull()
      expect('bracketedAfter' in rest).toBe(false)
    })
  })

  describe('what is NOT a target', () => {

    it('⛔ B3: a bracketed pitch — a bracket does not carry a bracket', () => {
      const host = quarter()
      const made = bracketedOps.addBracketed(score, host.id, 'before', Bb3)!
      expect(bracketedOps.addBracketed(score, made.pitches[0].id, 'before', E4)).toBeNull()
    })

    it('an id that is gone', () => {
      expect(bracketedOps.addBracketed(score, 'nobody', 'before', Bb3)).toBeNull()
    })
  })

  describe('finding one', () => {
    it('⭐ findSlot FAILS CLOSED: it does not know a bracketed pitch, so a mutator refuses instead of half-writing', () => {
      const host = quarter()
      const made = bracketedOps.addBracketed(score, host.id, 'before', Bb3)!
      expect(findSlot(score, made.pitches[0].id, { graceNotes: true, fanMembers: true })).toBeUndefined()
    })

    it('findBracketed names the slot, the target, the side and the place', () => {
      const host = quarter()
      const grace = graceOps.addGrace(score, host.id, 'before', E4, 'appoggiatura', { duration: '8' })!
      const onGrace = bracketedOps.addBracketed(score, grace.pitches[0].id, 'before', Bb3)!
      const after = bracketedOps.addBracketed(score, host.id, 'after', D5)!
      expect(bracketedOps.findBracketed(score, onGrace.pitches[0].id)).toMatchObject({ slot: chordOf(host.id), target: grace, side: 'before', index: 0 })
      expect(bracketedOps.findBracketed(score, after.pitches[0].id)).toMatchObject({ target: chordOf(host.id), side: 'after', index: 0 })
      expect(bracketedOps.isBracketedGrace(score, host.id)).toBe(false)
    })
  })

  describe('addBracketedPitch — a second head (a double-stop pre-bend)', () => {
    it('adds a head; ⛔ a pitch it already SHOWS (by sound) is refused', () => {
      const host = quarter()
      const made = bracketedOps.addBracketed(score, host.id, 'before', Bb3)!
      expect(bracketedOps.addBracketedPitch(score, made.pitches[0].id, D5)).not.toBeNull()
      expect(bracketedOps.addBracketedPitch(score, made.pitches[0].id, { step: 'A', alter: 1, octave: 3 })).toBeNull()
      expect(made.pitches).toHaveLength(2)
    })
  })

  describe('removeBracketed', () => {
    it('a head, then the bracketed grace, then the list — ⛔ never stored as []', () => {
      const host = quarter()
      const made = bracketedOps.addBracketed(score, host.id, 'before', Bb3)!
      const second = bracketedOps.addBracketedPitch(score, made.pitches[0].id, D5)!
      expect(bracketedOps.removeBracketed(score, second.id)).toBe(true)
      expect(chordOf(host.id).bracketedBefore).toEqual([made])
      const id = made.pitches[0].id
      expect(bracketedOps.removeBracketed(score, id)).toBe(true)
      expect('bracketedBefore' in chordOf(host.id)).toBe(false)
      expect(bracketedOps.removeBracketed(score, id)).toBe(false)
    })

    it('⭐ B4: removing one from a GRACE is the whole merge — the group was never split in the model', () => {
      const host = quarter()
      const g1 = graceOps.addGrace(score, host.id, 'before', E4, 'acciaccatura', { duration: '8' })!
      const g2 = graceOps.addGrace(score, host.id, 'before', D5, 'acciaccatura', { duration: '8' })!
      const group = chordOf(host.id).graceBefore!
      const made = bracketedOps.addBracketed(score, g2.pitches[0].id, 'before', Bb3)!
      expect(chordOf(host.id).graceBefore).toBe(group)
      bracketedOps.removeBracketed(score, made.pitches[0].id)
      expect(chordOf(host.id).graceBefore).toEqual({ notes: [g1, g2], slash: true })
      expect('bracketedBefore' in g2).toBe(false)
    })
  })

  describe('setBracketedPitch', () => {
    it('re-spells in place — the id stays; the same spelling is no change', () => {
      const host = quarter()
      const made = bracketedOps.addBracketed(score, host.id, 'before', Bb3)!
      const id = made.pitches[0].id
      expect(bracketedOps.setBracketedPitch(score, id, D5)).toBe(true)
      expect(made.pitches[0]).toEqual({ id, ...D5 })
      expect(bracketedOps.setBracketedPitch(score, id, D5)).toBe(false)
      expect(bracketedOps.setBracketedPitch(score, id, { ...D5, forceAccidental: true })).toBe(true)
      expect(made.pitches[0].forceAccidental).toBe(true)
    })
  })

  describe('bracketedProblems — report, never repair', () => {
    it('a clean score has none', () => {
      const host = quarter()
      bracketedOps.addBracketed(score, host.id, 'before', Bb3)
      expect(bracketedOps.bracketedProblems(score)).toEqual([])
    })

    it('an empty list, a bracketed grace with no pitches, a repeated id, a rest target, an AFTER on a grace', () => {
      const host = quarter()
      const chord = chordOf(host.id)
      chord.bracketedBefore = []
      chord.bracketedAfter = [{ pitches: [] }, { pitches: [{ id: host.id, ...D5 }] }]
      const rest = model.getMeasure(1)!.slots.find(s => s.type === 'rest')!
      ;(rest as unknown as Record<string, unknown>).bracketedAfter = [{ pitches: [{ id: 'r', ...E4 }] }]
      const grace = graceOps.addGrace(score, host.id, 'before', E4, 'appoggiatura', { duration: '8' })!
      ;(grace as unknown as Record<string, unknown>).bracketedAfter = []
      const problems = bracketedOps.bracketedProblems(score)
      expect(problems.some(p => p.includes('an empty bracketed list'))).toBe(true)
      expect(problems.some(p => p.includes('has no pitches'))).toBe(true)
      expect(problems.some(p => p.includes('is not unique'))).toBe(true)
      expect(problems.some(p => p.includes('a REST carries bracketedAfter'))).toBe(true)
      expect(problems.some(p => p.includes('bracketedAfter on a grace'))).toBe(true)
      // …and nothing was repaired.
      expect(chord.bracketedBefore).toEqual([])
    })
  })
})
