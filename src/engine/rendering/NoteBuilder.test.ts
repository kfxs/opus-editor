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

  it('multi-voice: primary voice (0) bracket goes above', () => {
    expect(resolveTupletLocation(undefined, true, 0, FALLBACK)).toBe(TUPLET_LOCATION_ABOVE)
  })

  it('multi-voice: lower voices bracket goes below', () => {
    expect(resolveTupletLocation(undefined, true, 1, TUPLET_LOCATION_ABOVE)).toBe(TUPLET_LOCATION_BELOW)
    expect(resolveTupletLocation(undefined, true, 2, TUPLET_LOCATION_ABOVE)).toBe(TUPLET_LOCATION_BELOW)
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
