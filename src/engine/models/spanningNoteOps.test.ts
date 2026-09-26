/**
 * A NOTE THAT SPANS A BARLINE — {@link splitExistingNoteWithTie} / {@link addSplitNoteWithTie} (the
 * two callers of `placeSpanningNote`: a reused head, a fresh one) and the EROSION of what the chain
 * lands on in the next bar. Through a real `ScoreModel`, which is what answers `SpanningNoteModel`.
 * Moved out of `NoteEntryCoordinator.test.ts` with the module (code-shape plan, Phase 4.2).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { ScoreModel } from './ScoreModel'
import { fracCreate as frac, fracToNumber } from '@/utils/fraction'
import { addSplitNoteWithTie, splitChordWithTie, splitExistingNoteWithTie } from './spanningNoteOps'

describe('splitExistingNoteWithTie — a duration change that overflows the bar', () => {
  let scoreModel: ScoreModel

  beforeEach(() => {
    scoreModel = new ScoreModel('Test')
    // Ensure we have 2 measures
    scoreModel.addMeasure()
  })

  it('splits a note at beat 0 into the next measure (basic case)', () => {
    // Add a quarter note at beat 0 in measure 1
    const note = scoreModel.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })

    // Request a whole note (4 beats) — only 4 available but note is at beat 0, so no overflow...
    // Let's put it at beat 2 so 2 beats remain, then request a whole note (4 beats) → overflow 2 beats
    scoreModel.deleteNote(note.id)
    const note2 = scoreModel.addNote({ step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(2, 1) })

    splitExistingNoteWithTie(scoreModel, note2, 'w', 2) // whole = 4b, available = 2b, overflow = 2b

    const m1Notes = scoreModel.getNotesInMeasure(1).filter(n => !n.isRest)
    const m2Notes = scoreModel.getNotesInMeasure(2).filter(n => !n.isRest)

    // Current measure: 2 beats remaining → half note
    expect(m1Notes).toHaveLength(1)
    expect(m1Notes[0].duration).toBe('h')
    expect(m1Notes[0].step).toBe('E')

    // Next measure: 2 beats → half note
    expect(m2Notes).toHaveLength(1)
    expect(m2Notes[0].duration).toBe('h')
    expect(m2Notes[0].step).toBe('E')

    // Tied together
    expect(m1Notes[0].tiedTo).toBe(m2Notes[0].id)
    expect(m2Notes[0].tiedFrom).toBe(m1Notes[0].id)
  })

  it('spans 3 remaining beats with ONE dotted half, not a half tied to a quarter', () => {
    // Note at beat 1 in 4/4 → 3 beats remain. Request whole (4 beats) → overflow = 1 beat.
    // splitBeatsIntoLengths(3) = [h.], splitBeatsIntoLengths(1) = [q] — the FEWEST values that span
    // it, dots included. It was ['h','q'], which cost an extra note and an extra tie for nothing.
    const note = scoreModel.addNote({ step: 'G', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })

    splitExistingNoteWithTie(scoreModel, note, 'w', 1) // overflow = 1 beat

    const m1Notes = scoreModel.getNotesInMeasure(1).filter(n => !n.isRest && n.step === 'G')
    const m2Notes = scoreModel.getNotesInMeasure(2).filter(n => !n.isRest && n.step === 'G')

    // 3 beats in the current measure: ONE dotted half
    expect(m1Notes).toHaveLength(1)
    expect(m1Notes[0].duration).toBe('h')
    expect(m1Notes[0].dots).toBe(1)

    // 1 beat in the next measure: a quarter
    expect(m2Notes).toHaveLength(1)
    expect(m2Notes[0].duration).toBe('q')

    // ONE tie now, not two: dotted half → quarter
    expect(m1Notes[0].tiedTo).toBe(m2Notes[0].id)
    expect(m2Notes[0].tiedFrom).toBe(m1Notes[0].id)
    expect(m2Notes[0].tiedTo).toBeUndefined()
  })

  it('creates the next measure automatically if it does not exist', () => {
    // ScoreModel starts with 1 measure; remove the extra one we added
    const freshModel = new ScoreModel('Test')
    expect(freshModel.getScore().measures).toHaveLength(1)

    const note = freshModel.addNote({ step: 'A', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(2, 1) })
    splitExistingNoteWithTie(freshModel, note, 'w', 2)

    expect(freshModel.getScore().measures).toHaveLength(2)
    const m2Notes = freshModel.getNotesInMeasure(2).filter(n => !n.isRest)
    expect(m2Notes).toHaveLength(1)
  })

  it('displaces existing content in the next measure (MuseScore-style)', () => {
    // Pre-fill measure 2 with a quarter note
    scoreModel.addNote({ step: 'D', alter: 0, octave: 4, duration: 'q', measure: 2, beat: frac(0, 1) })

    const note = scoreModel.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(2, 1) })
    splitExistingNoteWithTie(scoreModel, note, 'w', 2) // overflow 2 beats into m2

    // The D in measure 2 should be gone; the tied C continuation should be there instead
    const m2Notes = scoreModel.getNotesInMeasure(2).filter(n => !n.isRest)
    expect(m2Notes.every(n => n.step !== 'D')).toBe(true)
    expect(m2Notes.some(n => n.step === 'C')).toBe(true)
  })
})

describe('erodeOverflowZone — Sibelius-style erosion of what the chain lands on', () => {
  let scoreModel: ScoreModel

  beforeEach(() => {
    scoreModel = new ScoreModel('Test')
    scoreModel.addMeasure()
  })

  it('trims a straddling note instead of deleting it (headline case)', () => {
    // 4/4: E4q at beat 2 → dotted half (3 beats). Overflow = 1 beat.
    // G4h at beat 0 in M2 straddles: remainder = 2 - 1 = 1 beat → G4q at beat 1
    scoreModel.addNote({ step: 'G', alter: 0, octave: 4, duration: 'h', measure: 2, beat: frac(0, 1) })
    scoreModel.addNote({ step: 'A', alter: 0, octave: 4, duration: 'h', measure: 2, beat: frac(2, 1) })
    const note = scoreModel.addNote({ step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(2, 1) })

    splitExistingNoteWithTie(scoreModel, note, 'h', 1) // 2b available, overflow = 1b → M2 gets E4q

    const m2NonRest = scoreModel.getNotesInMeasure(2).filter(n => !n.isRest)
    const g4 = m2NonRest.find(n => n.step === 'G')
    const a4 = m2NonRest.find(n => n.step === 'A')

    // G4 must survive, trimmed to quarter, moved to beat 1
    expect(g4).toBeDefined()
    expect(g4!.duration).toBe('q')
    expect(fracToNumber(g4!.beat)).toBeCloseTo(1)

    // A4 untouched
    expect(a4).toBeDefined()
    expect(a4!.duration).toBe('h')
    expect(fracToNumber(a4!.beat)).toBeCloseTo(2)
  })

  it('deletes a note fully consumed by the overflow zone', () => {
    // G4q at beat 0 in M2, overflow = 2 beats → G4q entirely within [0,2), deleted
    scoreModel.addNote({ step: 'G', alter: 0, octave: 4, duration: 'q', measure: 2, beat: frac(0, 1) })
    const note = scoreModel.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(2, 1) })

    splitExistingNoteWithTie(scoreModel, note, 'w', 2) // overflow = 2 beats

    const m2NonRest = scoreModel.getNotesInMeasure(2).filter(n => !n.isRest)
    expect(m2NonRest.every(n => n.step !== 'G')).toBe(true)
  })

  it('writes a trimmed 3-beat remainder as ONE dotted half', () => {
    // G4 whole at beat 0 in M2, overflow = 1 beat → remainder = 3 beats. That is a dotted half at
    // beat 1, not h + q tied (the old plain-only split — see splitBeatsIntoLengths).
    scoreModel.addNote({ step: 'G', alter: 0, octave: 4, duration: 'w', measure: 2, beat: frac(0, 1) })
    const note = scoreModel.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(3, 1) })

    splitExistingNoteWithTie(scoreModel, note, 'h', 1) // 1b available, overflow = 1b

    const m2G = scoreModel.getNotesInMeasure(2).filter(n => !n.isRest && n.step === 'G')
    expect(m2G).toHaveLength(1)
    expect(m2G[0].duration).toBe('h')
    expect(m2G[0].dots).toBe(1)
    expect(fracToNumber(m2G[0].beat)).toBeCloseTo(1)
    expect(m2G[0].tiedTo).toBeUndefined() // one value, so nothing to tie it to
  })

  it('breaks the upstream tiedFrom pointer when eroding a note that has tiedFrom', () => {
    // G4h in M2 is the tied continuation of G4h in M1
    const g4m1 = scoreModel.addNote({ step: 'G', alter: 0, octave: 4, duration: 'h', measure: 1, beat: frac(0, 1) })
    const g4m2 = scoreModel.addNote({ step: 'G', alter: 0, octave: 4, duration: 'h', measure: 2, beat: frac(0, 1) })
    scoreModel.updateNote(g4m1.id, { tiedTo: g4m2.id })
    scoreModel.updateNote(g4m2.id, { tiedFrom: g4m1.id })

    // Now enter C4 at beat 2 M1 extended to whole → overflow 2 beats, erodes G4m2
    const note = scoreModel.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(2, 1) })
    splitExistingNoteWithTie(scoreModel, note, 'w', 2) // overflow = 2 beats, G4h fully consumed

    // Upstream tie pointer on G4m1 should be cleared
    const updated = scoreModel.getNote(g4m1.id)
    expect(updated?.tiedTo).toBeUndefined()
  })

  it('falls back to deletion when the note to erode has a downstream tiedTo', () => {
    // G4h in M2 is itself tied forward to G4q in M2
    const g4head = scoreModel.addNote({ step: 'G', alter: 0, octave: 4, duration: 'h', measure: 2, beat: frac(0, 1) })
    const g4tail = scoreModel.addNote({ step: 'G', alter: 0, octave: 4, duration: 'q', measure: 2, beat: frac(2, 1) })
    scoreModel.updateNote(g4head.id, { tiedTo: g4tail.id })
    scoreModel.updateNote(g4tail.id, { tiedFrom: g4head.id })

    const note = scoreModel.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(2, 1) })
    splitExistingNoteWithTie(scoreModel, note, 'h', 1) // overflow = 1 beat, G4h straddles

    // G4head must be deleted (punt case), not trimmed
    const m2NonRest = scoreModel.getNotesInMeasure(2).filter(n => !n.isRest)
    expect(m2NonRest.every(n => n.step !== 'G' || n.id === g4tail.id)).toBe(true)
  })

  it('erodes for an ENTERED note too — the fresh-head caller (addSplitNoteWithTie)', () => {
    // Same headline scenario, with the chain's head made fresh rather than reused.
    scoreModel.addNote({ step: 'G', alter: 0, octave: 4, duration: 'h', measure: 2, beat: frac(0, 1) })
    scoreModel.addNote({ step: 'A', alter: 0, octave: 4, duration: 'h', measure: 2, beat: frac(2, 1) })

    // Fill M1 so beat 2 is a rest: add notes at 0 and 1
    scoreModel.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    scoreModel.addNote({ step: 'D', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })

    // Enter E4 dotted-half (3 beats) at beat 2 — overflow 1 beat, should erode G4h → G4q
    const head = addSplitNoteWithTie(scoreModel, {
      step: 'E', alter: 0, octave: 4, duration: 'h', dots: 1, measure: 1, beat: frac(2, 1),
    }, 1)
    expect(head?.measure).toBe(1)
    // ⚠️ The answer is a flat SNAPSHOT taken before the tie was attached — ask the model.
    expect(scoreModel.getNote(head!.id)!.tiedTo).toBeTruthy()

    const m2NonRest = scoreModel.getNotesInMeasure(2).filter(n => !n.isRest)
    const g4 = m2NonRest.find(n => n.step === 'G')
    expect(g4).toBeDefined()
    expect(g4!.duration).toBe('q')
    expect(fracToNumber(g4!.beat)).toBeCloseTo(1)
  })

  it('handles mixed overflow zone: fully-consumed note deleted, straddling note trimmed', () => {
    // M2: G4q at beat 0 (fully consumed), A4h at beat 1 (straddles). Overflow = 2 beats.
    // A4h: start=1, end=3, overflow=2 → remainder = 3-2 = 1b → A4q at beat 2
    scoreModel.addNote({ step: 'G', alter: 0, octave: 4, duration: 'q', measure: 2, beat: frac(0, 1) })
    scoreModel.addNote({ step: 'A', alter: 0, octave: 4, duration: 'h', measure: 2, beat: frac(1, 1) })
    const note = scoreModel.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(2, 1) })

    splitExistingNoteWithTie(scoreModel, note, 'w', 2) // overflow = 2 beats

    const m2NonRest = scoreModel.getNotesInMeasure(2).filter(n => !n.isRest)
    expect(m2NonRest.every(n => n.step !== 'G')).toBe(true) // G4q deleted
    const a4 = m2NonRest.find(n => n.step === 'A')
    expect(a4).toBeDefined()
    expect(a4!.duration).toBe('q')
    expect(fracToNumber(a4!.beat)).toBeCloseTo(2)
  })
  it('⭐ erodes only the overflowing note\'s own VOICE and STAFF — other streams are independent', () => {
    scoreModel.addStaffBelow(0)
    const v2 = scoreModel.addNote({ step: 'G', alter: 0, octave: 4, duration: 'h', measure: 2, beat: frac(0, 1), voice: 1 })
    const low = scoreModel.addNote({ step: 'C', alter: 0, octave: 3, duration: 'h', measure: 2, beat: frac(0, 1), staff: 1 })
    const note = scoreModel.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(2, 1) })

    splitExistingNoteWithTie(scoreModel, note, 'w', 2) // 2 beats land on bar 2, voice 0, staff 0

    for (const kept of [v2, low]) {
      expect(scoreModel.getNote(kept.id)).toMatchObject({ duration: 'h' })
      expect(fracToNumber(scoreModel.getNote(kept.id)!.beat)).toBe(0)
    }
  })
})

describe('splitChordWithTie — a chord crosses the barline together', () => {
  let scoreModel: ScoreModel
  beforeEach(() => {
    scoreModel = new ScoreModel('Test')
    scoreModel.addMeasure()
  })

  const head = (step: 'C' | 'E' | 'G') =>
    scoreModel.addNote({ step, alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(2, 1) })
  const continuationOf = (id: string) => scoreModel.getNote(scoreModel.getNote(id)!.tiedTo!)

  it('⭐ EVERY head keeps its continuation — an erosion spares the slot\'s own pieces', () => {
    // The bug: each head's split eroded bar 2 first, deleting the piece the previous head had just
    // placed there, so only the LAST head split stayed tied.
    const heads = [head('C'), head('E'), head('G')]
    splitChordWithTie(scoreModel, heads, 'w', 2)

    for (const h of heads) {
      expect(scoreModel.getNote(h.id)!.duration).toBe('h')
      expect(continuationOf(h.id)).toMatchObject({ measure: 2, duration: 'h', step: h.step, tiedFrom: h.id })
    }
    scoreModel.repairAllMeasureGaps() // both bars exactly full
  })

  it('…and what stood in the zone BEFORE the chord arrived is still eroded', () => {
    const foreign = scoreModel.addNote({ step: 'A', alter: 0, octave: 4, duration: 'h', measure: 2, beat: frac(0, 1) })
    splitChordWithTie(scoreModel, [head('C'), head('E')], 'w', 2)
    expect(scoreModel.getNote(foreign.id)).toBeFalsy()
    expect(scoreModel.getNotesInMeasure(2).filter(n => !n.isRest).map(n => n.step).sort()).toEqual(['C', 'E'])
  })

  it('⭐ a chord built ONE CLICK AT A TIME: the head already tied across keeps its continuation', () => {
    // The mouse path skips a head that is already tied (it has crossed already), so nothing but the
    // erosion's own rule protects its piece in bar 2.
    const entered = (step: 'C' | 'E') =>
      addSplitNoteWithTie(scoreModel, { step, alter: 0, octave: 4, duration: 'w', measure: 1, beat: frac(2, 1) }, 2)!
    const c = entered('C')
    const e = entered('E')
    for (const h of [c, e]) expect(continuationOf(h.id)).toMatchObject({ measure: 2, duration: 'h', step: h.step })
    scoreModel.repairAllMeasureGaps()
  })

  it('⚠️ a head being RE-SPLIT is not spared — its old continuation is what the new chain replaces', () => {
    const c = head('C')
    splitExistingNoteWithTie(scoreModel, c, 'w', 2)                    // h | h
    splitExistingNoteWithTie(scoreModel, scoreModel.getNote(c.id)!, 'w', 4, 1) // dotted whole: h | w
    const pieces = scoreModel.getNotesInMeasure(2).filter(n => !n.isRest)
    expect(pieces.map(n => `${n.step}${n.duration}`)).toEqual(['Cw']) // the old `h` went; no duplicate
    expect(pieces[0].tiedFrom).toBe(c.id)
  })

  it('⭐ an ENTERED note in brackets carries them to EVERY piece, as its tremolo does (parenthesised-note-plan P4b)', () => {
    const model = new ScoreModel()
    model.addMeasure()
    model.addNote({ step: 'C', octave: 5, duration: 'h', measure: 1, beat: frac(0, 1) })
    model.addNote({ step: 'C', octave: 5, duration: 'q', measure: 1, beat: frac(2, 1) })
    const head = addSplitNoteWithTie(model, { step: 'E', octave: 5, duration: 'h', measure: 1, beat: frac(3, 1), enclosure: 'round' }, 1)!
    expect(model.getNote(head.id)!.enclosure).toBe('round')
    expect(model.getNote(model.getNote(head.id)!.tiedTo!)!.enclosure).toBe('round')
  })
})


/**
 * ⭐ MORE THAN ONE BARLINE (docs/plans/other-durations-plan.md §3b, 2026-09-26). The whole overflow used to go
 * into the NEXT bar however long it was: a whole note from beat 1 of 2/4 wrote a dotted half into a 2-beat
 * bar, and a longa in 4/4 a dotted breve. Each following bar now takes what its OWN capacity holds.
 */
describe('placeSpanningNote — across several barlines, bar by bar', () => {
  /** One voice's notes (not rests) in a bar, as `C:q~@0` — pitch, duration + dots, tie, beat. */
  const chain = (model: ScoreModel, measure: number) => model.getNotesInMeasure(measure).filter(n => !n.isRest)
    .map(n => `${n.step}:${n.duration}${'.'.repeat(n.dots ?? 0)}${n.tiedTo ? '~' : ''}@${fracToNumber(n.beat)}`)

  function score(bars: number, ts?: { numerator: number; denominator: number }): ScoreModel {
    const model = new ScoreModel('Test')
    if (ts) model.setTimeSignature(1, ts)
    for (let i = 1; i < bars; i++) model.addMeasure()
    return model
  }

  it('⭐ a LONGA entered at beat 0 of 4/4 is four tied wholes, one per bar', () => {
    const model = score(4)
    addSplitNoteWithTie(model, { step: 'C', alter: 0, octave: 5, duration: 'longa', measure: 1, beat: frac(0, 1) }, 12)
    expect([1, 2, 3, 4].map(m => chain(model, m))).toEqual([['C:w~@0'], ['C:w~@0'], ['C:w~@0'], ['C:w@0']])
  })

  it('⭐ a WHOLE entered at beat 1 of 2/4 is a quarter, a half and a quarter — ⛔ never a dotted half in a 2-beat bar', () => {
    const model = score(3, { numerator: 2, denominator: 4 })
    addSplitNoteWithTie(model, { step: 'C', alter: 0, octave: 5, duration: 'w', measure: 1, beat: frac(1, 1) }, 3)
    expect([1, 2, 3].map(m => chain(model, m))).toEqual([['C:q~@1'], ['C:h~@0'], ['C:q@0']])
  })

  it('creates every bar the chain needs', () => {
    const model = new ScoreModel('Test')
    addSplitNoteWithTie(model, { step: 'C', alter: 0, octave: 5, duration: 'longa', measure: 1, beat: frac(0, 1) }, 12)
    expect(model.getScore().measures).toHaveLength(4)
  })

  it('⭐ each bar takes ITS OWN capacity — a 4/4 bar, then a 2/4 bar, then the rest', () => {
    const model = score(4)
    model.setTimeSignature(2, { numerator: 2, denominator: 4 }, { extent: 'measure' })
    addSplitNoteWithTie(model, { step: 'C', alter: 0, octave: 5, duration: 'breve', measure: 1, beat: frac(2, 1) }, 6)
    // 2 beats left in bar 1, bar 2 holds 2, bar 3 (4/4 again) the last 4.
    expect([1, 2, 3].map(m => chain(model, m))).toEqual([['C:h~@2'], ['C:h~@0'], ['C:w@0']])
  })

  it('⭐ what the chain covers in a MIDDLE bar is cleared too — its own voice only', () => {
    const model = score(3)
    model.addNote({ step: 'D', alter: 0, octave: 4, duration: 'h', measure: 2, beat: frac(0, 1) })
    model.addNote({ step: 'F', alter: 0, octave: 4, duration: 'h', measure: 2, beat: frac(2, 1) })
    model.addNote({ step: 'A', alter: 0, octave: 3, duration: 'w', measure: 2, beat: frac(0, 1), voice: 1 })
    addSplitNoteWithTie(model, { step: 'C', alter: 0, octave: 5, duration: 'breve', measure: 1, beat: frac(2, 1) }, 6)
    expect(chain(model, 2).filter(s => !s.startsWith('A'))).toEqual(['C:w~@0'])
    expect(chain(model, 2), 'the other voice stands').toContain('A:w@0')
    expect(chain(model, 3)).toEqual(['C:h@0'])
  })

  it('⭐ a DURATION CHANGE to a longa crosses every barline it reaches (the reused head)', () => {
    const model = score(4)
    const note = model.addNote({ step: 'E', alter: 0, octave: 5, duration: 'q', measure: 1, beat: frac(0, 1) })
    splitExistingNoteWithTie(model, note, 'longa', 12)
    expect([1, 2, 3, 4].map(m => chain(model, m))).toEqual([['E:w~@0'], ['E:w~@0'], ['E:w~@0'], ['E:w@0']])
    expect(model.getNote(note.id)?.duration, 'the head is the edited note').toBe('w')
  })

  it('⭐ a CHORD crosses three bars together — every head keeps every continuation', () => {
    const model = score(3)
    const c = model.addNote({ step: 'C', alter: 0, octave: 5, duration: 'q', measure: 1, beat: frac(2, 1) })
    const e = model.addNote({ step: 'E', alter: 0, octave: 5, duration: 'q', measure: 1, beat: frac(2, 1) })
    splitChordWithTie(model, [c, e], 'breve', 6)
    for (const m of [2, 3]) {
      expect(chain(model, m).map(s => s[0]).sort(), `bar ${m} holds both heads`).toEqual(['C', 'E'])
    }
  })

  it('one barline is exactly as before — a half left, a half over', () => {
    const model = score(2)
    addSplitNoteWithTie(model, { step: 'C', alter: 0, octave: 5, duration: 'w', measure: 1, beat: frac(2, 1) }, 2)
    expect([1, 2].map(m => chain(model, m))).toEqual([['C:h~@2'], ['C:h@0']])
  })
})
