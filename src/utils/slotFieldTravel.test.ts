import { describe, it, expect } from 'vitest'
import { SLOT_FIELD_TRAVEL, CARRIED_SLOT_FIELDS, type SlotField } from './slotFieldTravel'
import { flattenRegion, relayEvents, type RebarPiece } from './rebar'
import { getMeterInfo } from './meter'
import { fracCreate } from './fraction'
import type { Chord, Measure, Rest, TimeSignature } from '@/types/music'

/**
 * Subject: `./slotFieldTravel` — the table that says what a re-lay does with every field of a slot.
 *
 * ⭐ The `satisfies` in the module is the first guard: a field added to `Chord` or `Rest` fails to
 * COMPILE until it is classified. This is the second, and it is the one that matters — a table can
 * be total and still be a lie. Every field the table calls `carried` is asserted to actually survive
 * `flattenRegion` → `relayEvents`, and the field it calls `dropped` is asserted to actually go.
 *
 * ⚠️ **The count guard at the end is load-bearing.** Classifying a new field as `carried` fails this
 * spec until someone writes the assertion that proves it — otherwise the table would drift into a
 * list of intentions, which is exactly the failure mode `reference_a_false_warning_teaches_readers_to_skip`
 * describes for a hand-maintained field list.
 */

const ts = (n: number, d: number): TimeSignature => ({ numerator: n, denominator: d })
const F = (n: number, d = 1) => fracCreate(n, d)

/** A chord wearing EVERY field the table promises to carry, so one round trip tests them all. */
const loadedChord = (): Chord => ({
  id: 'c1',
  type: 'chord',
  beat: F(0),
  duration: 'q',
  dots: 1,
  measure: 1,
  stemDirection: 'up',
  articulations: ['staccato'],
  articulationPlacement: 'below',
  articulationStemAlign: true,
  fractionalBeamSide: 'right',
  tremolo: 3,
  beam: 'begin',
  secondaryBreak: true,
  graceBefore: { notes: [{ pitches: [{ id: 'g1', step: 'D', alter: 0, octave: 4 }], duration: '8' }], slash: true },
  graceAfter: { notes: [{ pitches: [{ id: 'g2', step: 'F', alter: 1, octave: 4 }], duration: '16' }], slur: false },
  notes: [{ id: 'n1', step: 'E', alter: 0, octave: 4, forceAccidental: true }],
})

const measureOf = (slots: (Chord | Rest)[]): Measure =>
  ({ id: 'm1', number: 1, slots, timeSignature: ts(4, 4), tuplets: [] })

/** One slot → its single relay piece, through both passes exactly as a paste runs them. */
function roundTrip(slot: Chord | Rest): RebarPiece {
  const events = flattenRegion([measureOf([slot])], 0, { keepRests: true })
  const bars = relayEvents(events, getMeterInfo(ts(4, 4)), { targetBars: 1, bounded: false, respell: 'faithful' })
  const piece = bars[0].find(p => (slot.type === 'rest') === !!p.isRest)
  expect(piece, 'the slot came back at all').toBeDefined()
  return piece!
}

describe('the table is total over a real slot', () => {
  it('classifies every field a populated CHORD actually has', () => {
    const unclassified = Object.keys(loadedChord()).filter(k => !(k in SLOT_FIELD_TRAVEL))
    expect(unclassified, 'chord fields with no row in the table').toEqual([])
  })

  it('classifies every field a populated REST actually has', () => {
    const rest: Rest = {
      id: 'r1', type: 'rest', beat: F(0), duration: 'q', dots: 1, measure: 1,
      voice: 1, tupletId: 't1', actualDuration: F(3, 2), tiedFrom: 'x',
      staffId: 's2', isMeasureRest: false, beamOver: true,
    }
    expect(Object.keys(rest).filter(k => !(k in SLOT_FIELD_TRAVEL))).toEqual([])
  })
})

describe('what the table calls CARRIED really is', () => {
  const piece = roundTrip(loadedChord())

  it('duration + dots — the authored figure, not a re-tiling of its length', () => {
    expect([piece.duration, piece.dots]).toEqual(['q', 1])
  })

  it('notes — as pitches, spelling and forced accidental intact', () => {
    expect(piece.pitches).toEqual([{ step: 'E', alter: 0, octave: 4, forceAccidental: true }])
  })

  it('stemDirection', () => { expect(piece.stemDirection).toBe('up') })
  it('articulations', () => { expect(piece.articulations).toEqual(['staccato']) })
  it('articulationPlacement', () => { expect(piece.articulationPlacement).toBe('below') })

  it('🚨 articulationStemAlign — the field this audit caught being eaten (2026-08-30)', () => {
    expect(piece.articulationStemAlign).toBe(true)
  })

  it('⭐ fractionalBeamSide — an authored stub direction survives a re-lay (P4c)', () => {
    expect(piece.fractionalBeamSide).toBe('right')
  })

  it('tremolo', () => { expect(piece.tremolo).toBe(3) })
  it('beam', () => { expect(piece.beam).toBe('begin') })
  it('secondaryBreak', () => { expect(piece.secondaryBreak).toBe(true) })

  // ⭐ Compared WITHOUT the pitch ids: the relay copies with fresh ones (`cloneGraceFresh`), so a
  // payload pasted twice cannot mint two heads with one id — the id is what must NOT survive.
  const noIds = (g: unknown) => JSON.parse(JSON.stringify(g, (k, v) => (k === 'id' ? undefined : v)))
  it('graceBefore — the group, its flags and its written values', () => {
    expect(noIds(piece.graceBefore)).toEqual({ notes: [{ pitches: [{ step: 'D', alter: 0, octave: 4 }], duration: '8' }], slash: true })
    expect(piece.graceBefore!.notes[0].pitches[0].id).not.toBe('g1')
  })
  it('graceAfter — the slur\'s off-switch travels with it', () => {
    expect(noIds(piece.graceAfter)).toEqual({ notes: [{ pitches: [{ step: 'F', alter: 1, octave: 4 }], duration: '16' }], slur: false })
    expect(piece.graceAfter!.notes[0].pitches[0].id).not.toBe('g2')
  })

  it('fan — carried on its own fixture, since it cannot share a slot with a tremolo', () => {
    const fanned: Chord = { ...loadedChord(), tremolo: undefined, fan: { direction: 'accel', count: 6, beams: 3 } }
    expect(roundTrip(fanned).fan).toEqual({ direction: 'accel', count: 6, beams: 3 })
  })

  /**
   * ⚠️ The anti-rot guard. `fan` is asserted in its own case above; every other carried field has one
   * in this block. Classify a field as `carried` and this fails until its assertion exists.
   */
  it('⭐ and every carried field has an assertion here', () => {
    const asserted: SlotField[] = [
      'duration', 'dots', 'notes', 'stemDirection', 'articulations', 'articulationPlacement',
      'articulationStemAlign', 'fractionalBeamSide', 'tremolo', 'beam', 'secondaryBreak', 'fan',
      'graceBefore', 'graceAfter',
    ]
    expect([...CARRIED_SLOT_FIELDS].sort()).toEqual([...asserted].sort())
  })
})

describe('what the table calls DROPPED really is', () => {
  it("beamOver — the rest's beaming statement is about neighbours a re-lay may have changed", () => {
    const rest: Rest = { id: 'r1', type: 'rest', beat: F(0), duration: 'q', measure: 1, beamOver: true }
    expect(roundTrip(rest)).not.toHaveProperty('beamOver')
    expect(SLOT_FIELD_TRAVEL.beamOver).toBe('dropped')
  })
})
