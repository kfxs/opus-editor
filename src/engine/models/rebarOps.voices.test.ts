/**
 * {@link rebarOps} — **a re-bar must not erase a secondary voice** (docs/multivoice-rebar-plan.md, P1).
 *
 * The relay flattens a region into a stream and lays it out again under the new meter. Done per-bar
 * it would keep voice 0 and quietly drop the rest; done carelessly it emits one voice's tuplet as a
 * phantom atomic into another's stream. So each voice is flattened and re-laid on its OWN lane, and
 * every bar still has to tile exactly — which is what `validateMeasure` asserts here.
 *
 * A `ScoreModel` is the FIXTURE — `setTimeSignature` / `removeTimeSignatureChange` / `pasteEvents`
 * are how the rebar is reached; what is under test is the free functions in `./rebarOps` (test-layout
 * plan decision 4). Extracted from `ScoreModel.test.ts` on 2026-07-28 by the modularity plan's
 * Phase 0 — *a spec moves with its module*.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { ScoreModel } from './ScoreModel'
import { fracCreate as frac, fracToNumber } from '@/utils/fraction'

// ===========================================================================
// Multi-voice rebar — a TS change / paste must not erase a secondary voice
// (docs/multivoice-rebar-plan.md, P1)
// ===========================================================================

describe('rebar preserves secondary voices', () => {
  let model: ScoreModel
  beforeEach(() => {
    model = new ScoreModel() // measure 1, 4/4 by default
    model.addMeasure()
    model.addMeasure()
  })

  const voiceNotes = (m: number, v: number) =>
    model.getNotesInMeasure(m).filter(n => (n.voice ?? 0) === v && !n.isRest)

  it('keeps both voices across a time-signature change (4/4 → 3/4)', () => {
    // V1: four quarters C4 D4 E4 F4. V2: two half notes G3 B3.
    model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    model.addNote({ step: 'D', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
    model.addNote({ step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(2, 1) })
    model.addNote({ step: 'F', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(3, 1) })
    model.addNote({ step: 'G', alter: 0, octave: 3, duration: 'h', measure: 1, beat: frac(0, 1), voice: 1 })
    model.addNote({ step: 'B', alter: 0, octave: 3, duration: 'h', measure: 1, beat: frac(2, 1), voice: 1 })

    model.setTimeSignature(1, { numerator: 3, denominator: 4 }) // 4 quarters → two 3/4 bars

    // Both voices survive, re-barred across the moved barline.
    const v0 = [...voiceNotes(1, 0), ...voiceNotes(2, 0)]
    const v1 = [...voiceNotes(1, 1), ...voiceNotes(2, 1)]
    expect(v0.map(n => n.step)).toEqual(['C', 'D', 'E', 'F'])
    // V2's second half note (beat 2–4) crosses the moved 3/4 barline → split + tied.
    expect(v1.map(n => n.step)).toEqual(['G', 'B', 'B'])
    expect(v1.every(n => n.voice === 1)).toBe(true) // voice tag intact
    expect(v1[1].tiedTo).toBeDefined() // the B is tied across the barline

    // Each bar tiles exactly (no overflow / gap in either voice).
    expect(model.validateMeasure(1)).toEqual([])
    expect(model.validateMeasure(2)).toEqual([])
  })

  it('keeps both voices when a TS change is removed', () => {
    model.setTimeSignature(2, { numerator: 3, denominator: 4 }) // explicit change at m2
    model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 2, beat: frac(0, 1) })
    model.addNote({ step: 'D', alter: 0, octave: 4, duration: 'q', measure: 2, beat: frac(1, 1) })
    model.addNote({ step: 'G', alter: 0, octave: 3, duration: 'h', measure: 2, beat: frac(0, 1), voice: 1 })

    model.removeTimeSignatureChange(2) // 3/4 → inherited 4/4

    expect(voiceNotes(2, 0).map(n => n.step)).toEqual(['C', 'D'])
    const v1 = voiceNotes(2, 1)
    expect(v1.map(n => n.step)).toEqual(['G'])
    expect(v1[0].voice).toBe(1)
    expect(model.validateMeasure(2)).toEqual([])
  })

  it('survives a paste into voice 0 of a two-voice bar (voice 2 untouched)', () => {
    // V1 quarters, V2 a half note in m1.
    model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    model.addNote({ step: 'D', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
    model.addNote({ step: 'G', alter: 0, octave: 3, duration: 'h', measure: 1, beat: frac(0, 1), voice: 1 })

    // Paste a single quarter at beat 0 of voice 0.
    model.pasteEvents(
      { lanes: [{ staff: 0, voice: 0, events: [{ offset: frac(0, 1), duration: frac(1, 1), pitches: [{ step: 'A', alter: 0, octave: 4 }] }] }], spanBeats: frac(1, 1) },
      { measure: 1, beat: frac(0, 1), voice: 0 })

    // Voice 2's half note is still there, still tagged voice 1.
    const v1 = voiceNotes(1, 1)
    expect(v1.map(n => n.step)).toEqual(['G'])
    expect(v1[0].voice).toBe(1)
    // Voice 0 got the pasted A4 at beat 0.
    expect(voiceNotes(1, 0).find(n => fracToNumber(n.beat) === 0)?.step).toBe('A')
    expect(model.validateMeasure(1)).toEqual([])
  })

  it('does not inject phantom rests into voice 1 when voice 0 has a tuplet', () => {
    // Voice 0: an eighth-note triplet at beat 0. Voice 1: four quarters filling 4/4.
    // Regression: flattenRegion used to emit a voice-0 tuplet as a phantom atomic
    // into voice 1's stream, corrupting the re-lay (extra leading rests).
    const tuplet = model.createTuplet(1, frac(0, 1), '8', 3, 2)
    model.refillTupletRemainder(1, tuplet)
    model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1), voice: 1 })
    model.addNote({ step: 'D', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1), voice: 1 })
    model.addNote({ step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(2, 1), voice: 1 })
    model.addNote({ step: 'F', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(3, 1), voice: 1 })

    model.setTimeSignature(1, { numerator: 2, denominator: 4 }) // 4 quarters → two 2/4 bars

    // Voice 1 keeps exactly its four quarters across the two bars — no phantom rests.
    const v1 = [...voiceNotes(1, 1), ...voiceNotes(2, 1)]
    expect(v1.map(n => n.step)).toEqual(['C', 'D', 'E', 'F'])
    expect(v1.every(n => n.voice === 1)).toBe(true)
    // The voice-0 tuplet stays atomic in bar 1 (not duplicated into voice 1).
    expect(model.getMeasure(1)!.tuplets).toHaveLength(1)
    expect(model.validateMeasure(1)).toEqual([])
    expect(model.validateMeasure(2)).toEqual([])
  })
})
