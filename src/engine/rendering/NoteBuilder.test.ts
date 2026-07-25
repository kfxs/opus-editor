import { describe, it, expect } from 'vitest'
import {
  resolveTupletLocation,
  innerFlipTupletYOffset,
  createStaveNotesFromSlots,
  restSupportingLedgerLine,
  TUPLET_LOCATION_ABOVE,
  TUPLET_LOCATION_BELOW,
  type TupletNoteStem,
} from './NoteBuilder'
import { fracCreate as frac } from '@/utils/fraction'
import type { ChordRest } from '@/types/music'

describe('resolveTupletLocation', () => {
  // A stem-derived fallback distinct from both voice defaults, so we can tell
  // when the single-voice branch is (and isn't) used.
  const FALLBACK = TUPLET_LOCATION_BELOW

  it('honours an explicit "above" override regardless of voice/multiVoice', () => {
    expect(resolveTupletLocation('above', false, 0, FALLBACK)).toBe(TUPLET_LOCATION_ABOVE)
    expect(resolveTupletLocation('above', true, 1, FALLBACK)).toBe(TUPLET_LOCATION_ABOVE)
  })

  it('honours an explicit "below" override regardless of voice/multiVoice', () => {
    expect(resolveTupletLocation('below', false, 0, TUPLET_LOCATION_ABOVE)).toBe(TUPLET_LOCATION_BELOW)
    expect(resolveTupletLocation('below', true, 0, TUPLET_LOCATION_ABOVE)).toBe(TUPLET_LOCATION_BELOW)
  })

  it('multi-voice: stems-up voices (V1/V3, model 0/2) bracket above', () => {
    expect(resolveTupletLocation(undefined, true, 0, FALLBACK)).toBe(TUPLET_LOCATION_ABOVE)
    expect(resolveTupletLocation(undefined, true, 2, FALLBACK)).toBe(TUPLET_LOCATION_ABOVE)
  })

  it('multi-voice: stems-down voices (V2/V4, model 1/3) bracket below', () => {
    expect(resolveTupletLocation(undefined, true, 1, TUPLET_LOCATION_ABOVE)).toBe(TUPLET_LOCATION_BELOW)
    expect(resolveTupletLocation(undefined, true, 3, TUPLET_LOCATION_ABOVE)).toBe(TUPLET_LOCATION_BELOW)
  })

  it('single voice: uses the stem-derived fallback', () => {
    expect(resolveTupletLocation(undefined, false, 0, TUPLET_LOCATION_ABOVE)).toBe(TUPLET_LOCATION_ABOVE)
    expect(resolveTupletLocation(undefined, false, 0, TUPLET_LOCATION_BELOW)).toBe(TUPLET_LOCATION_BELOW)
  })
})

describe('innerFlipTupletYOffset', () => {
  // A lower voice (voice 1) with stems down; noteheads (baseY) low on the page.
  const downStems: TupletNoteStem[] = [
    { stemUp: false, topY: 220, baseY: 160 },
    { stemUp: false, topY: 225, baseY: 165 },
  ]
  // The primary voice (voice 0) with stems up; noteheads (baseY) around the staff.
  const upStems: TupletNoteStem[] = [
    { stemUp: true, topY: 40, baseY: 110 },
    { stemUp: true, topY: 45, baseY: 115 },
  ]

  it('is a no-op for a single voice', () => {
    expect(innerFlipTupletYOffset(downStems, TUPLET_LOCATION_ABOVE, 1, false, 5)).toBe(0)
  })

  it('is a no-op for an OUTER bracket (voice 0 above, lower voice below)', () => {
    expect(innerFlipTupletYOffset(upStems, TUPLET_LOCATION_ABOVE, 0, true, 5)).toBe(0)
    expect(innerFlipTupletYOffset(downStems, TUPLET_LOCATION_BELOW, 1, true, 300)).toBe(0)
  })

  it('lower voice flipped ABOVE: nudges DOWN toward its own notes (positive offset)', () => {
    // clampedY = 5 (VexFlow shoved it above the system); desired = min(baseY-20) = 140.
    const off = innerFlipTupletYOffset(downStems, TUPLET_LOCATION_ABOVE, 1, true, 5)
    expect(off).toBe(140 - 5)
    expect(off).toBeGreaterThan(0)
  })

  it('voice 0 flipped BELOW: nudges UP toward its own notes (negative offset)', () => {
    // clampedY = 300 (shoved below the system); desired = max(baseY+20) = 135.
    const off = innerFlipTupletYOffset(upStems, TUPLET_LOCATION_BELOW, 0, true, 300)
    expect(off).toBe(135 - 300)
    expect(off).toBeLessThan(0)
  })

  it('never nudges further toward the edge (clamped to 0)', () => {
    // Above-flip where desired is already higher than clamped → would push up; clamp to 0.
    expect(innerFlipTupletYOffset(downStems, TUPLET_LOCATION_ABOVE, 1, true, 999)).toBe(140 - 999 < 0 ? 0 : 140 - 999)
    expect(innerFlipTupletYOffset(downStems, TUPLET_LOCATION_ABOVE, 1, true, 999)).toBe(0)
  })

  it('is a no-op with no notes', () => {
    expect(innerFlipTupletYOffset([], TUPLET_LOCATION_ABOVE, 1, true, 5)).toBe(0)
  })
})

describe('createStaveNotesFromSlots — per-rest vertical shift (docs/rest-shift-plan.md §6.8)', () => {
  const restSlot = (id: string, beatNum: number): ChordRest =>
    ({ type: 'rest', id, beat: frac(beatNum, 1), duration: 'q', voice: 0 } as unknown as ChordRest)

  it('a numeric restLineShift lifts every rest by that many lines (the voice base)', () => {
    const [base] = createStaveNotesFromSlots([restSlot('r', 0)], 'treble', undefined, 0)
    const [lifted] = createStaveNotesFromSlots([restSlot('r', 0)], 'treble', undefined, 2)
    expect(lifted.getKeyLine(0)).toBe(base.getKeyLine(0) + 2)
  })

  it('a resolver applies a DIFFERENT shift per rest slot (base + override)', () => {
    const notes = createStaveNotesFromSlots(
      [restSlot('a', 0), restSlot('b', 1)],
      'treble',
      undefined,
      (s) => (s.id === 'b' ? 3 : 0),
    )
    expect(notes[1].getKeyLine(0) - notes[0].getKeyLine(0)).toBe(3)
  })
})

describe('restSupportingLedgerLine (off-staff whole/half rest support, docs/rest-shift-plan.md §10)', () => {
  it('only whole/half rests are line-attached — shorter rests never get a ledger', () => {
    for (const d of ['q', '8', '16', '32'] as const) {
      expect(restSupportingLedgerLine(d, false, 8)).toBeNull()   // even far off-staff
      expect(restSupportingLedgerLine(d, false, -3)).toBeNull()
    }
  })

  it('a whole or half rest INSIDE the staff (lines 1–5) needs no ledger', () => {
    for (const line of [1, 2, 3, 4, 5]) {
      expect(restSupportingLedgerLine('w', false, line)).toBeNull()
      expect(restSupportingLedgerLine('h', false, line)).toBeNull()
    }
  })

  it('a whole/half rest OFF the staff gets exactly ONE supporting line, at its key line', () => {
    expect(restSupportingLedgerLine('w', false, 6)).toBe(6)   // first above
    expect(restSupportingLedgerLine('h', false, 7)).toBe(7)   // higher above — still just one
    expect(restSupportingLedgerLine('w', false, 0)).toBe(0)   // first below
    expect(restSupportingLedgerLine('h', false, -2)).toBe(-2) // lower below — still just one
  })

  it('treats a whole-measure rest as line-attached regardless of its stored duration', () => {
    expect(restSupportingLedgerLine('q', true, 6)).toBe(6)
    expect(restSupportingLedgerLine('q', true, 3)).toBeNull() // measure rest inside staff
  })
})

describe('createStaveNotesFromSlots — a two-note tremolo pair', () => {
  /**
   * The pair is WRITTEN at double its value and PLAYS at its own: the StaveNote carries the doubled
   * duration, and `applyTickMultiplier(1, 2)` halves the ticks back so the formatter spaces it over
   * its real length and a FULL-mode voice is not handed twice the bar (docs/two-note-tremolo-plan.md
   * §2, "the four traps").
   */
  let seq = 0
  const chord = (beat: number, duration: 'h' | 'q' | '8', extra: object = {}): ChordRest => ({
    id: `c${seq++}`, type: 'chord', beat: frac(beat, 2), duration, measure: 1,
    notes: [{ id: `p${seq++}`, step: 'C', alter: 0, octave: 4 }],
    ...extra,
  })

  it('draws two quarters as two HALVES, at the ticks of quarters', () => {
    const plain = createStaveNotesFromSlots([chord(0, 'q'), chord(2, 'q')])
    const paired = createStaveNotesFromSlots([chord(0, 'q', { tremoloPair: true }), chord(2, 'q')])

    expect(paired.map(n => n.getDuration())).toEqual(['h', 'h'])
    expect(paired[0].getTicks().value()).toBe(plain[0].getTicks().value())
    expect(paired[1].getTicks().value()).toBe(plain[1].getTicks().value())
  })

  it('doubles eighths to quarters — which is what takes their flags away', () => {
    const paired = createStaveNotesFromSlots([chord(0, '8', { tremoloPair: true }), chord(1, '8')])
    expect(paired.map(n => n.getDuration())).toEqual(['q', 'q'])
  })

  it('leaves a STALE flag alone — the partner is no longer pairable', () => {
    const stale = createStaveNotesFromSlots([chord(0, 'q', { tremoloPair: true }), chord(2, 'h')])
    expect(stale.map(n => n.getDuration())).toEqual(['q', 'h'])
  })

  it('gives BOTH stems one direction, decided over both notes', () => {
    // A high C6 and a low C3: apart, each would stem the other way.
    const high: ChordRest = {
      id: 'hi', type: 'chord', beat: frac(0, 1), duration: 'q', measure: 1,
      notes: [{ id: 'hp', step: 'C', alter: 0, octave: 6 }], tremoloPair: true,
    }
    const low: ChordRest = {
      id: 'lo', type: 'chord', beat: frac(1, 1), duration: 'q', measure: 1,
      notes: [{ id: 'lp', step: 'C', alter: 0, octave: 3 }],
    }
    const [a, b] = createStaveNotesFromSlots([high, low])
    expect(a.getStemDirection()).toBe(b.getStemDirection())
    // Unpaired, the same two notes disagree — which is what makes the check mean something.
    const [x, y] = createStaveNotesFromSlots([{ ...high, tremoloPair: undefined }, low])
    expect(x.getStemDirection()).not.toBe(y.getStemDirection())
  })

  it('wears NO stem strokes — the mark moved into the gap', () => {
    const paired = createStaveNotesFromSlots([
      chord(0, 'q', { tremoloPair: true, tremolo: 3 }), chord(2, 'q'),
    ])
    expect(paired[0].getModifiers()).toHaveLength(0)
    // Un-paired, the same slot wears them.
    const single = createStaveNotesFromSlots([chord(0, 'q', { tremolo: 3 }), chord(2, 'q')])
    expect(single[0].getModifiers()).toHaveLength(1)
  })
})
