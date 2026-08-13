/**
 * {@link rebarOps} — **spans survive a re-bar** (slurs and ties, and they keep their voice).
 *
 * A re-bar regenerates every slot id in the region, so a span stored as a pair of note ids is
 * pointing at notes that no longer exist by the time the relay finishes. Re-attaching means finding
 * the note at the same absolute position, in the same VOICE — a unison in another voice must not
 * steal the endpoint (docs/multivoice-rebar-plan.md, P2). And a span whose anchor is genuinely gone
 * (overwritten by a paste) is DROPPED, never left dangling.
 *
 * A `ScoreModel` is the FIXTURE — `setTimeSignature` / `pasteEvents` are how the rebar is reached;
 * what is under test is the free functions in `./rebarOps` (test-layout plan decision 4). Extracted
 * from `ScoreModel.test.ts` on 2026-07-28 by the modularity plan's Phase 0 — *a spec moves with its
 * module*.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { ScoreModel } from './ScoreModel'
import type { NoteParams } from '@/types/music'
import { fracCreate as frac, fracToNumber } from '@/utils/fraction'

describe('rebar preserves slurs (phrasing spans)', () => {
  let model: ScoreModel
  beforeEach(() => {
    model = new ScoreModel() // measure 1, 4/4 by default
    model.addMeasure()
    model.addMeasure()
  })

  // Fill measure 1's 4/4 bar with eighth notes C4 D4 E4 F4 G4 A4 B4 C5 (beats 0..3.5).
  const steps: Array<[NoteParams['step'], number]> = [
    ['C', 4], ['D', 4], ['E', 4], ['F', 4], ['G', 4], ['A', 4], ['B', 4], ['C', 5],
  ]
  const fillBar = () =>
    steps.map(([step, octave], i) =>
      model.addNote({ step, alter: 0, octave, duration: '8', measure: 1, beat: frac(i, 2) }),
    )

  it('re-attaches a slur to the rebar\'d notes across a time-signature change', () => {
    const notes = fillBar()
    const slur = model.addSlur({ startNoteId: notes[0].id, endNoteId: notes[7].id, voice: 0 })

    model.setTimeSignature(1, { numerator: 3, denominator: 4 }) // 4/4 content → two 3/4 bars

    const slurs = model.getSlurs()
    expect(slurs).toHaveLength(1)
    expect(slurs[0].id).toBe(slur.id) // same slur, re-anchored (not dropped)

    // Endpoints were regenerated, but now point at LIVE notes at the same pitch/onset.
    expect(slurs[0].startNoteId).not.toBe(notes[0].id)
    expect(slurs[0].endNoteId).not.toBe(notes[7].id)

    const start = model.getNote(slurs[0].startNoteId)
    const end = model.getNote(slurs[0].endNoteId)
    expect(start).toBeDefined()
    expect(end).toBeDefined()
    expect(start!.step).toBe('C')
    expect(start!.octave).toBe(4)
    expect(start!.measure).toBe(1)
    expect(fracToNumber(start!.beat)).toBe(0)
    expect(end!.step).toBe('C')
    expect(end!.octave).toBe(5)
    expect(end!.measure).toBe(2) // offset 3.5 lands in the second 3/4 bar...
    expect(fracToNumber(end!.beat)).toBe(0.5) // ...at beat 0.5
  })

  it('drops a slur whose anchor is overwritten by a paste (no dangling id)', () => {
    const notes = fillBar()
    model.addSlur({ startNoteId: notes[0].id, endNoteId: notes[7].id, voice: 0 })

    // Overwrite the whole bar with a single whole rest's worth of content via paste of
    // one note at beat 0; the slur's end anchor (C5 @3.5) no longer exists afterwards.
    model.pasteEvents(
      { lanes: [{ staff: 0, voice: 0, events: [{ offset: frac(0, 1), duration: frac(4, 1), pitches: [{ step: 'G', alter: 0, octave: 4 }] }] }], spanBeats: frac(4, 1) },
      { measure: 1, beat: frac(0, 1), voice: 0 })

    // Whatever the outcome, no slur may reference a missing note.
    const ids = new Set<string>()
    for (const m of model.getScore().measures) {
      for (const s of m.slots) {
        if (s.type === 'chord') for (const p of s.notes) ids.add(p.id)
        else ids.add(s.id)
      }
    }
    for (const sl of model.getSlurs()) {
      expect(ids.has(sl.startNoteId)).toBe(true)
      expect(ids.has(sl.endNoteId)).toBe(true)
    }
  })
})

describe('⭐⭐ rebar preserves TRILLS (docs/trill-plan.md §2.1)', () => {
  let model: ScoreModel
  beforeEach(() => {
    model = new ScoreModel() // measure 1, 4/4 by default
    model.addMeasure()
    model.addMeasure()
  })

  const steps: Array<[NoteParams['step'], number]> = [
    ['C', 4], ['D', 4], ['E', 4], ['F', 4], ['G', 4], ['A', 4], ['B', 4], ['C', 5],
  ]
  const fillBar = () =>
    steps.map(([step, octave], i) =>
      model.addNote({ step, alter: 0, octave, duration: '8', measure: 1, beat: frac(i, 2) }),
    )

  // ⚠️ THE TEST THAT MATTERS. A trill is anchored by note IDENTITY and a re-bar re-mints every id
  // in the region, so an implementation that only ran the dangling sweep would delete this trill —
  // and would still pass a test that merely asserted "no trill points at a missing note". Assert
  // that the SAME trill is still there, on the same music.
  it('re-attaches a trill to the rebar\'d notes across a time-signature change', () => {
    const notes = fillBar()
    const trill = model.addTrill({ startNoteId: notes[0].id, endNoteId: notes[7].id, voice: 0 })!

    model.setTimeSignature(1, { numerator: 3, denominator: 4 }) // 4/4 content → two 3/4 bars

    const trills = model.getTrills()
    expect(trills).toHaveLength(1)
    expect(trills[0].id).toBe(trill.id) // same trill, re-anchored — NOT dropped and re-made

    expect(trills[0].startNoteId).not.toBe(notes[0].id) // the ids really were re-minted
    expect(trills[0].endNoteId).not.toBe(notes[7].id)

    const start = model.getNote(trills[0].startNoteId)
    const end = model.getNote(trills[0].endNoteId!)
    expect(start!.step).toBe('C')
    expect(start!.octave).toBe(4)
    expect(start!.measure).toBe(1)
    expect(fracToNumber(start!.beat)).toBe(0)
    expect(end!.step).toBe('C')
    expect(end!.octave).toBe(5)
    expect(end!.measure).toBe(2)   // offset 3.5 lands in the second 3/4 bar…
    expect(fracToNumber(end!.beat)).toBe(0.5) // …at beat 0.5
  })

  it('the ONE-NOTE trill survives too, and stays one-note (no end invented)', () => {
    const notes = fillBar()
    const trill = model.addTrill({ startNoteId: notes[4].id })!

    model.setTimeSignature(1, { numerator: 3, denominator: 4 })

    const trills = model.getTrills()
    expect(trills).toHaveLength(1)
    expect(trills[0].id).toBe(trill.id)
    expect(trills[0].endNoteId).toBeUndefined()
    expect(model.getNote(trills[0].startNoteId)!.step).toBe('G')
  })

  it('⭐ a lost END degrades to the one-note trill; a lost START drops the whole thing', () => {
    const notes = fillBar()
    // Two trills: one whose end is at 3.5 (about to be overwritten), one whose SIGN is there.
    const spanning = model.addTrill({ startNoteId: notes[0].id, endNoteId: notes[7].id, voice: 0 })!
    const doomed = model.addTrill({ startNoteId: notes[7].id, voice: 0 })!

    // Overwrite the whole bar with one long G4 — nothing at 3.5 survives.
    model.pasteEvents(
      { lanes: [{ staff: 0, voice: 0, events: [{ offset: frac(0, 1), duration: frac(4, 1), pitches: [{ step: 'G', alter: 0, octave: 4 }] }] }], spanBeats: frac(4, 1) },
      { measure: 1, beat: frac(0, 1), voice: 0 })

    expect(model.getTrillById(doomed.id)).toBeNull() // its own note is gone
    // The spanning one lost only its far end — the sign's note (C4 @0) was overwritten too here,
    // so it goes as well; what must NEVER happen is a trill left pointing at a missing note.
    const ids = new Set<string>()
    for (const m of model.getScore().measures) {
      for (const s of m.slots) if (s.type === 'chord') for (const p of s.notes) ids.add(p.id)
    }
    for (const t of model.getTrills()) {
      expect(ids.has(t.startNoteId)).toBe(true)
      if (t.endNoteId !== undefined) expect(ids.has(t.endNoteId)).toBe(true)
    }
    expect(model.getTrillById(spanning.id)).toBeNull()
  })

  it('keeps a voice-1 trill on its own voice when voice 0 is a unison at the same beats', () => {
    model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    model.addNote({ step: 'D', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
    const t0 = model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1), voice: 1 })
    const t1 = model.addNote({ step: 'D', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1), voice: 1 })
    const trill = model.addTrill({ startNoteId: t0.id, endNoteId: t1.id, voice: 1 })!

    model.setTimeSignature(1, { numerator: 3, denominator: 4 })

    const live = model.getTrillById(trill.id)!
    expect(model.getNote(live.startNoteId)!.voice).toBe(1)
    expect(model.getNote(live.endNoteId!)!.voice).toBe(1)
  })
})

describe('rebar voice-scopes ties and slurs (P2)', () => {
  let model: ScoreModel
  beforeEach(() => {
    model = new ScoreModel() // measure 1, 4/4 by default
  })

  it('re-attaches boundary ties to the right voice when both voices are a unison at the edge', () => {
    // m1 (external): C4 in voice 0 AND C4 in voice 1, both at the last beat.
    const a0 = model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(3, 1) })
    const a1 = model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(3, 1), voice: 1 })
    // m2 (the region we re-bar): a unison C4 in both voices at beat 0.
    model.addMeasure()
    const b0 = model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 2, beat: frac(0, 1) })
    const b1 = model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 2, beat: frac(0, 1), voice: 1 })
    model.updateNote(a0.id, { tiedTo: b0.id })
    model.updateNote(b0.id, { tiedFrom: a0.id })
    model.updateNote(a1.id, { tiedTo: b1.id })
    model.updateNote(b1.id, { tiedFrom: a1.id })

    model.setTimeSignature(2, { numerator: 3, denominator: 4 }) // re-bars m2 → b0/b1 get new ids

    // Each external tie re-attaches WITHIN its own voice (not stolen by the unison).
    const t0 = model.getNote(model.getNote(a0.id)!.tiedTo!)
    const t1 = model.getNote(model.getNote(a1.id)!.tiedTo!)
    expect(t0).toBeTruthy()
    expect(t1).toBeTruthy()
    expect(t0!.voice ?? 0).toBe(0)
    expect(t1!.voice).toBe(1)
    expect(t0!.id).not.toBe(t1!.id) // distinct targets, one per voice
  })

  it('keeps a voice-2 slur on its own voice when voice 0 is a unison at the same beats', () => {
    // Voice 0 and voice 1 share pitch+beat columns (C4@0, D4@1). The slur is voice 1.
    model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    model.addNote({ step: 'D', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
    const s0 = model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1), voice: 1 })
    const s1 = model.addNote({ step: 'D', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1), voice: 1 })
    const slur = model.addSlur({ startNoteId: s0.id, endNoteId: s1.id, voice: 1 })

    model.setTimeSignature(1, { numerator: 3, denominator: 4 })

    const slurs = model.getSlurs()
    expect(slurs).toHaveLength(1)
    expect(slurs[0].id).toBe(slur.id)
    expect(slurs[0].voice).toBe(1)
    // Both re-anchored endpoints land on voice-1 notes (not the voice-0 unison).
    const start = model.getNote(slurs[0].startNoteId)!
    const end = model.getNote(slurs[0].endNoteId)!
    expect(start.voice).toBe(1)
    expect(end.voice).toBe(1)
    expect(start.step).toBe('C')
    expect(end.step).toBe('D')
  })
})
