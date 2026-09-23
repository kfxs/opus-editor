import { describe, it, expect, beforeEach } from 'vitest'
import { ScoreModel } from './ScoreModel'
import * as enclosureOps from './enclosureOps'
import * as graceOps from './graceOps'
import { addBracketed } from './bracketedGraceOps'
import { convertNoteToBracketed } from './noteToBracketedOps'
import { moveNoteToVoice } from './voiceOps'
import { toggleTie } from './tieOps'
import { fracCreate as frac, fracCompare } from '@/utils/fraction'
import { DEFAULT_FAN_BEAMS, DEFAULT_FAN_COUNT } from '@/utils/fannedBeam'
import { cloneGraceFresh } from '@/utils/graceNotes'
import type { Chord, ChordRest } from '@/types/music'

/**
 * Subject: `./enclosureOps` — the brackets a head WEARS (docs/plans/parenthesised-note-plan.md P0):
 * which heads may wear them, the toggle's rule, the report on load, and that the field TRAVELS with
 * its head through the model's copies.
 */
describe('enclosureOps', () => {
  const D4 = { step: 'D' as const, alter: 0 as const, octave: 4 }
  let model: ScoreModel
  beforeEach(() => { model = new ScoreModel() })
  const score = () => model.getScore()
  const add = (step: 'C' | 'E' | 'G', beat: number, duration: 'q' | 'h' = 'q') =>
    model.addNote({ step, octave: 4, duration, measure: 1, beat: frac(beat, 1) })

  describe('which heads', () => {
    it('a chord head: set writes the shape, null DELETES the field', () => {
      const n = add('C', 0)
      expect(enclosureOps.setEnclosure(score(), [n.id], 'round')).toBe(1)
      expect(enclosureOps.enclosureOf(score(), n.id)).toBe('round')
      expect(enclosureOps.setEnclosure(score(), [n.id], null)).toBe(1)
      const pitch = (score().measures[0].slots.find(s => s.type === 'chord') as Chord).notes[0]
      expect('enclosure' in pitch).toBe(false)
    })

    it('per HEAD: one head of a chord, the other stays bare', () => {
      const c = add('C', 0)
      const e = add('E', 0)
      enclosureOps.setEnclosure(score(), [e.id], 'round')
      expect(enclosureOps.enclosureOf(score(), e.id)).toBe('round')
      expect(enclosureOps.enclosureOf(score(), c.id)).toBeUndefined()
    })

    it('a GRACE head (his ask)', () => {
      const host = add('C', 0)
      const grace = graceOps.addGrace(score(), host.id, 'before', D4, 'appoggiatura', { duration: '8' })!
      expect(enclosureOps.setEnclosure(score(), [grace.pitches[0].id], 'round')).toBe(1)
      expect(enclosureOps.enclosureOf(score(), grace.pitches[0].id)).toBe('round')
    })

    it('a fan MEMBER head', () => {
      const n = add('C', 0, 'h')
      model.setFan(n.id, { direction: 'accel', count: DEFAULT_FAN_COUNT, beams: DEFAULT_FAN_BEAMS })
      const member = (score().measures[0].slots.find(s => s.type === 'chord') as Chord).fan!.members![0].pitches[0]
      expect(enclosureOps.setEnclosure(score(), [member.id], 'round')).toBe(1)
      expect(member.enclosure).toBe('round')
    })

    it('⛔ a bracketed grace\'s pitch, a rest, an unknown id: nothing written', () => {
      const host = add('C', 0)
      const bracketed = addBracketed(score(), host.id, 'before', D4)!
      const rest = score().measures[0].slots.find(s => s.type === 'rest')!
      expect(enclosureOps.setEnclosure(score(), [bracketed.pitches[0].id, rest.id, 'nobody'], 'round')).toBe(0)
      expect(bracketed.pitches[0].enclosure).toBeUndefined()
    })

    it('the same value again changes nothing', () => {
      const n = add('C', 0)
      enclosureOps.setEnclosure(score(), [n.id], 'round')
      expect(enclosureOps.setEnclosure(score(), [n.id], 'round')).toBe(0)
    })
  })

  describe('toggleEnclosure — any bare ⇒ all get them; all bracketed ⇒ all lose them', () => {
    it('mixed → all on; again → all off', () => {
      const a = add('C', 0)
      const b = add('E', 1)
      enclosureOps.setEnclosure(score(), [a.id], 'round')
      expect(enclosureOps.toggleEnclosure(score(), [a.id, b.id])).toBe('round')
      expect(enclosureOps.enclosureOf(score(), b.id)).toBe('round')
      expect(enclosureOps.toggleEnclosure(score(), [a.id, b.id])).toBeNull()
      expect(enclosureOps.enclosureOf(score(), a.id)).toBeUndefined()
      expect(enclosureOps.enclosureOf(score(), b.id)).toBeUndefined()
    })

    it('only heads vote: no head named ⇒ undefined', () => {
      const rest = score().measures[0].slots[0]
      expect(enclosureOps.toggleEnclosure(score(), [rest.id, 'nobody'])).toBeUndefined()
    })
  })

  describe('enclosureProblems — report, never repair', () => {
    it('an unknown shape, and brackets on a bracketed grace', () => {
      const n = add('C', 0)
      const bracketed = addBracketed(score(), n.id, 'before', D4)!
      const pitch = (score().measures[0].slots.find(s => s.type === 'chord') as Chord).notes[0]
      ;(pitch as { enclosure?: string }).enclosure = 'hexagon'
      ;(bracketed.pitches[0] as { enclosure?: string }).enclosure = 'round'
      const problems = enclosureOps.enclosureProblems(score())
      expect(problems).toHaveLength(2)
      expect((pitch as { enclosure?: string }).enclosure).toBe('hexagon')
    })

    it('a clean score reports nothing', () => {
      const n = add('C', 0)
      enclosureOps.setEnclosure(score(), [n.id], 'round')
      expect(enclosureOps.enclosureProblems(score())).toEqual([])
    })
  })

  describe('the field TRAVELS with its head', () => {
    const headsOf = (measureNumber: number) =>
      [...(model.getMeasure(measureNumber)?.slots ?? [])]
        .sort((a, b) => fracCompare(a.beat, b.beat))
        .filter((s): s is Chord => s.type === 'chord')
        .flatMap(s => s.notes)

    it('a re-bar keeps it (the relay\'s explicit copy)', () => {
      const n = add('C', 0, 'h')
      add('E', 2, 'h')
      enclosureOps.setEnclosure(score(), [n.id], 'round')
      model.setTimeSignature(1, { numerator: 3, denominator: 4 })
      expect(headsOf(1).filter(p => p.enclosure === 'round').map(p => p.step)).toEqual(['C'])
    })

    it('⭐ a tie chain whose heads DIFFER is not merged by the relay — the restated note keeps its own brackets', () => {
      const a = add('C', 0, 'h')
      const b = add('C', 2, 'h')
      expect(toggleTie(model, a.id)).toBe(true)
      enclosureOps.setEnclosure(score(), [b.id], 'round')
      model.setTimeSignature(1, { numerator: 3, denominator: 4 })
      const all = [...headsOf(1), ...headsOf(2)]
      // The bare half stays one bare head; the bracketed half is split across the new barline and
      // BOTH its pieces wear brackets — none leaks onto the first note.
      expect(all.map(p => p.enclosure ?? '-')).toEqual(['-', 'round', 'round'])
    })

    it('a move to another voice keeps it', () => {
      const n = add('C', 0)
      enclosureOps.setEnclosure(score(), [n.id], 'round')
      expect(moveNoteToVoice(score(), n.id, 1)).toBe(true)
      expect(enclosureOps.enclosureOf(score(), n.id)).toBe('round')
    })

    it('a grace group cloned fresh keeps it', () => {
      const host = add('C', 0)
      const grace = graceOps.addGrace(score(), host.id, 'before', D4, 'appoggiatura', { duration: '8' })!
      enclosureOps.setEnclosure(score(), [grace.pitches[0].id], 'round')
      const slot = score().measures[0].slots.find(s => s.type === 'chord') as ChordRest
      expect(cloneGraceFresh(slot.graceBefore!).notes[0].pitches[0].enclosure).toBe('round')
    })

    it('⛔ a note turned into a BRACKETED grace drops it — it is in brackets already', () => {
      const n = add('C', 0)
      enclosureOps.setEnclosure(score(), [n.id], 'round')
      const made = convertNoteToBracketed(score(), n.id)!
      expect(enclosureOps.enclosureProblems(score())).toEqual([])
      expect(made.bracketedId).toBe(n.id)
    })

    it('the flat note projects it', () => {
      const n = add('C', 0)
      expect(model.getNote(n.id)!.enclosure).toBeUndefined()
      enclosureOps.setEnclosure(score(), [n.id], 'round')
      expect(model.getNote(n.id)!.enclosure).toBe('round')
    })
  })
})
