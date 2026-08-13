/**
 * {@link voiceOps} — moving a note into another lane, and the repairs that implies.
 *
 * Three chapters, in the order the feature was built (docs/move-note-to-voice-plan.md): a plain
 * note (the lane change plus what travels with it — beam, tie, slur, tremolo), a COLLISION (the
 * target lane already sounds at that beat, and the shorter duration wins), and a note inside a
 * TUPLET (the group is atomic, so a matching tuplet is made in the target voice and the ordinal
 * slots are poured across).
 *
 * A `ScoreModel` is the FIXTURE — `moveNoteToVoice` is its delegator. Extracted from
 * `ScoreModel.test.ts` on 2026-07-28 by the modularity plan's Phase 3, under Phase 0's rule that
 * *a spec moves with its module*.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { ScoreModel } from './ScoreModel'
import type { ChordRest } from '@/types/music'
import { fracCreate as frac, fracCompare, fracToNumber } from '@/utils/fraction'

/** Slots in a measure, sorted by beat. */
function slotsOf(model: ScoreModel, measureNumber: number): ChordRest[] {
  return [...(model.getMeasure(measureNumber)?.slots ?? [])].sort((a, b) => fracCompare(a.beat, b.beat))
}

describe('ScoreModel.moveNoteToVoice — Phase 1 (plain notes)', () => {
  let model: ScoreModel
  beforeEach(() => { model = new ScoreModel('MV') })

  const v = (s: ChordRest) => s.voice ?? 0
  const total = (slots: ChordRest[]) =>
    slots.reduce((sum, s) => sum + fracToNumber(s.actualDuration!), 0)

  it('moves a plain note into another voice, keeping its pitch id', () => {
    const note = model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    expect(model.moveNoteToVoice(note.id, 1)).toBe(true)

    const slots = slotsOf(model, 1)
    const v1Chords = slots.filter(s => s.type === 'chord' && v(s) === 1)
    expect(v1Chords).toHaveLength(1)
    expect((v1Chords[0] as any).notes[0].id).toBe(note.id) // SAME id (the spine)
    expect(fracToNumber(v1Chords[0].beat)).toBe(0)

    // Source voice 0 left with rests only; both voices still sum to the bar.
    const v0 = slots.filter(s => v(s) === 0)
    expect(v0.every(s => s.type === 'rest')).toBe(true)
    expect(total(v0)).toBeCloseTo(4, 5)
    expect(total(slots.filter(s => v(s) === 1))).toBeCloseTo(4, 5)
  })

  it('collapses the source secondary voice when its last note leaves', () => {
    const note = model.addNote({ step: 'D', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1), voice: 1 })
    expect(model.moveNoteToVoice(note.id, 0)).toBe(true)

    const slots = slotsOf(model, 1)
    expect(slots.some(s => v(s) === 1)).toBe(false) // voice 1 collapsed away
    const moved = slots.find(s => s.type === 'chord') as any
    expect(moved.notes[0].id).toBe(note.id)
    expect(v(moved)).toBe(0)
  })

  it('carries the beam statement across the voice move', () => {
    const ids = [0, 1, 2, 3].map(i => model.addNote({
      step: 'C', alter: 0, octave: 4, duration: '8', measure: 1, beat: frac(i, 2),
    }).id)
    // Beam all four as one explicit group, with a secondary break in front of the third.
    model.updateNote(ids[0], { beam: 'begin' })
    model.updateNote(ids[1], { beam: 'continue' })
    model.updateNote(ids[2], { beam: 'continue', secondaryBreak: true })
    model.updateNote(ids[3], { beam: 'end' })

    for (const id of ids) expect(model.moveNoteToVoice(id, 1)).toBe(true)

    const moved = ids.map(id => model.getNote(id)!)
    expect(moved.map(n => n.voice ?? 0)).toEqual([1, 1, 1, 1])
    expect(moved.map(n => n.beam)).toEqual(['begin', 'continue', 'continue', 'end'])
    expect(moved.map(n => !!n.secondaryBreak)).toEqual([false, false, true, false])
  })

  it('is a no-op (returns false) when the note is already in the target voice', () => {
    const note = model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    expect(model.moveNoteToVoice(note.id, 0)).toBe(false)
  })

  it('moves just one pitch out of a chord, leaving the others behind', () => {
    const c = model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    const e = model.addNote({ step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    const g = model.addNote({ step: 'G', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })

    expect(model.moveNoteToVoice(g.id, 1)).toBe(true)

    const slots = slotsOf(model, 1)
    const v0Chord = slots.find(s => s.type === 'chord' && v(s) === 0) as any
    expect(v0Chord.notes.map((n: any) => n.id).sort()).toEqual([c.id, e.id].sort())
    const v1Chord = slots.find(s => s.type === 'chord' && v(s) === 1) as any
    expect(v1Chord.notes).toHaveLength(1)
    expect(v1Chord.notes[0].id).toBe(g.id)
  })

  it('drops a tie whose partner stays behind (both reciprocal sides cleared)', () => {
    const a = model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    const b = model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
    model.updateNote(a.id, { tiedTo: b.id })
    model.updateNote(b.id, { tiedFrom: a.id })

    expect(model.moveNoteToVoice(a.id, 1)).toBe(true)

    expect(model.getNote(a.id)!.tiedTo).toBeUndefined()
    expect(model.getNote(b.id)!.tiedFrom).toBeUndefined()
  })

  it('keeps a slur valid by preserving the moved note id', () => {
    const a = model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    const b = model.addNote({ step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
    const slur = model.addSlur({ startNoteId: a.id, endNoteId: b.id, voice: 0 })

    expect(model.moveNoteToVoice(a.id, 1)).toBe(true)

    const kept = model.getSlurs().find(s => s.id === slur.id)!
    expect(kept.startNoteId).toBe(a.id)
    expect(model.getNote(a.id)).toBeDefined() // anchor still resolves
  })

  it("syncs a slur's stored voice once BOTH its anchors have moved", () => {
    const a = model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    const b = model.addNote({ step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
    const slur = model.addSlur({ startNoteId: a.id, endNoteId: b.id, voice: 0 })

    model.moveNoteToVoice(a.id, 1)
    // Only one anchor moved → slur spans two voices → stored field left as-is.
    expect(model.getSlurs().find(s => s.id === slur.id)!.voice ?? 0).toBe(0)

    model.moveNoteToVoice(b.id, 1)
    // Both anchors now in voice 1 → the slur adopts it.
    expect(model.getSlurs().find(s => s.id === slur.id)!.voice).toBe(1)
  })

  it("syncs a TRILL's stored voice — with the one-note trill needing only ONE anchor to move", () => {
    const a = model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    const b = model.addNote({ step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
    const spanning = model.addTrill({ startNoteId: a.id, endNoteId: b.id, voice: 0 })!
    const lone = model.addTrill({ startNoteId: b.id, voice: 0 })!
    // (Both trills are on b, but only one names it as its START; `trillOnNote` keys on the start.)

    model.moveNoteToVoice(a.id, 1)
    // The SPANNING trill now straddles two voices → ambiguous, stored field left as-is.
    expect(model.getTrillById(spanning.id)!.voice ?? 0).toBe(0)

    model.moveNoteToVoice(b.id, 1)
    expect(model.getTrillById(spanning.id)!.voice).toBe(1)
    // ⭐ The ONE-NOTE trill has nothing to disagree with, so its one anchor moving is enough.
    expect(model.getTrillById(lone.id)!.voice).toBe(1)
  })

  it('ignores a rest id (returns false)', () => {
    const rest = slotsOf(model, 1).find(s => s.type === 'rest')!
    expect(model.moveNoteToVoice(rest.id, 1)).toBe(false)
  })
})

describe('ScoreModel.moveNoteToVoice — Phase 2 (collision: shorter wins)', () => {
  let model: ScoreModel
  beforeEach(() => { model = new ScoreModel('MV') })

  const v = (s: ChordRest) => s.voice ?? 0
  const total = (slots: ChordRest[]) =>
    slots.reduce((sum, s) => sum + fracToNumber(s.actualDuration!), 0)
  const v1ChordAt = (beat: number) =>
    slotsOf(model, 1).find(s => s.type === 'chord' && v(s) === 1 && fracToNumber(s.beat) === beat) as any

  it('chords with target when both share a beat; keeps the EXISTING shorter duration', () => {
    // Target voice 1 has a quarter at beat 1; move a voice-0 HALF onto it.
    model.addNote({ step: 'G', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1), voice: 1 })
    const half = model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'h', measure: 1, beat: frac(1, 1) })

    expect(model.moveNoteToVoice(half.id, 1)).toBe(true)

    const chord = v1ChordAt(1)
    expect(chord.notes).toHaveLength(2)                 // chorded
    expect(chord.notes.map((n: any) => n.id)).toContain(half.id)
    expect(chord.duration).toBe('q')                    // quarter (shorter) wins, half's extra length discarded
    expect(total(slotsOf(model, 1).filter(s => v(s) === 1))).toBeCloseTo(4, 5)
  })

  it('adopts the INCOMING shorter duration and rest-fills the freed time', () => {
    // Target voice 1 has a quarter at beat 0; move a voice-0 EIGHTH onto it.
    model.addNote({ step: 'G', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1), voice: 1 })
    const eighth = model.addNote({ step: 'C', alter: 0, octave: 4, duration: '8', measure: 1, beat: frac(0, 1) })

    expect(model.moveNoteToVoice(eighth.id, 1)).toBe(true)

    const chord = v1ChordAt(0)
    expect(chord.notes).toHaveLength(2)
    expect(chord.duration).toBe('8')                    // eighth (shorter) wins
    // Freed half-beat is now a voice-1 rest; the voice still sums to a full bar.
    const v1 = slotsOf(model, 1).filter(s => v(s) === 1)
    expect(v1.some(s => s.type === 'rest' && fracToNumber(s.beat) === 0.5)).toBe(true)
    expect(total(v1)).toBeCloseTo(4, 5)
  })

  it('equal durations just chord together, no extra rests', () => {
    model.addNote({ step: 'G', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1), voice: 1 })
    const q = model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })

    expect(model.moveNoteToVoice(q.id, 1)).toBe(true)

    const chord = v1ChordAt(0)
    expect(chord.notes).toHaveLength(2)
    expect(chord.duration).toBe('q')
    expect(total(slotsOf(model, 1).filter(s => v(s) === 1))).toBeCloseTo(4, 5)
  })
})

describe('ScoreModel.moveNoteToVoice — the OTHER lane axis (staff)', () => {
  let model: ScoreModel
  let lower: string
  beforeEach(() => {
    model = new ScoreModel('MV')
    lower = model.addStaffBelow(0)
  })

  const v = (s: ChordRest) => s.voice ?? 0
  const onStaff = (staffId: string | undefined) =>
    slotsOf(model, 1).filter(s => s.staffId === staffId)

  it('keeps a lower-staff note on ITS staff — a voice move is not a staff move', () => {
    const note = model.addNote({ step: 'A', alter: 0, octave: 3, duration: 'q', measure: 1, beat: frac(0, 1), staff: 1 })
    expect(model.moveNoteToVoice(note.id, 1)).toBe(true)

    const moved = onStaff(lower).find(s => s.type === 'chord') as any
    expect(moved).toBeDefined()
    expect(moved.notes[0].id).toBe(note.id)
    expect(v(moved)).toBe(1)
    // The upper staff never hears about it: no chord, and no voice-1 lane invented there.
    expect(onStaff(undefined).some(s => s.type === 'chord')).toBe(false)
    expect(onStaff(undefined).some(s => v(s) === 1)).toBe(false)
  })

  it('does not chord into a same-beat, same-voice note on the OTHER staff', () => {
    // Upper staff already sounds voice 1 at beat 0 — a different lane, not a collision.
    const upperNote = model.addNote({ step: 'C', alter: 0, octave: 5, duration: 'q', measure: 1, beat: frac(0, 1), voice: 1 })
    const lowerNote = model.addNote({ step: 'A', alter: 0, octave: 3, duration: 'q', measure: 1, beat: frac(0, 1), staff: 1 })

    expect(model.moveNoteToVoice(lowerNote.id, 1)).toBe(true)

    const upperChords = onStaff(undefined).filter(s => s.type === 'chord') as any[]
    expect(upperChords).toHaveLength(1)
    expect(upperChords[0].notes).toHaveLength(1)          // NOT merged
    expect(upperChords[0].notes[0].id).toBe(upperNote.id)
    const lowerChords = onStaff(lower).filter(s => s.type === 'chord') as any[]
    expect(lowerChords).toHaveLength(1)
    expect(lowerChords[0].notes[0].id).toBe(lowerNote.id)
    expect(v(lowerChords[0])).toBe(1)
  })
})

describe('ScoreModel.moveNoteToVoice — Phase 4 (tuplets, ordinal fill)', () => {
  let model: ScoreModel
  beforeEach(() => { model = new ScoreModel('MV') })

  const v = (s: ChordRest) => s.voice ?? 0
  const tupletChords = (voice: number) =>
    slotsOf(model, 1).filter(s => s.type === 'chord' && v(s) === voice && s.tupletId) as any[]

  /** Build a full eighth-triplet (3 notes) in `voice` at beat 0; returns the 3 pitch ids. */
  function buildTriplet(voice: number, steps: Array<{ step: string; octave: number }>): string[] {
    const t = model.createTuplet(1, frac(0, 1), '8', 3, 2, voice)
    const slot = frac(1, 3) // actual spacing of an eighth-triplet slot
    return steps.map((st, i) =>
      model.addNote({
        step: st.step as any, alter: 0, octave: st.octave,
        duration: '8', measure: 1, beat: frac(i, 3), voice: (voice || undefined) as any,
        tupletId: t.id, actualDuration: slot,
      }).id)
  }

  it('4a: moves a tuplet note into an empty voice → rest·B·rest, source A·rest·C', () => {
    const [a, b, c] = buildTriplet(0, [{ step: 'A', octave: 4 }, { step: 'B', octave: 4 }, { step: 'C', octave: 5 }])

    expect(model.moveNoteToVoice(b, 1)).toBe(true)
    expect(model.validateMeasure(1)).toEqual([])

    // Voice 1: a triplet with B in slot 1, rests either side.
    const v1 = tupletChords(1)
    expect(v1).toHaveLength(1)
    expect(v1[0].notes[0].id).toBe(b)
    expect(fracToNumber(v1[0].beat)).toBeCloseTo(1 / 3, 5) // slot index 1 (actual spacing 1/3)
    expect(v1[0].duration).toBe('8')
    const v1Rests = slotsOf(model, 1).filter(s => v(s) === 1 && s.tupletId && s.type === 'rest')
    expect(v1Rests).toHaveLength(2)

    // Voice 0: A and C survive, B's slot is now a rest.
    const v0 = tupletChords(0)
    expect(v0.flatMap(ch => ch.notes.map((n: any) => n.id)).sort()).toEqual([a, c].sort())
    expect(model.getNote(a)!.voice ?? 0).toBe(0)
    expect(model.getNote(c)!.voice ?? 0).toBe(0)
    expect(model.getNote(b)!.voice).toBe(1)
  })

  it('4b: pours existing target-voice notes into the free slots → d·B·e', () => {
    const [, b] = buildTriplet(0, [{ step: 'A', octave: 4 }, { step: 'B', octave: 4 }, { step: 'C', octave: 5 }])
    // Voice 1 already has two eighths d, e on beat 1's span.
    const d = model.addNote({ step: 'D', alter: 0, octave: 5, duration: '8', measure: 1, beat: frac(0, 1), voice: 1 })
    const e = model.addNote({ step: 'E', alter: 0, octave: 5, duration: '8', measure: 1, beat: frac(1, 2), voice: 1 })

    expect(model.moveNoteToVoice(b, 1)).toBe(true)
    expect(model.validateMeasure(1)).toEqual([])

    const v1 = tupletChords(1).sort((x, y) => fracCompare(x.beat, y.beat))
    expect(v1).toHaveLength(3)                                  // d · B · e, all in the triplet
    expect(v1.map(ch => ch.notes[0].id)).toEqual([d.id, b, e.id])
    expect(v1.every(ch => ch.duration === '8')).toBe(true)     // all re-expressed as triplet eighths
    expect(v1.every(ch => !!ch.tupletId)).toBe(true)
  })

  it('4b overflow: extra target notes beyond the free slots are dropped', () => {
    const [, b] = buildTriplet(0, [{ step: 'A', octave: 4 }, { step: 'B', octave: 4 }, { step: 'C', octave: 5 }])
    // Voice 1 has FOUR sixteenths in beat 1's span — more than the 2 free slots.
    const ids = [0, 1, 2, 3].map(i =>
      model.addNote({ step: 'D', alter: 0, octave: 5, duration: '16', measure: 1, beat: frac(i, 4), voice: 1 }).id)

    expect(model.moveNoteToVoice(b, 1)).toBe(true)
    expect(model.validateMeasure(1)).toEqual([]) // no crash / no half-formed bar

    const v1 = tupletChords(1)
    expect(v1).toHaveLength(3)                  // 2 poured + the moved B; no rests, no overflow
    // The moved B is present; only the first two sixteenths survived.
    const survivors = v1.flatMap(ch => ch.notes.map((n: any) => n.id))
    expect(survivors).toContain(b)
    expect(survivors.filter(id => ids.includes(id))).toHaveLength(2)
  })

  it('a note already on a target grid slot keeps its slot when a second note arrives', () => {
    // Regression: moving G (slot 2) then E (slot 0) of a triplet into voice 1 must
    // give E·rest·G — G must NOT get re-poured down to slot 1.
    const [e, , g] = buildTriplet(0, [{ step: 'E', octave: 4 }, { step: 'F', octave: 4 }, { step: 'G', octave: 4 }])

    expect(model.moveNoteToVoice(g, 1)).toBe(true) // G → voice 1 slot 2
    expect(model.moveNoteToVoice(e, 1)).toBe(true) // E → voice 1 slot 0
    expect(model.validateMeasure(1)).toEqual([])

    const v1 = tupletChords(1).sort((x, y) => fracCompare(x.beat, y.beat))
    expect(v1).toHaveLength(2)
    expect(v1[0].notes[0].id).toBe(e)
    expect(fracToNumber(v1[0].beat)).toBeCloseTo(0, 5)        // E stayed at slot 0
    expect(v1[1].notes[0].id).toBe(g)
    expect(fracToNumber(v1[1].beat)).toBeCloseTo(2 / 3, 5)    // G stayed at slot 2 (NOT 1/3)
    // Voice 1 slot 1 is a rest; F is still alone in voice 0.
    expect(slotsOf(model, 1).some(s => v(s) === 1 && s.tupletId && s.type === 'rest'
      && fracToNumber(s.beat) === 1 / 3)).toBe(true)
  })

  it('drops the source tuplet when its last note leaves (becomes plain rests)', () => {
    // A triplet whose only note is B (slots 0 and 2 stay rests).
    const t = model.createTuplet(1, frac(0, 1), '8', 3, 2, 0)
    model.refillTupletRemainder(1, t, 0)
    const midRest = slotsOf(model, 1)
      .filter(s => s.tupletId === t.id && s.type === 'rest')
      .sort((a, b) => fracCompare(a.beat, b.beat))[1]
    const b = model.updateNote(midRest.id, { step: 'B', alter: 0, octave: 4, isRest: false }).id

    expect(model.moveNoteToVoice(b, 1)).toBe(true)
    expect(model.validateMeasure(1)).toEqual([])

    // Source voice 0 no longer has the tuplet; voice 1 has it.
    expect(slotsOf(model, 1).some(s => v(s) === 0 && s.tupletId)).toBe(false)
    expect(model.getMeasure(1)!.tuplets!.every(tup =>
      model.getMeasure(1)!.slots.some(s => s.tupletId === tup.id))).toBe(true) // no dangling tuplet
    expect(model.getNote(b)!.voice).toBe(1)
  })
})
