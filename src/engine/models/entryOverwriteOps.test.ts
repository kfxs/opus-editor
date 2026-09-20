/**
 * WHAT AN ENTERED NOTE OVERWRITES — the keyboard path's {@link overwriteOverlappedNotes} and the
 * mouse path's {@link findNotesToOverwrite} / {@link applyEntryOverwrites}. Nothing pinned either
 * before they moved (code-shape plan, Phase 4.2b), so these cases describe what each DOES today —
 * and the last chapter pins where the two part company, which is a decision nobody has taken.
 * Through a real `ScoreModel`.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { ScoreModel } from './ScoreModel'
import type { Note } from '@/types/music'
import { fracCreate as frac } from '@/utils/fraction'
import { spellingToMidi } from '@/utils/pitchSpelling'
import { applyEntryOverwrites, findNotesToOverwrite, overwriteOverlappedNotes } from './entryOverwriteOps'

const C4 = spellingToMidi('C', 0, 4)

describe('entryOverwriteOps', () => {
  let model: ScoreModel
  beforeEach(() => { model = new ScoreModel('T') }) // measure 1, 4/4

  const add = (step: 'C' | 'E' | 'G', beat: number, duration: 'q' | 'h' | '8' = 'q', over: Partial<Note> = {}) =>
    model.addNote({ step, alter: 0, octave: 4, duration, measure: 1, beat: frac(beat, 1), ...over })
  const alive = (n: Note) => !!model.getNote(n.id)
  const sweep = (from: number, to: number, voice = 0, staff = 0) =>
    overwriteOverlappedNotes(model, model.getMeasure(1)!, { beat: frac(from, 1), end: frac(to, 1), voice, staff })

  describe('overwriteOverlappedNotes — the keyboard path: do the intervals overlap?', () => {
    it('takes every note overlapping [beat, end) and answers what it took', () => {
      const [a, b, c] = [add('C', 0), add('E', 1), add('G', 2)]
      expect(sweep(1, 3).map(n => n.id).sort()).toEqual([b.id, c.id].sort())
      expect([a, b, c].map(alive)).toEqual([true, false, false])
    })

    it('⭐ notes that merely TOUCH do not overlap — exact, no epsilon', () => {
      const [a, c] = [add('C', 0), add('G', 2)]
      expect(sweep(1, 2)).toEqual([])
      expect([a, c].map(alive)).toEqual([true, true])
    })

    it('a note that starts BEFORE and rings into the range goes too', () => {
      const long = add('C', 0, 'h')
      sweep(1, 2)
      expect(alive(long)).toBe(false)
    })

    it('never a rest, and never another voice or staff', () => {
      model.addStaffBelow(0)
      const v2 = add('E', 0, 'q', { voice: 1 })
      const low = add('C', 0, 'q', { staff: 1 })
      const restsBefore = model.getNotesInMeasure(1).filter(n => n.isRest).length
      expect(sweep(0, 4)).toEqual([])
      expect([v2, low].map(alive)).toEqual([true, true])
      expect(model.getNotesInMeasure(1).filter(n => n.isRest)).toHaveLength(restsBefore)
    })

    it('a tuplet member is measured by its SOUNDING length, not its written one', () => {
      // A quarter-note triplet over beats 0–2: each member is written `q` and sounds 2/3.
      const created = model.createTuplet(1, frac(0, 1), 'q', 3, 2)!
      const first = model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1), tupletId: created.id })
      // [2/3, 1) — inside the first member's WRITTEN quarter, past the end of its sounding 2/3.
      const taken = overwriteOverlappedNotes(model, model.getMeasure(1)!, { beat: frac(2, 3), end: frac(1, 1), voice: 0, staff: 0 })
      expect(taken.map(n => n.id)).not.toContain(first.id)
    })
  })

  describe('findNotesToOverwrite — the mouse path: does it START inside my range?', () => {
    it('a different pitch on the same beat is a CHORD and is kept; the same pitch is replaced', () => {
      const [c, e] = [add('C', 0), add('E', 0)]
      const found = findNotesToOverwrite(model, 1, frac(0, 1), 'q', C4)
      expect(found.map(n => n.id)).toEqual([c.id])
      expect(alive(e)).toBe(true) // and finding deletes nothing
    })

    it('a note starting strictly inside the new note\'s length goes; one starting at its end stays', () => {
      const [inside, atEnd] = [add('E', 1), add('G', 2)]
      const found = findNotesToOverwrite(model, 1, frac(0, 1), 'h', C4).map(n => n.id)
      expect(found).toEqual([inside.id])
      expect(found).not.toContain(atEnd.id)
    })

    it('never another voice or staff', () => {
      model.addStaffBelow(0)
      add('E', 1, 'q', { voice: 1 })
      add('C', 1, 'q', { staff: 1 })
      expect(findNotesToOverwrite(model, 1, frac(0, 1), 'h', C4)).toEqual([])
    })

    it('applyEntryOverwrites deletes what it found', () => {
      const [same, inside, kept] = [add('C', 0), add('E', 1), add('G', 2)]
      applyEntryOverwrites(model, 1, frac(0, 1), 'h', 0, C4, undefined, undefined)
      expect([same, inside, kept].map(alive)).toEqual([false, false, true])
    })
  })

  describe('⚠️ where the two rules part company — pinned, not endorsed', () => {
    it('an EARLIER note ringing into the new one: the keyboard takes it, the mouse leaves it', () => {
      const long = add('C', 0, 'h') // sounds over beats 0–2
      expect(findNotesToOverwrite(model, 1, frac(1, 1), 'q', spellingToMidi('E', 0, 4))).toEqual([])
      expect(sweep(1, 2).map(n => n.id)).toEqual([long.id])
    })

    it('a different pitch on the SAME beat: the mouse chords with it, the keyboard sweep takes it', () => {
      const e = add('E', 0)
      expect(findNotesToOverwrite(model, 1, frac(0, 1), 'q', C4)).toEqual([])
      expect(sweep(0, 1).map(n => n.id)).toEqual([e.id])
    })
  })
})
