import { describe, it, expect } from 'vitest'
import { computeBeamGroups, getBeatGroup, isBeamableDuration } from './beaming'
import { getMeterInfo } from './meter'
import { fracCreate } from './fraction'
import type { TimeSignature, ChordRest, NoteDuration, BeamMode } from '@/types/music'

// --- helpers ---------------------------------------------------------------

const ts = (n: number, d: number): TimeSignature => ({ numerator: n, denominator: d })
const meter = (n: number, d: number, grouping?: number[]) => getMeterInfo(ts(n, d), grouping)

let idSeq = 0
const note = () => ({ id: `n${idSeq++}`, step: 'B' as const, alter: 0 as const, octave: 4 })

/** A chord slot at `beat` (in quarter units) with the given duration/beam. */
function chord(beat: number, beatDen: number, duration: NoteDuration = '8', beam?: BeamMode): ChordRest {
  return {
    id: `c${idSeq++}`,
    type: 'chord',
    beat: fracCreate(beat, beatDen),
    duration,
    measure: 1,
    notes: [note()],
    ...(beam ? { beam } : {}),
  }
}

/** A rest slot at `beat`. */
function rest(beat: number, beatDen: number, duration: NoteDuration = '8'): ChordRest {
  return { id: `r${idSeq++}`, type: 'rest', beat: fracCreate(beat, beatDen), duration, measure: 1 }
}

/**
 * Build `count` consecutive `duration` notes starting at beat 0.
 * Eighths advance by 1/2 quarter, sixteenths by 1/4, etc.
 */
function run(count: number, duration: NoteDuration, stepDen: number): ChordRest[] {
  const slots: ChordRest[] = []
  for (let i = 0; i < count; i++) slots.push(chord(i, stepDen, duration))
  return slots
}

// ---------------------------------------------------------------------------

describe('beaming — isBeamableDuration', () => {
  it('eighth and shorter are beamable', () => {
    expect(isBeamableDuration('8')).toBe(true)
    expect(isBeamableDuration('16')).toBe(true)
    expect(isBeamableDuration('32')).toBe(true)
  })
  it('quarter and longer are not beamable', () => {
    expect(isBeamableDuration('q')).toBe(false)
    expect(isBeamableDuration('h')).toBe(false)
    expect(isBeamableDuration('w')).toBe(false)
  })
})

describe('beaming — getBeatGroup', () => {
  it('4/4 groups per quarter (matches the old Math.floor behavior)', () => {
    const m = meter(4, 4)
    expect(getBeatGroup(fracCreate(0, 1), m)).toBe(0)
    expect(getBeatGroup(fracCreate(1, 2), m)).toBe(0) // 0.5
    expect(getBeatGroup(fracCreate(1, 1), m)).toBe(1)
    expect(getBeatGroup(fracCreate(7, 2), m)).toBe(3) // 3.5
  })

  it('6/8 groups in two dotted-quarter beats (3+3 eighths)', () => {
    const m = meter(6, 8) // groups [1.5, 1.5] quarters
    expect(getBeatGroup(fracCreate(0, 1), m)).toBe(0)
    expect(getBeatGroup(fracCreate(1, 1), m)).toBe(0) // 1.0 < 1.5
    expect(getBeatGroup(fracCreate(3, 2), m)).toBe(1) // 1.5
    expect(getBeatGroup(fracCreate(5, 2), m)).toBe(1) // 2.5
  })

  it('overflow beats past the bar get one distinct index per quarter', () => {
    const m = meter(4, 4) // 4 groups, bar ends at 4
    expect(getBeatGroup(fracCreate(4, 1), m)).toBe(4)
    expect(getBeatGroup(fracCreate(9, 2), m)).toBe(4) // 4.5 — same overflow quarter
    expect(getBeatGroup(fracCreate(5, 1), m)).toBe(5)
  })
})

describe('beaming — computeBeamGroups default grouping by meter', () => {
  it('4/4: eight eighths beam per quarter (4 groups of 2, never crossing mid-bar)', () => {
    expect(computeBeamGroups(run(8, '8', 2), meter(4, 4))).toEqual([
      [0, 1], [2, 3], [4, 5], [6, 7],
    ])
  })

  it('4/4: four sixteenths within a beat stay together; break at the next beat', () => {
    // 8 sixteenths = two quarter-beats of four → two groups of four.
    expect(computeBeamGroups(run(8, '16', 4), meter(4, 4))).toEqual([
      [0, 1, 2, 3], [4, 5, 6, 7],
    ])
  })

  it('3/4: six eighths beam per quarter (3 groups of 2)', () => {
    expect(computeBeamGroups(run(6, '8', 2), meter(3, 4))).toEqual([
      [0, 1], [2, 3], [4, 5],
    ])
  })

  it('6/8: six eighths beam 3+3', () => {
    expect(computeBeamGroups(run(6, '8', 2), meter(6, 8))).toEqual([
      [0, 1, 2], [3, 4, 5],
    ])
  })

  it('9/8: nine eighths beam 3+3+3', () => {
    expect(computeBeamGroups(run(9, '8', 2), meter(9, 8))).toEqual([
      [0, 1, 2], [3, 4, 5], [6, 7, 8],
    ])
  })

  it('7/8: seven eighths beam 2+2+3 (default additive grouping)', () => {
    expect(computeBeamGroups(run(7, '8', 2), meter(7, 8))).toEqual([
      [0, 1], [2, 3], [4, 5, 6],
    ])
  })

  it('12/8: twelve eighths beam in four groups of three', () => {
    expect(computeBeamGroups(run(12, '8', 2), meter(12, 8))).toEqual([
      [0, 1, 2], [3, 4, 5], [6, 7, 8], [9, 10, 11],
    ])
  })
})

describe('beaming — breaks', () => {
  it('a rest breaks the beam group', () => {
    // 4/4: eighth, eighth, rest, eighth, eighth within first two beats.
    const slots = [
      chord(0, 2), chord(1, 2),   // beats 0, 0.5 — group 0
      rest(1, 1),                  // beat 1.0 — break
      chord(3, 2), chord(2, 1),   // beats 1.5, 2.0 — different beat groups
    ]
    expect(computeBeamGroups(slots, meter(4, 4))).toEqual([[0, 1]])
  })

  it('a quarter note (non-beamable) breaks the group', () => {
    const slots = [chord(0, 2), chord(1, 2), chord(1, 1, 'q'), chord(3, 2)]
    expect(computeBeamGroups(slots, meter(4, 4))).toEqual([[0, 1]])
  })

  it('a lone eighth in its own beat is not beamed (min 2)', () => {
    // 4/4: one eighth on beat 0, then a quarter, then one eighth on beat 2.
    const slots = [chord(0, 2), chord(1, 2), chord(1, 1, 'q'), chord(2, 1)]
    expect(computeBeamGroups(slots, meter(4, 4))).toEqual([[0, 1]])
  })
})

describe('beaming — explicit BeamMode overrides', () => {
  it("'single' forces a note out of any beam", () => {
    // Two eighths in beat 0 would beam [0,1]; 'single' on the second breaks it.
    const slots = [chord(0, 2), chord(1, 2, '8', 'single')]
    expect(computeBeamGroups(slots, meter(4, 4))).toEqual([])
    // Sanity: without the override the same two notes beam together.
    expect(computeBeamGroups([chord(0, 2), chord(1, 2)], meter(4, 4))).toEqual([[0, 1]])
  })

  it("'begin'…'end' bridges a beam across a beat boundary", () => {
    // 4/4: eighths on 1.5 and 2.0 straddle the beat-1↔2 boundary; begin/end force one beam.
    const slots = [
      chord(3, 2, '8', 'begin'), // beat 1.5
      chord(2, 1, '8', 'end'),   // beat 2.0 — different beat group, but bridged
    ]
    expect(computeBeamGroups(slots, meter(4, 4))).toEqual([[0, 1]])
  })

  it("'begin'…'continue'…'end' bridges three notes across boundaries", () => {
    const slots = [
      chord(0, 1, '8', 'begin'),    // 0.0
      chord(1, 1, '8', 'continue'), // 1.0
      chord(2, 1, '8', 'end'),      // 2.0
    ]
    expect(computeBeamGroups(slots, meter(4, 4))).toEqual([[0, 1, 2]])
  })
})

describe('beaming — clef-change regression', () => {
  // Companion to the clef-beam decision (docs/note-selection-hit-detection.md):
  // beams stay beamed ACROSS a mid-measure clef change. Grouping is purely
  // metric — computeBeamGroups takes no clef and therefore cannot split a beam
  // group at a clef boundary. Clef only affects stem direction, applied later in
  // the renderer. This test anchors that invariant: a 3+3 group in 6/8 forms two
  // full beams regardless of any clef change that would fall inside a group.
  it('a 6/8 beat group of three eighths stays one beam (clef plays no role)', () => {
    expect(computeBeamGroups(run(6, '8', 2), meter(6, 8))).toEqual([
      [0, 1, 2], [3, 4, 5],
    ])
  })
})
