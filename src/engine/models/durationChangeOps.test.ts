/**
 * CHANGING A NOTE'S LENGTH — {@link changeNote}: what a longer note removes (and how it crosses the
 * barline), what a shorter one leaves behind, how a chord's heads stay in step, the tuplet clamp,
 * and the LABEL it hands the caller to commit under. Through a real `ScoreModel`.
 *
 * The overflow chapter came from `MusicEngine.test.ts` and the voice-isolation chapter from
 * `NoteEntryCoordinator.test.ts`, with the module (code-shape plan, Phase 4.2c); the rest is new —
 * nothing pinned the shorten, chord, rest-clip or tuplet branches.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { ScoreModel } from './ScoreModel'
import type { Note } from '@/types/music'
import { fracCreate as frac, fracToNumber } from '@/utils/fraction'
import { changeNote, findLargestFittingDuration } from './durationChangeOps'

describe('changeNote', () => {
  let model: ScoreModel
  beforeEach(() => {
    model = new ScoreModel('T') // measure 1, 4/4
    model.addMeasure()
  })

  const add = (step: 'C' | 'E' | 'G' | 'A', beat: number, duration: 'q' | 'h' | '8' = 'q', over: Partial<Note> = {}) =>
    model.addNote({ step, alter: 0, octave: 4, duration, measure: 1, beat: frac(beat, 1), ...over })
  /** A voice's stream in bar 1 as `nq@0 rh@2 …` — n/r, duration (+dots), beat. */
  const stream = (voice = 0, measure = 1) =>
    model.getNotesInMeasure(measure)
      .filter(n => (n.voice ?? 0) === voice)
      .sort((a, b) => fracToNumber(a.beat) - fracToNumber(b.beat))
      .map(n => `${n.isRest ? 'r' : 'n'}${n.duration}${'.'.repeat(n.dots ?? 0)}@${fracToNumber(n.beat)}`)

  it('throws on an id that names nothing', () => {
    expect(() => changeNote(model, 'gone', { duration: 'h' })).toThrow(/not found/)
  })

  describe('a LONGER note', () => {
    it('that fits removes what it covers, creates no tie, and commits as "Update note"', () => {
      const note = add('C', 0)
      const { note: updated, commit } = changeNote(model, note.id, { duration: 'h' })
      expect(commit).toBe('Update note')
      expect(updated.duration).toBe('h')
      expect(updated.tiedTo).toBeUndefined()
      expect(stream()).toEqual(['nh@0', 'rh@2'])
      expect(model.getNotesInMeasure(2).filter(n => !n.isRest)).toHaveLength(0)
    })

    it('overflow: extends across the barline as a tied continuation, committed as "Update note duration"', () => {
      // Quarter at beat 2 in 4/4 → 2 beats available. Extend to whole (4b) → overflow 2b
      const note = add('E', 2)
      expect(changeNote(model, note.id, { duration: 'w' }).commit).toBe('Update note duration')

      const m1Note = model.getNote(note.id)!
      expect(m1Note.duration).toBe('h')
      const m2Note = model.getNote(m1Note.tiedTo!)!
      expect(m2Note).toMatchObject({ duration: 'h', measure: 2, tiedFrom: note.id, step: 'E' })
    })

    it('overflow: 3 beats remaining is ONE dotted half, not a half tied to a quarter', () => {
      // Reported: this gave h + q (tied) in m1, then q in m2 — three pieces, two ties — where the
      // three beats are one dotted half. splitBeatsIntoLengths includes dots; the split now says
      // "the fewest values that span it".
      const note = add('G', 1)
      changeNote(model, note.id, { duration: 'w' })

      const n1 = model.getNote(note.id)!
      expect(n1).toMatchObject({ duration: 'h', dots: 1, measure: 1 })
      const n2 = model.getNote(n1.tiedTo!)!
      expect(n2).toMatchObject({ duration: 'q', measure: 2, tiedFrom: note.id })
      expect(n2.dots ?? 0).toBe(0)
      expect(n2.tiedTo).toBeUndefined()

      model.repairAllMeasureGaps() // throws under Vitest unless both bars are exactly full
    })

    it('overflow: a DOTTED length that overflows is split correctly', () => {
      // Quarter at beat 3 → 1 beat available. Dotted half (3b) → overflow 2b
      const note = add('A', 3)
      changeNote(model, note.id, { duration: 'h', dots: 1 })
      const m1Note = model.getNote(note.id)!
      expect(m1Note.duration).toBe('q')
      expect(model.getNote(m1Note.tiedTo!)).toMatchObject({ measure: 2, step: 'A' })
    })

    // 🚨 Was a bug (found writing this spec, predating Phase 4.2): the heads were split one at a
    // time and each split ERODED the next bar first, so the second head's erosion deleted the
    // continuation the first had just placed. An erosion now spares the slot's own continuations.
    it('overflow: every head of a CHORD crosses the barline', () => {
      const [c, e] = [add('C', 2), add('E', 2)]
      changeNote(model, c.id, { duration: 'w' })
      for (const head of [c, e]) {
        const now = model.getNote(head.id)!
        expect(now.duration).toBe('h')
        expect(model.getNote(now.tiedTo!)?.measure).toBe(2)
      }
    })

    it('a REST that would overflow is clipped to what fits — a rest does not tie', () => {
      add('C', 0); add('C', 1); add('C', 2)
      const rest = model.getNotesInMeasure(1).find(n => n.isRest && fracToNumber(n.beat) === 3)!
      changeNote(model, rest.id, { duration: 'w' })
      expect(stream()).toEqual(['nq@0', 'nq@1', 'nq@2', 'rq@3'])
      expect(model.getNotesInMeasure(2).filter(n => !n.isRest)).toHaveLength(0)
    })
  })

  describe('a SHORTER note', () => {
    it('leaves room that is filled with rests', () => {
      const note = add('C', 0, 'h')
      changeNote(model, note.id, { duration: 'q' })
      expect(stream().slice(0, 2)).toEqual(['nq@0', 'rq@1'])
      model.repairAllMeasureGaps()
    })

    it('lets go of a tie it no longer reaches', () => {
      const [a, b] = [add('C', 0, 'h'), add('C', 2, 'h')]
      model.updateNote(a.id, { tiedTo: b.id })
      model.updateNote(b.id, { tiedFrom: a.id })

      changeNote(model, a.id, { duration: 'q' })

      expect(model.getNote(a.id)!.tiedTo).toBeUndefined()
      expect(model.getNote(b.id)!.tiedFrom).toBeUndefined()
    })
  })

  it('a CHORD\'s heads share one length — changing one changes all', () => {
    const [c, e] = [add('C', 0), add('E', 0)]
    changeNote(model, c.id, { duration: 'h', dots: 1 })
    expect(model.getNote(e.id)).toMatchObject({ duration: 'h', dots: 1 })
  })

  describe('voices are independent streams', () => {
    beforeEach(() => {
      // Two voices, identical streams: q-note@0 + q-rest@1 + h-rest@2 each.
      add('C', 0)
      add('E', 0, 'q', { voice: 1 })
    })

    it('lengthening a rest in one voice leaves the other voice untouched', () => {
      const v1Rest = model.getNotesInMeasure(1).find(n => n.isRest && (n.voice ?? 0) === 0 && fracToNumber(n.beat) === 1)!
      changeNote(model, v1Rest.id, { duration: 'h' })

      expect(stream(0)).toEqual(['nq@0', 'rh@1', 'rq@3']) // sums to the bar
      expect(stream(1)).toEqual(['nq@0', 'rq@1', 'rh@2']) // completely unchanged
      expect(model.getNotesInMeasure(1).every(n => fracToNumber(n.beat) < 4)).toBe(true)
    })

    it('lengthening a note in voice 2 does not disturb voice 1', () => {
      const v2Note = model.getNotesInMeasure(1).find(n => !n.isRest && n.voice === 1)!
      changeNote(model, v2Note.id, { duration: 'h' })
      expect(stream(0)).toEqual(['nq@0', 'rq@1', 'rh@2'])
      expect(stream(1)).toEqual(['nh@0', 'rh@2'])
    })
  })

  describe('inside a TUPLET', () => {
    let first: Note
    beforeEach(() => {
      // An eighth-note triplet over beat 0: three `8` members sounding 1/3 each.
      const tuplet = model.createTuplet(1, frac(0, 1), '8', 3, 2)!
      first = model.addNote({ step: 'C', alter: 0, octave: 4, duration: '8', measure: 1, beat: frac(0, 1), tupletId: tuplet.id })
    })

    it('a longer member covers the slots it now spans, and commits as "Update tuplet note"', () => {
      const { note, commit } = changeNote(model, first.id, { duration: 'q' })
      expect(commit).toBe('Update tuplet note')
      expect(note.duration).toBe('q')
      const members = model.getNotesInMeasure(1).filter(n => n.tupletId === first.tupletId)
      expect(members.map(n => fracToNumber(n.beat).toFixed(3))).toEqual(['0.000', '0.667'])
      model.repairAllMeasureGaps()
    })

    it('is CLAMPED to what the group has left — a half asked of an eighth triplet becomes a quarter', () => {
      const { note } = changeNote(model, first.id, { duration: 'h', dots: 1 })
      expect(note).toMatchObject({ duration: 'q', dots: 0 })
      model.repairAllMeasureGaps()
    })
  })
})

describe('findLargestFittingDuration', () => {
  it('the largest plain value that fits, or null', () => {
    expect(findLargestFittingDuration(3)).toBe('h')
    expect(findLargestFittingDuration(1)).toBe('q')
    expect(findLargestFittingDuration(0.1)).toBeNull()
  })
})
