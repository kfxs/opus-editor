import { describe, it, expect, beforeEach } from 'vitest'
import { ScoreModel } from './ScoreModel'
import * as cueOps from './cueOps'
import * as graceOps from './graceOps'
import { addBracketed } from './bracketedGraceOps'
import { convertNoteToGrace } from './noteToGraceOps'
import { graceToNote } from './graceToNoteOps'
import { convertNoteToBracketed } from './noteToBracketedOps'
import { moveNoteToVoice } from './voiceOps'
import { fracCreate as frac, fracCompare } from '@/utils/fraction'
import { DEFAULT_FAN_BEAMS, DEFAULT_FAN_COUNT } from '@/utils/fannedBeam'
import type { Chord, Rest } from '@/types/music'
import { buildClipboardFromSelection } from '@/interactions/clipboard/clipboard'

/**
 * Subject: `./cueOps` — a note drawn at CUE size (docs/plans/cue-size-plan.md P0): what an id is the size
 * OF, the toggle's rule, the report on load, and that the field TRAVELS through the model's copies.
 */
describe('cueOps', () => {
  const D4 = { step: 'D' as const, alter: 0 as const, octave: 4 }
  let model: ScoreModel
  beforeEach(() => { model = new ScoreModel() })
  const score = () => model.getScore()
  const add = (step: 'C' | 'E' | 'G', beat: number, duration: 'q' | 'h' = 'q', measure = 1) =>
    model.addNote({ step, octave: 4, duration, measure, beat: frac(beat, 1) })
  const chordOf = (id: string) => score().measures.flatMap(m => m.slots).find(s => s.type === 'chord' && s.notes.some(p => p.id === id)) as Chord
  const restAt = (beat: number) => score().measures[0].slots.find(s => s.type === 'rest' && fracCompare(s.beat, frac(beat, 1)) === 0) as Rest

  describe('what an id is the size OF', () => {
    it('a chord head → its CHORD: every head of it is cue; off DELETES the field', () => {
      const c = add('C', 0)
      const e = add('E', 0)
      expect(cueOps.setCue(score(), [e.id], true)).toBe(1)
      expect(chordOf(c.id).cue).toBe(true)
      expect(cueOps.isCue(score(), c.id)).toBe(true)
      expect(cueOps.setCue(score(), [c.id], false)).toBe(1)
      expect('cue' in chordOf(c.id)).toBe(false)
    })

    it('two heads of one chord name it ONCE', () => {
      const c = add('C', 0)
      const e = add('E', 0)
      expect(cueOps.setCue(score(), [c.id, e.id], true)).toBe(1)
    })

    it('a REST', () => {
      add('C', 0)
      const rest = restAt(1)
      expect(cueOps.setCue(score(), [rest.id], true)).toBe(1)
      expect(restAt(1).cue).toBe(true)
    })

    it('a fan MEMBER → its slot (the member has no size of its own)', () => {
      const n = add('C', 0, 'h')
      model.setFan(n.id, { direction: 'accel', count: DEFAULT_FAN_COUNT, beams: DEFAULT_FAN_BEAMS })
      const member = chordOf(n.id).fan!.members![0].pitches[0]
      expect(cueOps.setCue(score(), [member.id], true)).toBe(1)
      expect(chordOf(n.id).cue).toBe(true)
    })

    it('a GRACE → that grace, ⛔ not its host', () => {
      const host = add('C', 0)
      const grace = graceOps.addGrace(score(), host.id, 'before', D4, 'appoggiatura', { duration: '8' })!
      expect(cueOps.setCue(score(), [grace.pitches[0].id], true)).toBe(1)
      expect(grace.cue).toBe(true)
      expect(chordOf(host.id).cue).toBeUndefined()
    })

    it('a BRACKETED grace → that bracketed grace', () => {
      const host = add('C', 0)
      const b = addBracketed(score(), host.id, 'before', D4)!
      expect(cueOps.setCue(score(), [b.pitches[0].id], true)).toBe(1)
      expect(b.cue).toBe(true)
      expect(chordOf(host.id).cue).toBeUndefined()
    })

    it('⛔ an unknown id: nothing written; the same value again changes nothing', () => {
      const n = add('C', 0)
      expect(cueOps.setCue(score(), ['nobody'], true)).toBe(0)
      cueOps.setCue(score(), [n.id], true)
      expect(cueOps.setCue(score(), [n.id], true)).toBe(0)
    })
  })

  describe('toggleCue — any full ⇒ all cue; all cue ⇒ all full', () => {
    it('mixed → all on; again → all off', () => {
      const a = add('C', 0)
      const b = add('E', 1)
      cueOps.setCue(score(), [a.id], true)
      expect(cueOps.toggleCue(score(), [a.id, b.id])).toBe(true)
      expect([cueOps.isCue(score(), a.id), cueOps.isCue(score(), b.id)]).toEqual([true, true])
      expect(cueOps.toggleCue(score(), [a.id, b.id])).toBe(false)
      expect([cueOps.isCue(score(), a.id), cueOps.isCue(score(), b.id)]).toEqual([false, false])
    })

    it('no id names a note ⇒ undefined', () => {
      expect(cueOps.toggleCue(score(), ['nobody'])).toBeUndefined()
    })
  })

  describe('cueProblems — report, never repair', () => {
    it('a `false` (or anything but `true`) on a slot, a grace or a bracketed grace', () => {
      const host = add('C', 0)
      const grace = graceOps.addGrace(score(), host.id, 'before', D4, 'appoggiatura', { duration: '8' })!
      const b = addBracketed(score(), host.id, 'after', D4)!
      ;(chordOf(host.id) as { cue?: unknown }).cue = false
      ;(grace as { cue?: unknown }).cue = 1
      ;(b as { cue?: unknown }).cue = 'yes'
      expect(cueOps.cueProblems(score())).toHaveLength(3)
      expect(chordOf(host.id).cue).toBe(false) // reported, not repaired
    })

    it('a clean score reports nothing', () => {
      const n = add('C', 0)
      cueOps.setCue(score(), [n.id], true)
      expect(cueOps.cueProblems(score())).toEqual([])
    })
  })

  describe('the field TRAVELS', () => {
    const chordsOf = (measureNumber: number) =>
      [...(model.getMeasure(measureNumber)?.slots ?? [])]
        .sort((a, b) => fracCompare(a.beat, b.beat))
        .filter((s): s is Chord => s.type === 'chord')

    it('a SPLIT keeps it on every piece (a re-bar across a new barline)', () => {
      add('C', 0, 'h')
      const e = add('E', 2, 'h')
      cueOps.setCue(score(), [e.id], true)
      model.setTimeSignature(1, { numerator: 3, denominator: 4 })
      const all = [...chordsOf(1), ...chordsOf(2)]
      expect(all.map(c => `${c.notes[0].step}${c.cue ? '·cue' : ''}`)).toEqual(['C', 'E·cue', 'E·cue'])
    })

    it('COPY and PASTE keep it — a chord and a rest', () => {
      model.addMeasure()
      const n = add('C', 0)
      const rest = restAt(1)
      cueOps.setCue(score(), [n.id, rest.id], true)
      const clip = buildClipboardFromSelection(score(), [n.id, rest.id])!
      model.pasteEvents(clip, { measure: 2, beat: frac(0, 1), voice: 0 })
      const pasted = model.getMeasure(2)!.slots
      expect(pasted.find(s => s.type === 'chord')?.cue).toBe(true)
      expect(pasted.find(s => s.type === 'rest' && fracCompare(s.beat, frac(1, 1)) === 0)?.cue).toBe(true)
    })

    it('a move to another voice keeps it', () => {
      const n = add('C', 0)
      cueOps.setCue(score(), [n.id], true)
      expect(moveNoteToVoice(score(), n.id, 1)).toBe(true)
      expect(cueOps.isCue(score(), n.id)).toBe(true)
    })

    it('⭐ a cue rest turned into a note in place (`updateNote`) keeps it — an EDIT of the slot', () => {
      add('C', 0)
      const rest = restAt(1)
      cueOps.setCue(score(), [rest.id], true)
      model.updateNote(rest.id, { isRest: false, step: 'E', alter: 0, octave: 4 })
      expect(cueOps.isCue(score(), rest.id)).toBe(true)
      expect(model.getNote(rest.id)!.isRest).toBeFalsy()
    })

    it('a cue note turned into a REST is a cue rest', () => {
      const n = add('C', 0)
      cueOps.setCue(score(), [n.id], true)
      expect(model.convertToRest(n.id)?.cue).toBe(true)
    })

    it('note → grace → note keeps it; note → bracketed grace keeps it', () => {
      const n = add('C', 0)
      cueOps.setCue(score(), [n.id], true)
      const made = convertNoteToGrace(score(), n.id, 'appoggiatura')!
      expect(cueOps.isCue(score(), made.graceId)).toBe(true)
      const back = graceToNote(score(), made.graceId)!
      expect(cueOps.isCue(score(), back)).toBe(true)

      const m = add('E', 1)
      cueOps.setCue(score(), [m.id], true)
      const bracketed = convertNoteToBracketed(score(), m.id)!
      expect(cueOps.isCue(score(), bracketed.bracketedId)).toBe(true)
    })

    it('⭐ a TUPLET note moved to another voice keeps it (the tuplet path builds new slots)', () => {
      const t = model.createTuplet(1, frac(0, 1), '8', 3, 2, 0)
      const ids = (['A', 'B', 'C'] as const).map((step, i) => model.addNote({
        step, alter: 0, octave: 4, duration: '8', measure: 1, beat: frac(i, 3), tupletId: t.id, actualDuration: frac(1, 3),
      }).id)
      cueOps.setCue(score(), [ids[1]], true)
      expect(moveNoteToVoice(score(), ids[1], 1)).toBe(true)
      expect(cueOps.isCue(score(), ids[1])).toBe(true)
      expect(cueOps.isCue(score(), ids[0])).toBe(false)
    })

    it('⛔ a full grace turned into its cue note does NOT take the note\'s cue off (only a delete does)', () => {
      const host = add('C', 0)
      const grace = graceOps.addGrace(score(), host.id, 'before', D4, 'appoggiatura', { duration: '8' })!
      cueOps.setCue(score(), [host.id], true)
      const back = graceToNote(score(), grace.pitches[0].id)!
      expect(cueOps.isCue(score(), back)).toBe(true)
    })

    it('a grace\'s own size is its own — ⛔ a full grace on a cue host stays full', () => {
      const host = add('C', 0)
      const grace = graceOps.addGrace(score(), host.id, 'before', D4, 'appoggiatura', { duration: '8' })!
      cueOps.setCue(score(), [host.id], true)
      expect(model.getNote(grace.pitches[0].id)!.cue).toBeUndefined()
    })

    it('the flat note projects it — a chord\'s, a rest\'s, a grace\'s', () => {
      const n = add('C', 0)
      const grace = graceOps.addGrace(score(), n.id, 'before', D4, 'appoggiatura', { duration: '8' })!
      const rest = restAt(1)
      expect(model.getNote(n.id)!.cue).toBeUndefined()
      cueOps.setCue(score(), [n.id, rest.id, grace.pitches[0].id], true)
      expect(model.getNote(n.id)!.cue).toBe(true)
      expect(model.getNote(rest.id)!.cue).toBe(true)
      expect(model.getNote(grace.pitches[0].id)!.cue).toBe(true)
    })
  })
})
