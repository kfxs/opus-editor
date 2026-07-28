/**
 * {@link rebarOps} — **re-barring itself**, reached through the meter API.
 *
 * Changing a bar's meter moves the barlines under music that is already there, and `rebarRegion` is
 * what decides where that music lands: over-full bars spill forward, a note straddling a moved
 * barline is SPLIT and tied, a tuplet stays atomic, and a bounded region grows a bar rather than
 * cramming (pushing the next explicit change forward). `rewrite: 'none'` is the escape hatch that
 * changes the meter and re-bars nothing.
 *
 * The meter API's own contract — validation, propagation, the no-op — stays in
 * `ScoreModel.test.ts`; these are the `it`s from `setTimeSignature` and `removeTimeSignatureChange`
 * whose assertions are about the relay. Extracted on 2026-07-28 by the modularity plan's Phase 0 —
 * *a spec moves with its module*.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { ScoreModel } from './ScoreModel'
import type { ChordRest } from '@/types/music'
import { fracCreate as frac, fracCompare, fracToNumber } from '@/utils/fraction'

const ts = (numerator: number, denominator: number) => ({ numerator, denominator })

/** Slots in a measure, sorted by beat. */
function slotsOf(model: ScoreModel, measureNumber: number): ChordRest[] {
  return [...(model.getMeasure(measureNumber)?.slots ?? [])].sort((a, b) => fracCompare(a.beat, b.beat))
}

/** Total sounding length of a measure's slots, as a float (quarters). */
function totalLen(model: ScoreModel, measureNumber: number): number {
  return slotsOf(model, measureNumber).reduce((sum, s) => {
    const d = s.actualDuration ?? frac(0, 1)
    return sum + fracToNumber(d)
  }, 0)
}

describe('rebar through ScoreModel.setTimeSignature', () => {
  let model: ScoreModel
  beforeEach(() => { model = new ScoreModel('TS') })

  it('re-bars over-full music across moved barlines (rebar default)', () => {
    // Four quarters fill 4/4; shrinking to 3/4 re-bars the 4th into measure 2.
    for (let b = 0; b < 4; b++) {
      model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(b, 1) })
    }
    model.setTimeSignature(1, ts(3, 4))
    expect(slotsOf(model, 1).filter((s) => s.type === 'chord').map((c) => fracToNumber(c.beat))).toEqual([0, 1, 2])
    expect(slotsOf(model, 2).filter((s) => s.type === 'chord').map((c) => fracToNumber(c.beat))).toEqual([0])
    expect(model.getMeasure(2)!.timeSignature).toEqual(ts(3, 4))
    // No note lost: four quarter-notes across the region.
    const chordCount = [1, 2].reduce((n, m) => n + slotsOf(model, m).filter((s) => s.type === 'chord').length, 0)
    expect(chordCount).toBe(4)
  })

  it('splits a note straddling a moved barline with a tie (rebar default)', () => {
    // Half note at beat 2 in 4/4 spans [2,4); in 3/4 it crosses the bar 1/2 line at 3.
    model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'h', measure: 1, beat: frac(2, 1) })
    model.setTimeSignature(1, ts(3, 4))
    const a = slotsOf(model, 1).find((s) => s.type === 'chord') as any
    const b = slotsOf(model, 2).find((s) => s.type === 'chord') as any
    expect(fracToNumber(a.beat)).toBe(2)
    expect(a.duration).toBe('q')
    expect(fracToNumber(b.beat)).toBe(0)
    expect(b.duration).toBe('q')
    // Pitch-level tie links the two halves of the split note.
    expect(a.notes[0].tiedTo).toBe(b.notes[0].id)
    expect(b.notes[0].tiedFrom).toBe(a.notes[0].id)
  })

  it('keeps a tuplet intact (atomic) through a rebar', () => {
    // An eighth-note triplet at beat 0 of measure 1; rebar 4/4 → 3/4.
    const tuplet = model.createTuplet(1, frac(0, 1), '8', 3, 2)
    model.refillTupletRemainder(1, tuplet) // fill the triplet with its filler rests
    const before = model.getMeasure(1)!.slots.filter((s) => s.tupletId === tuplet.id).length
    model.setTimeSignature(1, ts(3, 4))
    // The triplet survives intact (same slot count, anchored at beat 0).
    const m1 = model.getMeasure(1)!
    expect(m1.tuplets).toHaveLength(1)
    const tupletSlots = m1.slots.filter((s) => s.tupletId === m1.tuplets[0].id)
    expect(tupletSlots).toHaveLength(before)
    expect(fracToNumber(m1.tuplets[0].startBeat)).toBe(0)
  })

  it('preserves a tie crossing into a re-barred region (re-attaches, no dangle)', () => {
    // C4 in measure 1 tied to C4 in measure 2; re-barring measure 2 regenerates
    // its slot ids, so the incoming tie must be re-attached to the new C4.
    const a = model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    model.addMeasure()
    const b = model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 2, beat: frac(0, 1) })
    model.updateNote(a.id, { tiedTo: b.id })
    model.updateNote(b.id, { tiedFrom: a.id })

    model.setTimeSignature(2, ts(5, 8)) // re-bars measure 2 → b gets a new id

    // The tie is preserved: m1's C4 now points to the rebar'd C4 (a real note).
    const aAfter = model.getNote(a.id)!
    expect(aAfter.tiedTo).toBeDefined()
    const target = model.getNote(aAfter.tiedTo!)
    expect(target).toBeTruthy()
    expect(target!.step).toBe('C')
    expect(target!.octave).toBe(4)
    expect(target!.measure).toBe(2)
    expect(target!.tiedFrom).toBe(a.id)
    // Global invariant: every tie pointer references an existing slot.
    const ids = new Set<string>()
    for (const m of model.getScore().measures)
      for (const s of m.slots) {
        if (s.type === 'chord') for (const p of s.notes) ids.add(p.id)
        else ids.add(s.id)
      }
    let dangling = 0
    for (const m of model.getScore().measures)
      for (const s of m.slots) {
        if (s.type === 'chord') {
          for (const p of s.notes) {
            if (p.tiedTo && !ids.has(p.tiedTo)) dangling++
            if (p.tiedFrom && !ids.has(p.tiedFrom)) dangling++
          }
        } else if (s.tiedFrom && !ids.has(s.tiedFrom)) dangling++
      }
    expect(dangling).toBe(0)
  })

  it('rewrite:"none" keeps an over-full bar crowded (no rebar)', () => {
    for (let b = 0; b < 4; b++) {
      model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(b, 1) })
    }
    model.setTimeSignature(1, ts(3, 4), { rewrite: 'none' })
    const chordBeats = slotsOf(model, 1).filter((s) => s.type === 'chord').map((c) => fracToNumber(c.beat))
    expect(chordBeats).toEqual([0, 1, 2, 3]) // all four kept in one crowded bar
  })

  it('pushes the next TS change forward instead of cramming the bounded region (repro)', () => {
    // m1 & m2 each filled with 16 sixteenth-notes in 4/4 (4 beats each).
    model.addMeasure() // measure 2
    for (const m of [1, 2]) {
      for (let k = 0; k < 16; k++) {
        model.addNote({ step: 'C', alter: 0, octave: 4, duration: '16', measure: m, beat: frac(k, 4) })
      }
    }
    // 5/8 at measure 2 → its 16 sixteenths grow to m2+m3 (10 + 6), m2 carries the change.
    model.setTimeSignature(2, ts(5, 8))
    expect(model.getMeasure(2)!.timeSignatureChange).toBe(true)

    // 2/4 at measure 1 → its 16 sixteenths need TWO 2/4 bars; rather than cram them
    // into a single bounded bar, a bar is inserted and the 5/8 change is PUSHED to m3.
    model.setTimeSignature(1, ts(2, 4))

    expect(model.getMeasure(1)!.timeSignature).toEqual(ts(2, 4))
    expect(model.getMeasure(2)!.timeSignature).toEqual(ts(2, 4))
    expect(model.getMeasure(2)!.timeSignatureChange).toBeFalsy() // continuation bar
    expect(model.getMeasure(3)!.timeSignature).toEqual(ts(5, 8))
    expect(model.getMeasure(3)!.timeSignatureChange).toBe(true) // change pushed here

    // Each 2/4 bar holds exactly 8 sixteenths (no cram); two quarters of length each.
    expect(slotsOf(model, 1).filter((s) => s.type === 'chord')).toHaveLength(8)
    expect(slotsOf(model, 2).filter((s) => s.type === 'chord')).toHaveLength(8)
    expect(totalLen(model, 1)).toBe(2)
    expect(totalLen(model, 2)).toBe(2)
    // No note lost: the 32 sixteenths still span the score.
    const chordCount = model.getScore().measures.reduce(
      (n, m) => n + m.slots.filter((s) => s.type === 'chord').length, 0)
    expect(chordCount).toBe(32)
  })

  it('shrink case keeps freed bars as trailing rests and leaves the next change unmoved', () => {
    model.addMeasure(); model.addMeasure() // m1, m2, m3 (all 4/4)
    model.setTimeSignature(3, ts(3, 4)) // explicit change pins region [m1,m2]
    model.setTimeSignature(1, ts(2, 4)) // m1, m2 → 2/4
    // Two quarters exactly fill ONE 2/4 bar.
    model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    model.addNote({ step: 'D', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })

    // Widen to 4/4: the content now fits in a single bar, freeing measure 2.
    model.setTimeSignature(1, ts(4, 4))
    expect(model.getScore().measures).toHaveLength(3) // no bars added or removed
    expect(slotsOf(model, 1).filter((s) => s.type === 'chord')).toHaveLength(2)
    expect(slotsOf(model, 2).every((s) => s.type === 'rest')).toBe(true) // kept as a rest bar
    // The next explicit change is untouched (not pulled earlier).
    expect(model.getMeasure(3)!.timeSignature).toEqual(ts(3, 4))
    expect(model.getMeasure(3)!.timeSignatureChange).toBe(true)
  })
})

describe('rebar through ScoreModel.removeTimeSignatureChange', () => {
  let model: ScoreModel
  beforeEach(() => { model = new ScoreModel('TS') })

  it('re-bars the region back to the inherited meter (rebar default)', () => {
    model.addMeasure(); model.addMeasure() // 2, 3
    model.setTimeSignature(2, ts(2, 4)) // measures 2,3 → 2/4 (2 quarters each)
    // Fill measures 2 and 3 with 2 quarters each (4 quarters of content total).
    model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 2, beat: frac(0, 1) })
    model.addNote({ step: 'D', alter: 0, octave: 4, duration: 'q', measure: 2, beat: frac(1, 1) })
    model.addNote({ step: 'E', alter: 0, octave: 4, duration: 'q', measure: 3, beat: frac(0, 1) })
    model.addNote({ step: 'F', alter: 0, octave: 4, duration: 'q', measure: 3, beat: frac(1, 1) })
    expect(model.removeTimeSignatureChange(2)).toBe(true)
    // Reverted to 4/4 and re-barred: the 4 quarters now fill a single 4/4 bar (measure 2).
    expect(model.getMeasure(2)!.timeSignature).toEqual(ts(4, 4))
    expect(slotsOf(model, 2).filter((s) => s.type === 'chord').map((c) => fracToNumber(c.beat)))
      .toEqual([0, 1, 2, 3])
  })

  it("with rewrite 'none' reverts the meter but keeps barlines fixed", () => {
    model.addMeasure(); model.addMeasure() // 2, 3
    model.setTimeSignature(2, ts(2, 4))
    model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 2, beat: frac(0, 1) })
    model.addNote({ step: 'E', alter: 0, octave: 4, duration: 'q', measure: 3, beat: frac(0, 1) })
    expect(model.removeTimeSignatureChange(2, { rewrite: 'none' })).toBe(true)
    expect(model.getMeasure(2)!.timeSignature).toEqual(ts(4, 4))
    // No rebar/merge: measure 3 keeps its own note in place.
    expect(slotsOf(model, 3).filter((s) => s.type === 'chord').map((c) => fracToNumber(c.beat)))
      .toEqual([0])
  })
})
