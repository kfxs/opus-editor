/**
 * {@link rebarOps} — **beat-anchored annotations survive a re-bar** (clefs, dynamics, tempo marks).
 *
 * `clearMeasureForRebar` throws a measure's slots away and relays them under the new meter, so
 * anything hanging off a BEAT rather than off a slot id would silently vanish with it. The seam that
 * saves them is `captureBeatAnchors` / `restoreBeatAnchors`, and this chapter is its contract: an
 * annotation whose beat still fits stays put, one whose beat overflows moves to the next bar, and a
 * collision resolves last-wins.
 *
 * A `ScoreModel` is the FIXTURE — `setTimeSignature` / `pasteEvents` are how the rebar is reached;
 * what is under test is the free functions in `./rebarOps` (test-layout plan decision 4). Extracted
 * from `ScoreModel.test.ts` on 2026-07-28 by the modularity plan's Phase 0 — *a spec moves with its
 * module*.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { levelToGlyphString, dynamicLevelOf } from '@/utils/dynamics'
import { ScoreModel } from './ScoreModel'
import type { TempoMark, Fraction } from '@/types/music'
import { fracCreate as frac, fracToNumber } from '@/utils/fraction'
import { buildTempoMap } from '@/utils/tempoMap'

describe('rebar preserves beat-anchored annotations (clefs + dynamics)', () => {
  let model: ScoreModel
  beforeEach(() => {
    model = new ScoreModel() // measure 1, 4/4 by default
    model.addMeasure()
    model.addMeasure()
  })

  it('keeps a dynamic in place when its beat still fits the new bar', () => {
    // The reported scenario: f at measure 2 beat 2, then change measure 2 → 3/4.
    model.addDynamic(2, { beat: frac(2, 1), text: levelToGlyphString('f') })
    model.setTimeSignature(2, { numerator: 3, denominator: 4 })
    const dyns = model.getDynamics(2)
    expect(dyns).toHaveLength(1)
    expect(dynamicLevelOf(dyns[0])).toBe('f')
    expect(fracToNumber(dyns[0].beat)).toBe(2) // 3/4 bar still holds beat 2
  })

  it('moves a dynamic to the next bar when its beat overflows the new bar', () => {
    // beat 3 of a 4/4 measure → absolute offset 3 → second 3/4 bar, beat 0.
    model.addDynamic(1, { beat: frac(3, 1), text: levelToGlyphString('p') })
    model.setTimeSignature(1, { numerator: 3, denominator: 4 })
    expect(model.getDynamics(1)).toHaveLength(0)
    const moved = model.getDynamics(2)
    expect(moved).toHaveLength(1)
    expect(dynamicLevelOf(moved[0])).toBe('p')
    expect(fracToNumber(moved[0].beat)).toBe(0)
  })

  it('re-anchors a mid-measure clef change across a rebar', () => {
    model.setClefAt(2, frac(2, 1), 'bass')
    expect(model.getMeasure(2)!.clefs).toHaveLength(1)
    model.setTimeSignature(2, { numerator: 3, denominator: 4 })
    const clefs = model.getMeasure(2)!.clefs!
    expect(clefs).toHaveLength(1)
    expect(clefs[0].clef).toBe('bass')
    expect(fracToNumber(clefs[0].beat)).toBe(2)
  })

  it('moves a clef change to the next bar when its beat overflows', () => {
    model.setClefAt(1, frac(3, 1), 'bass')
    model.setTimeSignature(1, { numerator: 3, denominator: 4 })
    expect(model.getMeasure(1)!.clefs).toBeUndefined()
    const clefs = model.getMeasure(2)!.clefs!
    expect(clefs).toHaveLength(1)
    expect(clefs[0].clef).toBe('bass')
    expect(fracToNumber(clefs[0].beat)).toBe(0)
  })
})

/**
 * A tempo mark is beat-anchored, so a meter change would SILENTLY DELETE it
 * (clearMeasureForRebar drops `measure.tempos`) unless it rides the same
 * captureBeatAnchors/restoreBeatAnchors seam that carries clefs + dynamics.
 * Marks are written straight onto the measure here — the ScoreModel ops land in P3.
 * See docs/tempo-marks-plan.md §4.
 */
describe('rebar preserves beat-anchored annotations (tempo marks)', () => {
  let model: ScoreModel
  beforeEach(() => {
    model = new ScoreModel() // measure 1, 4/4 by default
    model.addMeasure()
    model.addMeasure()
  })

  /** Place a mark directly (P3 adds addTempoMark). */
  const place = (measure: number, beat: Fraction, mark: Partial<TempoMark> = {}): void => {
    const m = model.getMeasure(measure)!
    m.tempos = [...(m.tempos ?? []), { id: `tm-${measure}-${fracToNumber(beat)}`, beat, bpm: 90, ...mark }]
  }

  it('keeps a tempo mark in place when its beat still fits the new bar', () => {
    place(2, frac(2, 1), { text: 'Allegro', bpm: 144 })
    model.setTimeSignature(2, { numerator: 3, denominator: 4 })
    const tempos = model.getMeasure(2)!.tempos!
    expect(tempos).toHaveLength(1)
    expect(tempos[0].text).toBe('Allegro')
    expect(tempos[0].bpm).toBe(144)
    expect(fracToNumber(tempos[0].beat)).toBe(2) // a 3/4 bar still holds beat 2
  })

  it('moves a tempo mark to the next bar when its beat overflows the new bar', () => {
    place(1, frac(3, 1), { bpm: 60 })
    model.setTimeSignature(1, { numerator: 3, denominator: 4 })
    expect(model.getMeasure(1)!.tempos).toBeUndefined()
    const moved = model.getMeasure(2)!.tempos!
    expect(moved).toHaveLength(1)
    expect(moved[0].bpm).toBe(60)
    expect(fracToNumber(moved[0].beat)).toBe(0) // absolute offset 3 → 2nd 3/4 bar, beat 0
  })

  it('carries the whole mark through a rebar (text, unit, dots, scopeId)', () => {
    place(2, frac(1, 1), {
      text: 'Adagio (𝅗𝅥. = 40)', unit: 'h', dots: 1, bpm: 40, scopeId: 'orch-1',
    })
    model.setTimeSignature(2, { numerator: 3, denominator: 4 })
    const t = model.getMeasure(2)!.tempos![0]
    expect(t).toMatchObject({
      text: 'Adagio (𝅗𝅥. = 40)', unit: 'h', dots: 1, bpm: 40, scopeId: 'orch-1',
    })
  })

  it('keeps the tempo SOUNDING at the same absolute position after a meter change', () => {
    // The point of the seam: the map must be unchanged where it matters. ♩=60 at m2 b2
    // of 4/4 is absolute beat 6; after m2 → 3/4 it is m2 b2 again = absolute beat 6.
    place(2, frac(2, 1), { bpm: 60 })
    const before = buildTempoMap(model.getScore())
    model.setTimeSignature(2, { numerator: 3, denominator: 4 })
    const after = buildTempoMap(model.getScore())
    expect(after).toEqual(before)
    expect(after[1]).toMatchObject({ startBeats: 6, qpm: 60 })
  })

  it('dedupes two marks landing on one beat — last wins (the clef rule)', () => {
    // Beats 3 and 4 of 4/4 bar 1 (absolute 3 and 4) both collapse onto... different bars
    // in 3/4; instead force the collision directly: two marks on the same beat.
    place(1, frac(1, 1), { bpm: 60 })
    place(1, frac(1, 1), { bpm: 90 })
    model.setTimeSignature(1, { numerator: 3, denominator: 4 })
    const tempos = model.getMeasure(1)!.tempos!
    expect(tempos).toHaveLength(1) // NOT stacked (that is the dynamics rule)
    expect(tempos[0].bpm).toBe(90)
  })

  it('a tempo mark survives a rebar triggered elsewhere in the region', () => {
    place(3, frac(0, 1), { text: 'Presto', bpm: 185 })
    model.setTimeSignature(1, { numerator: 3, denominator: 4 }) // rebars forward
    const found = model.getScore().measures.flatMap(m => m.tempos ?? [])
    expect(found).toHaveLength(1)
    expect(found[0].text).toBe('Presto')
  })

  // A DECISION, not an accident (docs/tempo-marks-plan.md §4): the clipboard carries
  // staff-relative musical material, and a tempo mark is a system object governing the
  // clock. So pasting notes over a bar must leave that bar's tempo mark standing — unlike
  // a dynamic in the paste window, which the clip overwrites.
  it('does NOT let a paste overwrite the destination’s tempo mark (system object)', () => {
    place(1, frac(0, 1), { text: 'Largo', bpm: 50 })
    model.addDynamic(1, { beat: frac(0, 1), text: levelToGlyphString('f') })

    model.pasteEvents(
      { lanes: [{ staff: 0, voice: 0, events: [{ offset: frac(0, 1), duration: frac(4, 1), pitches: [{ step: 'G', alter: 0, octave: 4 }] }] }], spanBeats: frac(4, 1) },
      { measure: 1, beat: frac(0, 1), voice: 0 },
    )

    const tempos = model.getMeasure(1)!.tempos!
    expect(tempos).toHaveLength(1)
    expect(tempos[0].text).toBe('Largo')
    expect(fracToNumber(tempos[0].beat)).toBe(0)
    // The dynamic in the paste window IS overwritten (the clip carried none) — the
    // contrast is the point: dynamics are staff content, tempo is not.
    expect(model.getDynamics(1)).toHaveLength(0)
  })
})

/**
 * HAIRPINS on the same seam — and the reason this chapter exists at all is that the failure it
 * guards is not a deletion. `clearMeasureForRebar` wipes a measure by NAMING its arrays, so an
 * array it does not name survives the wipe holding its old beat while the bar's music is re-tiled
 * around it: a wedge left pointing at music that moved, with nothing thrown and "it's still there"
 * passing any test that only counts them. Hence the assertions below check WHERE each hairpin
 * landed, never just how many there are.
 */
describe('rebar preserves beat-anchored annotations (hairpins)', () => {
  let model: ScoreModel
  beforeEach(() => {
    model = new ScoreModel() // measure 1, 4/4 by default
    model.addMeasure()
    model.addMeasure()
  })

  const only = (measureNumber: number) => model.getMeasure(measureNumber)!.hairpins ?? []

  it('keeps a hairpin in place when its start still fits the new bar', () => {
    model.addHairpin(2, { type: 'cresc', beat: frac(2, 1), length: frac(1, 1) })
    model.setTimeSignature(2, { numerator: 3, denominator: 4 })
    expect(only(2)).toHaveLength(1)
    expect(only(2)[0].type).toBe('cresc')
    expect(fracToNumber(only(2)[0].beat)).toBe(2) // a 3/4 bar still holds beat 2
  })

  it('moves a hairpin to the next bar when its start overflows the new bar', () => {
    model.addHairpin(1, { type: 'dim', beat: frac(3, 1), length: frac(2, 1) })
    model.setTimeSignature(1, { numerator: 3, denominator: 4 })
    expect(only(1)).toHaveLength(0)
    expect(only(2)).toHaveLength(1)
    expect(only(2)[0].type).toBe('dim')
    expect(fracToNumber(only(2)[0].beat)).toBe(0)
  })

  it('carries LENGTH through untouched — the region holds the same music', () => {
    // An amount of music is invariant under a re-bar; only the START needs re-anchoring.
    model.addHairpin(1, { type: 'cresc', beat: frac(0, 1), length: frac(7, 2) })
    model.setTimeSignature(1, { numerator: 3, denominator: 4 })
    const all = model.getScore().measures.flatMap(m => m.hairpins ?? [])
    expect(all).toHaveLength(1)
    expect(fracToNumber(all[0].length)).toBe(3.5)
  })

  it('re-mints the id, exactly as a dynamic’s (nothing may rely on it surviving)', () => {
    const before = model.addHairpin(1, { type: 'cresc', beat: frac(0, 1), length: frac(1, 1) })!
    model.setTimeSignature(1, { numerator: 3, denominator: 4 })
    const after = model.getScore().measures.flatMap(m => m.hairpins ?? [])
    expect(after).toHaveLength(1)
    expect(after[0].id).not.toBe(before.id)
  })

  it('lets two hairpins stack on one beat (the dynamics rule, not the clef rule)', () => {
    model.addHairpin(1, { type: 'cresc', beat: frac(1, 1), length: frac(1, 1), voice: 0 })
    model.addHairpin(1, { type: 'dim', beat: frac(1, 1), length: frac(2, 1), voice: 1 })
    model.setTimeSignature(1, { numerator: 3, denominator: 4 })
    expect(only(1)).toHaveLength(2)
  })

  it('a paste OVERWRITES a hairpin starting inside its window, and spares one outside it', () => {
    model.addHairpin(1, { type: 'cresc', beat: frac(0, 1), length: frac(1, 1) }) // inside
    model.addHairpin(2, { type: 'dim', beat: frac(0, 1), length: frac(1, 1) })   // outside

    model.pasteEvents(
      { lanes: [{ staff: 0, voice: 0, events: [{ offset: frac(0, 1), duration: frac(4, 1), pitches: [{ step: 'G', alter: 0, octave: 4 }] }] }], spanBeats: frac(4, 1) },
      { measure: 1, beat: frac(0, 1), voice: 0 },
    )

    expect(only(1)).toHaveLength(0) // replaced by the clip's (which carried none)
    expect(only(2)).toHaveLength(1) // untouched — same rule the dynamics follow
    expect(only(2)[0].type).toBe('dim')
  })

  it('a clip carries its hairpins, re-based to the paste position', () => {
    model.pasteEvents(
      {
        lanes: [{ staff: 0, voice: 0, events: [{ offset: frac(0, 1), duration: frac(4, 1), pitches: [{ step: 'G', alter: 0, octave: 4 }] }] }],
        spanBeats: frac(4, 1),
        hairpins: [{ staff: 0, voice: 0, offset: frac(1, 1), length: frac(2, 1), type: 'cresc' }],
      },
      { measure: 2, beat: frac(0, 1), voice: 0 },
    )

    expect(only(2)).toHaveLength(1)
    expect(only(2)[0].type).toBe('cresc')
    expect(fracToNumber(only(2)[0].beat)).toBe(1)    // clip offset 1 + paste start 0
    expect(fracToNumber(only(2)[0].length)).toBe(2)  // an amount of music — copied through
  })
})
