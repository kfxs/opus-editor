/**
 * {@link trillOps} — what a trill will and will not anchor to, and what music it covers.
 *
 * Two chapters, and they answer two different questions the plan had to decide rather than look up:
 *
 *  - **The refusals.** A trill is a sign ON one note plus a duration, so it refuses a rest and a
 *    FANNED MEMBER (docs/trill-plan.md §2.2 — the codebase says two things about members, and this
 *    is the one a trill takes). It is idempotent, because a note carries at most one trill.
 *  - **The span.** An absent `endNoteId` is resolved through TIES, which is the engraving rule and
 *    the model's simplest case in one — a fact worth pinning, since it is the whole reason `Trill`
 *    needs no length field.
 *
 * A `ScoreModel` is the FIXTURE; what is under test is the free functions in `./trillOps`
 * (test-layout plan decision 4). ⚠️ Nothing here asserts a coordinate — where the sign and the wiggle
 * land is `e2e/trill.e2e.ts`'s, because jsdom measures every glyph as 0×0.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { ScoreModel } from './ScoreModel'
import type { Chord, FanMark, Note, NoteParams } from '@/types/music'
import { fracCreate as frac, fracToNumber } from '@/utils/fraction'

describe('trillOps — anchoring', () => {
  let model: ScoreModel
  let notes: Note[]

  const steps: Array<[NoteParams['step'], number]> = [['C', 4], ['D', 4], ['E', 4], ['F', 4]]

  beforeEach(() => {
    model = new ScoreModel() // measure 1, 4/4
    notes = steps.map(([step, octave], i) =>
      model.addNote({ step, alter: 0, octave, duration: 'q', measure: 1, beat: frac(i, 1) }),
    )
  })

  it('adds a trill on a note and finds it back by note and by id', () => {
    const trill = model.addTrill({ startNoteId: notes[0].id })
    expect(trill).not.toBeNull()
    expect(model.getTrills()).toHaveLength(1)
    expect(model.trillOnNote(notes[0].id)?.id).toBe(trill!.id)
    expect(model.getTrillById(trill!.id)).toBe(trill)
  })

  it('is IDEMPOTENT — a second add on the same note returns the first trill, not a second', () => {
    const first = model.addTrill({ startNoteId: notes[0].id })
    const again = model.addTrill({ startNoteId: notes[0].id, endNoteId: notes[2].id })
    expect(again).toBe(first)
    expect(model.getTrills()).toHaveLength(1)
  })

  it('refuses an unknown id', () => {
    expect(model.addTrill({ startNoteId: 'ghost' })).toBeNull()
    expect(model.getTrills()).toHaveLength(0)
  })

  it('refuses a REST — there is no trill without a note', () => {
    // Bar 2 is empty, so rest-fill gives it rests; take one of those slot ids.
    model.addMeasure()
    const rest = model.getNotesInMeasure(2).find(n => n.isRest)
    expect(rest).toBeDefined()
    expect(model.addTrill({ startNoteId: rest!.id })).toBeNull()
  })

  it('⭐ refuses a FANNED MEMBER (docs/trill-plan.md §2.2)', () => {
    const fan: FanMark = { direction: 'accel', count: 3, beams: 2 }
    expect(model.setFan(notes[0].id, fan)).not.toBeNull()
    const slot = model.getMeasure(1)!.slots.find(s => fracToNumber(s.beat) === 0) as Chord
    const memberId = (slot.fan!.members ?? [])[0]?.pitches[0]?.id
    expect(memberId).toBeDefined()
    expect(memberId).not.toBe(notes[0].id) // a member's own pitch, not the slot's
    expect(model.addTrill({ startNoteId: memberId! })).toBeNull()
    // …and the slot's own note still trills: refusing the member is not refusing the note.
    expect(model.addTrill({ startNoteId: notes[0].id })).not.toBeNull()
  })

  it('refuses an end that does not FOLLOW the start, and normalises end === start away', () => {
    expect(model.addTrill({ startNoteId: notes[2].id, endNoteId: notes[0].id })).toBeNull()
    const same = model.addTrill({ startNoteId: notes[1].id, endNoteId: notes[1].id })
    expect(same).not.toBeNull()
    expect(same!.endNoteId).toBeUndefined() // the one-note trill, spelled by omission
  })

  it('removes by id', () => {
    const trill = model.addTrill({ startNoteId: notes[0].id })!
    expect(model.removeTrill(trill.id)).toBe(true)
    expect(model.removeTrill(trill.id)).toBe(false)
    expect(model.getTrills()).toHaveLength(0)
  })

  it('flips placement, defaulting to above', () => {
    const trill = model.addTrill({ startNoteId: notes[0].id })!
    // ⭐ Absent means ABOVE, so the first flip goes DOWN — a trill sits above the notes unless the
    // staff carries more than one voice (docs/trill-plan.md §1 rule 2).
    expect(trill.placement).toBeUndefined()
    expect(model.toggleTrillPlacement(trill.id)).toBe('below')
    expect(model.toggleTrillPlacement(trill.id)).toBe('above')
    expect(model.getTrillById(trill.id)!.placement).toBe('above')
  })

  it('⭐ the continuation LABEL defaults to `(tr)` by ABSENCE, not by storing the string', () => {
    const trill = model.addTrill({ startNoteId: notes[0].id })!
    expect(trill.continuationLabel).toBeUndefined()

    expect(model.setTrillContinuationLabel(trill.id, 'plain')).toBe(true)
    expect(model.getTrillById(trill.id)!.continuationLabel).toBe('plain')
    expect(model.setTrillContinuationLabel(trill.id, 'none')).toBe(true)
    expect(model.getTrillById(trill.id)!.continuationLabel).toBe('none')

    // ⭐ Setting the DEFAULT clears the field rather than writing it — so a score full of ordinary
    // trills carries no `continuationLabel` at all, and a future score-wide preset can move the
    // default without rewriting every one of them.
    expect(model.setTrillContinuationLabel(trill.id, 'parenthesised')).toBe(true)
    expect('continuationLabel' in model.getTrillById(trill.id)!).toBe(false)
  })

  it('setting the label on an unknown trill answers false', () => {
    expect(model.setTrillContinuationLabel('ghost', 'plain')).toBe(false)
  })

  it('flipping an unknown trill answers null rather than throwing', () => {
    expect(model.toggleTrillPlacement('ghost')).toBeNull()
  })

  it('setTrillEnd re-anchors, refuses a backwards end, and clears back to the one-note trill', () => {
    const trill = model.addTrill({ startNoteId: notes[0].id })!
    expect(model.setTrillEnd(trill.id, notes[2].id)).toBe(true)
    expect(model.getTrillById(trill.id)!.endNoteId).toBe(notes[2].id)
    // Backwards is a mis-resolved end, not a short trill.
    expect(model.setTrillEnd(trill.id, notes[0].id)).toBe(true) // === start → clears
    expect(model.getTrillById(trill.id)!.endNoteId).toBeUndefined()
    expect(model.setTrillEnd(trill.id, null)).toBe(true)
    expect(model.setTrillEnd('ghost', notes[1].id)).toBe(false)
  })
})

describe('trillOps.trillSpan — what the trill actually covers', () => {
  let model: ScoreModel
  let notes: Note[]

  beforeEach(() => {
    model = new ScoreModel()
    model.addMeasure()
    notes = ([['C', 4], ['D', 4], ['E', 4], ['F', 4]] as Array<[NoteParams['step'], number]>).map(
      ([step, octave], i) =>
        model.addNote({ step, alter: 0, octave, duration: 'q', measure: 1, beat: frac(i, 1) }),
    )
  })

  // ⚠️ The span says WHAT IS COVERED, and nothing about whether a line draws — the wiggle always
  // does (his call, 2026-08-13; see the note on `TrillSpan`). A one-note trill is a one-slot span.
  it('a lone trill covers exactly its own note', () => {
    const trill = model.addTrill({ startNoteId: notes[1].id })!
    const span = model.trillSpan(trill.id)!
    expect(span.slotIds).toHaveLength(1)
    expect(span.startMeasure).toBe(1)
    expect(span.endMeasure).toBe(1)
  })

  it('an explicit end covers every note between', () => {
    const trill = model.addTrill({ startNoteId: notes[0].id, endNoteId: notes[3].id })!
    const span = model.trillSpan(trill.id)!
    expect(span.slotIds).toHaveLength(4)
  })

  it('⭐ an ABSENT end follows the TIES — the rule that makes the length field unnecessary', () => {
    model.updateNote(notes[0].id, { tiedTo: notes[1].id })
    const trill = model.addTrill({ startNoteId: notes[0].id })!
    const span = model.trillSpan(trill.id)!
    expect(span.slotIds).toHaveLength(2) // the tied pair, not just the first note
    expect(span.slotIds[0]).toBe(model.slotIdForNote(notes[0].id))
  })

  it('an EXPLICIT end wins over the tie chase — the user said where it stops', () => {
    model.updateNote(notes[0].id, { tiedTo: notes[1].id })
    const trill = model.addTrill({ startNoteId: notes[0].id, endNoteId: notes[3].id })!
    expect(model.trillSpan(trill.id)!.slotIds).toHaveLength(4)
  })

  it('returns null for a trill that is not there', () => {
    expect(model.trillSpan('ghost')).toBeNull()
  })
})

describe('⭐⭐ trillOps.trillAuxiliaryOf — P1\'s done-when, end to end', () => {
  let model: ScoreModel

  beforeEach(() => { model = new ScoreModel() })

  it('a trill on E reports F natural, printing nothing, in an empty bar', () => {
    const e = model.addNote({ step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    const trill = model.addTrill({ startNoteId: e.id })!
    expect(model.trillAuxiliaryOf(trill.id)).toEqual({ step: 'F', alter: 0, octave: 4, accidental: null })
  })

  it('⭐ a trill on E in a bar with an earlier F♯ reports F♯ AND "print the accidental"', () => {
    model.addNote({ step: 'F', alter: 1, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    const e = model.addNote({ step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
    const trill = model.addTrill({ startNoteId: e.id })!
    expect(model.trillAuxiliaryOf(trill.id)).toEqual({ step: 'F', alter: 1, octave: 4, accidental: '#' })
  })

  it('reads accidentals from ANOTHER VOICE in the same bar — an accidental holds by position', () => {
    model.addNote({ step: 'F', alter: 1, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1), voice: 1 })
    const e = model.addNote({ step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
    const trill = model.addTrill({ startNoteId: e.id })!
    expect(model.trillAuxiliaryOf(trill.id)!.alter).toBe(1)
  })

  it('does NOT read an accidental that comes LATER in the bar', () => {
    const e = model.addNote({ step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    model.addNote({ step: 'F', alter: 1, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
    const trill = model.addTrill({ startNoteId: e.id })!
    expect(model.trillAuxiliaryOf(trill.id)!.alter).toBe(0)
  })

  it('does NOT carry an accidental across the barline', () => {
    model.addNote({ step: 'F', alter: 1, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    model.addMeasure()
    const e = model.addNote({ step: 'E', alter: 0, octave: 4, duration: 'q', measure: 2, beat: frac(0, 1) })
    const trill = model.addTrill({ startNoteId: e.id })!
    expect(model.trillAuxiliaryOf(trill.id)).toEqual({ step: 'F', alter: 0, octave: 4, accidental: null })
  })

  it('returns null for a trill that is not there', () => {
    expect(model.trillAuxiliaryOf('ghost')).toBeNull()
  })
})

describe('trillOps — the dangling sweep (removeMeasure)', () => {
  // `repairDanglingTrills` is the BELT, not the mechanism (docs/trill-plan.md §2.1) — but deleting a
  // bar outright is the one path where it IS the whole answer, since nothing was captured.
  let model: ScoreModel

  beforeEach(() => {
    model = new ScoreModel()
    model.addMeasure()
  })

  const noteIn = (m: number, step: NoteParams['step']) =>
    model.addNote({ step, alter: 0, octave: 4, duration: 'q', measure: m, beat: frac(0, 1) })

  it('drops a trill whose SIGN was in the deleted bar', () => {
    const gone = noteIn(2, 'C')
    const trill = model.addTrill({ startNoteId: gone.id })!
    model.removeMeasure(2)
    expect(model.getTrillById(trill.id)).toBeNull()
  })

  it('⭐ DEGRADES a trill whose END was in the deleted bar — the sign is still true', () => {
    const start = noteIn(1, 'C')
    const end = noteIn(2, 'E')
    const trill = model.addTrill({ startNoteId: start.id, endNoteId: end.id })!
    model.removeMeasure(2)
    const live = model.getTrillById(trill.id)
    expect(live).not.toBeNull()
    expect(live!.startNoteId).toBe(start.id)
    expect(live!.endNoteId).toBeUndefined() // the line went; the ornament did not
  })
})

describe('trills round-trip through JSON', () => {
  // Serialization is `JSON.stringify(score)` whole-value, so a new optional field costs nothing —
  // but that is a property of the CURRENT serializer, and this pins it (docs/no-json-migration).
  it('survives export → import with both anchors and its side', () => {
    const model = new ScoreModel()
    const a = model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    const b = model.addNote({ step: 'D', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
    const trill = model.addTrill({ startNoteId: a.id, endNoteId: b.id, voice: 0, placement: 'below' })!

    const back = ScoreModel.fromJSON(model.toJSON())
    const loaded = back.getTrills()
    expect(loaded).toHaveLength(1)
    expect(loaded[0]).toEqual(trill)
    // …and the anchors still resolve on the loaded score, which is what makes it a round trip
    // rather than a byte-for-byte comparison that would pass on a dangling id.
    expect(back.trillSpan(loaded[0].id)!.slotIds).toHaveLength(2)
  })

  it('a score with no trills serializes no `trills` key (backward-compatible JSON)', () => {
    const model = new ScoreModel()
    expect(JSON.parse(model.toJSON()).trills).toBeUndefined()
  })
})

/**
 * ⭐⭐ THE BARE `tr` — `setTrillExtension`, his ask of 2026-08-18.
 *
 * The claim under test is the INVARIANT, not the flag: `'none'` and an `endNoteId` cannot both be
 * held, because the wavy line is the only thing that would have said how long to keep trilling.
 */
describe('trillOps — the bare tr', () => {
  let model: ScoreModel
  let notes: Note[]
  let trillId: string

  beforeEach(() => {
    model = new ScoreModel()
    notes = ([['C', 4], ['D', 4], ['E', 4]] as Array<[NoteParams['step'], number]>)
      .map(([step, octave], i) =>
        model.addNote({ step, octave, alter: 0, duration: 'q', measure: 1, beat: frac(i, 1) })!)
    trillId = model.addTrill({ startNoteId: notes[0].id })!.id
  })
  const trill = () => model.getTrillById(trillId)!

  it('turns the line off and back on, and reports whether anything changed', () => {
    expect(model.setTrillExtension(trillId, 'none')).toBe(true)
    expect(trill().extension).toBe('none')
    expect(model.setTrillExtension(trillId, 'none'), 'already off').toBe(false)
    expect(model.setTrillExtension(trillId, undefined)).toBe(true)
    expect('extension' in trill(), 'DELETED, ⛔ not set to undefined').toBe(false)
  })

  it('⛔ turning it off CLEARS an explicit end — the two contradict', () => {
    model.setTrillEnd(trillId, notes[2].id)
    expect(trill().endNoteId).toBe(notes[2].id)
    model.setTrillExtension(trillId, 'none')
    expect(trill().endNoteId, 'a bare tr cannot also claim a run of notes').toBeUndefined()
  })

  it('⛔ …and giving it an end puts the line BACK', () => {
    model.setTrillExtension(trillId, 'none')
    model.setTrillEnd(trillId, notes[2].id)
    expect(trill().extension, 'the line is what says how long').toBeUndefined()
    expect(trill().endNoteId).toBe(notes[2].id)
  })

  it('is false for an unknown id', () => {
    expect(model.setTrillExtension('nope', 'none')).toBe(false)
  })
})
