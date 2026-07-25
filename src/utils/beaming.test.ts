import { describe, it, expect } from 'vitest'
import { beamRoleAt, computeBeamGroups, computeCrossBarBeamGroups, getBeatGroup, isBeamableDuration, secondaryBreakIndices, type BeamBar } from './beaming'
import { getMeterInfo, type MeterInfo } from './meter'
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

describe('beaming — additive grouping (Phase 6b)', () => {
  it('8/8 with a stored 3+3+2 grouping beams eighths 3+3+2', () => {
    const m = getMeterInfo(ts(8, 8), [3, 3, 2]) // group lengths 1.5, 1.5, 1 quarters
    expect(computeBeamGroups(run(8, '8', 2), m)).toEqual([
      [0, 1, 2], [3, 4, 5], [6, 7],
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

describe('beaming — beam over a rest (the "beamed rest")', () => {
  /** A rest carrying `beamOver`. */
  const restOver = (beat: number, beatDen: number, duration: NoteDuration = '8'): ChordRest =>
    ({ id: `r${idSeq++}`, type: 'rest', beat: fracCreate(beat, beatDen), duration, measure: 1, beamOver: true })

  it('an INTERIOR beamOver rest is swept into the group — the beam runs over it', () => {
    // Four sixteenths in ONE beat, the 2nd a beamOver rest: C 𝄾 E F → one beam over all four.
    const slots = [chord(0, 4, '16'), restOver(1, 4, '16'), chord(2, 4, '16'), chord(3, 4, '16')]
    expect(computeBeamGroups(slots, meter(4, 4))).toEqual([[0, 1, 2, 3]])
  })

  it('without the flag the same rest still breaks the beam (default unchanged)', () => {
    const slots = [chord(0, 4, '16'), rest(1, 4, '16'), chord(2, 4, '16'), chord(3, 4, '16')]
    expect(computeBeamGroups(slots, meter(4, 4))).toEqual([[2, 3]])
  })

  it('a LEADING beamOver rest never starts a group', () => {
    const slots = [restOver(0, 4, '16'), chord(1, 4, '16'), chord(2, 4, '16')]
    expect(computeBeamGroups(slots, meter(4, 4))).toEqual([[1, 2]])
  })

  it('a TRAILING beamOver rest is trimmed — a beam never hangs off a rest', () => {
    const slots = [chord(0, 4, '16'), chord(1, 4, '16'), restOver(2, 4, '16')]
    expect(computeBeamGroups(slots, meter(4, 4))).toEqual([[0, 1]])
  })

  it('two adjacent interior beamOver rests are both enclosed', () => {
    const slots = [chord(0, 4, '16'), restOver(1, 4, '16'), restOver(2, 4, '16'), chord(3, 4, '16')]
    expect(computeBeamGroups(slots, meter(4, 4))).toEqual([[0, 1, 2, 3]])
  })

  it('a beamOver rest ON A BEAT BOUNDARY bridges it — one click, no `continue` on the neighbour', () => {
    // The reported UX case: C C 𝄾 C as EIGHTHS, the rest at beat 1.0 (the 0|1 beat boundary). Marking
    // the rest beamOver is a silent `continue`, so the whole run beams as one — the neighbour needs no
    // mark. Without the flag this would be (C C)(C) two beats; beamOver makes the rest do the bridging.
    const slots = [chord(0, 2), chord(1, 2), restOver(1, 1), chord(3, 2)]
    expect(computeBeamGroups(slots, meter(4, 4))).toEqual([[0, 1, 2, 3]])
  })

  it('a beamOver rest inside a manual begin…end group is enclosed too', () => {
    // begin on C, end on F, a beamOver rest between: one manual beam over the rest across the beat.
    const slots = [chord(0, 2, '8', 'begin'), restOver(1, 2), chord(1, 1, '8', 'continue'), chord(3, 2, '8', 'end')]
    expect(computeBeamGroups(slots, meter(4, 4))).toEqual([[0, 1, 2, 3]])
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

  // Eight eighths in 4/4 beam 2+2+2+2. A single `continue` bridges ONE boundary — the one it
  // straddles — and the answer must not depend on which side of that boundary the marked note sits.
  // It used to: `continue` removed only the break BEHIND the note, so it worked on the first note of
  // a group and did nothing at all on the last.
  const eightEighths = (at: number, beam: BeamMode) =>
    run(8, '8', 2).map((slot, i) => (i === at ? { ...slot, beam } : slot))

  it("'continue' on the FIRST note of a group joins it to the group behind", () => {
    expect(computeBeamGroups(eightEighths(2, 'continue'), meter(4, 4)))
      .toEqual([[0, 1, 2, 3], [4, 5], [6, 7]])
  })

  it("'continue' on the LAST note of a group joins it to the group ahead", () => {
    expect(computeBeamGroups(eightEighths(1, 'continue'), meter(4, 4)))
      .toEqual([[0, 1, 2, 3], [4, 5], [6, 7]])
  })

  it("'continue' bridges ONE boundary, not every boundary after it", () => {
    // Groups 2 and 3 are untouched above — this states it as the point, not a side effect.
    const groups = computeBeamGroups(eightEighths(1, 'continue'), meter(4, 4))
    expect(groups).toHaveLength(3)
  })

  it("'begin' starts a beam that the METER ends — it does not run to the end of the bar", () => {
    // Reported 2026-07-24 with a screenshot. Eight eighths beamed 2+2+2+2, `begin` on the second:
    // expected (1) (2 3 4) (5 6) (7 8) — the note before is cut loose, the marked note starts a beam,
    // and the group closes where the meter says. What it engraved was ONE seven-note beam with the
    // first note flagged: the group never terminated, every note after the mark reading `continue`.
    //
    // The bug was the missing END, not the taking of the next note. `begin` still takes it — a beam
    // of one note is not a beam, and MusicXML's grammar says the same (a `begin` is followed by
    // `continue`s and an `end`) — but only ONE boundary is bridged, so the meter closes the group
    // right after.
    expect(computeBeamGroups(eightEighths(1, 'begin'), meter(4, 4)))
      .toEqual([[1, 2, 3], [4, 5], [6, 7]])
    expect([0, 1, 2, 3].map(i => beamRoleAt(eightEighths(1, 'begin'), meter(4, 4), i)))
      .toEqual(['single', 'begin', 'continue', 'end'])
  })

  it("'begin' on a note that already starts a group changes nothing", () => {
    expect(computeBeamGroups(eightEighths(2, 'begin'), meter(4, 4)))
      .toEqual([[0, 1], [2, 3], [4, 5], [6, 7]])
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

describe('beaming — computeCrossBarBeamGroups (a beam through the barline)', () => {
  // docs/cross-barline-beaming-plan.md. Refs are (bar, slot) within the RUN, and the run is one
  // lane — one voice of one staff.
  const bar = (slots: ChordRest[], m: MeterInfo): BeamBar => ({ slots, meter: m })
  const at = (b: number, s: number) => ({ bar: b, slot: s })
  /** Eight eighths in 4/4, with `beam` on slot `index`. */
  const eighths = (index?: number, beam?: BeamMode) =>
    run(8, '8', 2).map((slot, i) => (i === index ? { ...slot, beam } : slot))

  it('one bar is a run of one — the same answer computeBeamGroups gives', () => {
    const slots = run(8, '8', 2)
    expect(computeCrossBarBeamGroups([bar(slots, meter(4, 4))])).toEqual(
      computeBeamGroups(slots, meter(4, 4)).map(g => g.map(i => at(0, i))),
    )
  })

  it('the barline is an UNCONDITIONAL break — beat 0 of bar 2 does not join beat 3 of bar 1', () => {
    // The trap the run exists to state: `beat` is bar-relative, so the last group of bar 1 and the
    // first of bar 2 would compare equal under the metric rule alone.
    const groups = computeCrossBarBeamGroups([
      bar(eighths(), meter(4, 4)),
      bar(eighths(), meter(4, 4)),
    ])
    expect(groups).toEqual([
      [at(0, 0), at(0, 1)], [at(0, 2), at(0, 3)], [at(0, 4), at(0, 5)], [at(0, 6), at(0, 7)],
      [at(1, 0), at(1, 1)], [at(1, 2), at(1, 3)], [at(1, 4), at(1, 5)], [at(1, 6), at(1, 7)],
    ])
  })

  it("'continue' on the LAST note of bar 1 opens the barline", () => {
    const groups = computeCrossBarBeamGroups([
      bar(eighths(7, 'continue'), meter(4, 4)),
      bar(eighths(), meter(4, 4)),
    ])
    expect(groups[3]).toEqual([at(0, 6), at(0, 7), at(1, 0), at(1, 1)])
  })

  it("'continue' on the FIRST note of bar 2 opens it from the other side — same group", () => {
    // `continue` means the same thing wherever it sits (docs/beaming.md); a barline is a boundary
    // like any other, so the mark must work from either side of it.
    const groups = computeCrossBarBeamGroups([
      bar(eighths(), meter(4, 4)),
      bar(eighths(0, 'continue'), meter(4, 4)),
    ])
    expect(groups[3]).toEqual([at(0, 6), at(0, 7), at(1, 0), at(1, 1)])
  })

  it('opening one barline does not open the next — the run stays 8 groups + the join', () => {
    const groups = computeCrossBarBeamGroups([
      bar(eighths(7, 'continue'), meter(4, 4)),
      bar(eighths(), meter(4, 4)),
      bar(eighths(), meter(4, 4)),
    ])
    // 12 untouched groups (3 in bar 1, 3 in bar 2, 4 in bar 3) + the one that crosses.
    expect(groups).toHaveLength(11)
    expect(groups.filter(g => g.some(r => r.bar !== g[0].bar))).toHaveLength(1)
  })

  it('a mark at each barline runs the beam through both', () => {
    const groups = computeCrossBarBeamGroups([
      bar(eighths(7, 'continue'), meter(4, 4)),
      bar(eighths(7, 'continue'), meter(4, 4)),
      bar(eighths(), meter(4, 4)),
    ])
    expect(groups.filter(g => g.some(r => r.bar !== g[0].bar))).toEqual([
      [at(0, 6), at(0, 7), at(1, 0), at(1, 1)],
      [at(1, 6), at(1, 7), at(2, 0), at(2, 1)],
    ])
  })

  it('`begin` does NOT cross — it is a break, and a break cannot reach over a barline', () => {
    const groups = computeCrossBarBeamGroups([
      bar(eighths(7, 'begin'), meter(4, 4)), // on the very note that would carry a join
      bar(eighths(), meter(4, 4)),
    ])
    expect(groups.every(g => g.every(r => r.bar === g[0].bar))).toBe(true)
    // …and inside bar 1 it did what it says: the pair on beat 4 is broken, both halves left alone.
    expect(groups.filter(g => g[0].bar === 0)).toEqual([
      [at(0, 0), at(0, 1)], [at(0, 2), at(0, 3)], [at(0, 4), at(0, 5)],
    ])
  })

  it("`begin` … `continue` at the barline … `end` spans two bars and stops at the `end`", () => {
    const first = run(8, '8', 2).map((slot, i) =>
      i === 6 ? { ...slot, beam: 'begin' as BeamMode } : i === 7 ? { ...slot, beam: 'continue' as BeamMode } : slot)
    const second = run(8, '8', 2).map((slot, i) => (i === 2 ? { ...slot, beam: 'end' as BeamMode } : slot))
    const groups = computeCrossBarBeamGroups([bar(first, meter(4, 4)), bar(second, meter(4, 4))])
    expect(groups[3]).toEqual([at(0, 6), at(0, 7), at(1, 0), at(1, 1), at(1, 2)])
    // Metric grouping resumes after the `end`: slot 3 is the tail of the second quarter and now
    // alone in it (min-2 drops it), so the next beam is the third quarter's pair.
    expect(groups[4]).toEqual([at(1, 4), at(1, 5)])
  })

  it('a group that crossed ends where the METER says, in the bar it crossed into', () => {
    // One `continue` opens one barline and buys nothing else: the beam runs into bar 2's first beat
    // and stops there, and bar 3 is untouched.
    const first = run(8, '8', 2).map((slot, i) =>
      i === 6 ? { ...slot, beam: 'begin' as BeamMode } : i === 7 ? { ...slot, beam: 'continue' as BeamMode } : slot)
    const groups = computeCrossBarBeamGroups([
      bar(first, meter(4, 4)),
      bar(eighths(), meter(4, 4)),
      bar(eighths(), meter(4, 4)),
    ])
    const crossing = groups.filter(g => g.some(r => r.bar !== g[0].bar))
    expect(crossing).toEqual([[at(0, 6), at(0, 7), at(1, 0), at(1, 1)]])
    expect(groups.filter(g => g[0].bar === 1)).toHaveLength(3) // bar 2 keeps its other three beams
    expect(groups.filter(g => g[0].bar === 2)).toHaveLength(4) // bar 3 groups normally
  })

  it('each bar keeps its OWN meter — a run may contain a time-signature change', () => {
    const groups = computeCrossBarBeamGroups([
      bar(run(6, '8', 2), meter(6, 8)), // 3+3
      bar(run(6, '8', 2), meter(3, 4)), // 2+2+2
    ])
    expect(groups).toEqual([
      [at(0, 0), at(0, 1), at(0, 2)], [at(0, 3), at(0, 4), at(0, 5)],
      [at(1, 0), at(1, 1)], [at(1, 2), at(1, 3)], [at(1, 4), at(1, 5)],
    ])
  })

  it('the join crosses a meter change when it is marked', () => {
    const first = run(6, '8', 2).map((slot, i) => (i === 5 ? { ...slot, beam: 'continue' as BeamMode } : slot))
    const groups = computeCrossBarBeamGroups([
      bar(first, meter(6, 8)),
      bar(run(6, '8', 2), meter(3, 4)),
    ])
    expect(groups[1]).toEqual([at(0, 3), at(0, 4), at(0, 5), at(1, 0), at(1, 1)])
  })

  it('a rest across the barline breaks it, marked or not — you cannot beam silence', () => {
    const first = run(8, '8', 2).map((slot, i) => (i === 7 ? { ...slot, beam: 'continue' as BeamMode } : slot))
    const second: ChordRest[] = [rest(0, 1), ...run(8, '8', 2).slice(1)]
    const groups = computeCrossBarBeamGroups([bar(first, meter(4, 4)), bar(second, meter(4, 4))])
    expect(groups.every(g => g.every(r => r.bar === g[0].bar))).toBe(true)
    expect(groups[3]).toEqual([at(0, 6), at(0, 7)])
  })

  it('a non-beamable note across the barline breaks it too', () => {
    const first = run(8, '8', 2).map((slot, i) => (i === 7 ? { ...slot, beam: 'continue' as BeamMode } : slot))
    const second = [chord(0, 1, 'q'), ...run(8, '8', 2).slice(2)]
    const groups = computeCrossBarBeamGroups([bar(first, meter(4, 4)), bar(second, meter(4, 4))])
    expect(groups.every(g => g.every(r => r.bar === g[0].bar))).toBe(true)
  })

  it('a lone note each side is a legal join — the min-2 rule counts the whole group', () => {
    // `♪ | ♪` — the canonical case, and the one with no beam on either side of the barline today.
    const groups = computeCrossBarBeamGroups([
      bar([chord(0, 1, 'q'), chord(1, 1, 'q'), chord(2, 1, 'q'), chord(3, 1, '8', 'continue')], meter(4, 4)),
      bar([chord(0, 1, '8'), chord(1, 2, 'q'), chord(3, 2, 'q'), chord(5, 2, 'q')], meter(4, 4)),
    ])
    expect(groups).toEqual([[at(0, 3), at(1, 0)]])
  })

  it('an empty bar in the run breaks the beam', () => {
    const groups = computeCrossBarBeamGroups([
      bar(eighths(7, 'continue'), meter(4, 4)),
      bar([], meter(4, 4)),
      bar(eighths(), meter(4, 4)),
    ])
    expect(groups.every(g => g.every(r => r.bar === g[0].bar))).toBe(true)
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

describe('beaming — beamRoleAt (what the note ACTUALLY is)', () => {
  it('4/4 eighths beamed 2+2+2+2: each pair reads begin then end, all of them auto', () => {
    // The case the palette was silent about: eight notes, not one of them authored, four beams.
    const slots = run(8, '8', 2)
    const m = meter(4, 4)
    expect(slots.every(s => s.type === 'chord' && s.beam === undefined)).toBe(true)
    expect([0, 1, 2, 3, 4, 5, 6, 7].map(i => beamRoleAt(slots, m, i))).toEqual(
      ['begin', 'end', 'begin', 'end', 'begin', 'end', 'begin', 'end'],
    )
  })

  it('a group of three: begin, continue, end', () => {
    const slots = run(6, '8', 2) // 6/8 → 3+3
    const m = meter(6, 8)
    expect([0, 1, 2].map(i => beamRoleAt(slots, m, i))).toEqual(['begin', 'continue', 'end'])
  })

  it('an unbeamed note is single — a lone eighth, a quarter, a rest', () => {
    const m = meter(4, 4)
    const slots = [chord(0, 1, '8'), chord(1, 1, 'q'), rest(2, 1), chord(3, 1, '8')]
    expect([0, 1, 2, 3].map(i => beamRoleAt(slots, m, i))).toEqual(
      ['single', 'single', 'single', 'single'],
    )
  })

  it('authored and actual can DISAGREE: an orphaned end engraves as single', () => {
    // Nothing behind it to close, so flush drops the one-note group. The palette showing both facts
    // is how you find out the mark did nothing.
    const slots = [chord(0, 1, 'q'), chord(1, 1, '8', 'end'), chord(3, 2, '8')]
    expect(slots[1].type === 'chord' && slots[1].beam).toBe('end')
    expect(beamRoleAt(slots, meter(4, 4), 1)).toBe('single')
  })

  it("a 'continue' that bridges a boundary reads continue, and the bridged note reads end", () => {
    // [0,1,2,3] [4,5] [6,7] — the bridge case from the block above.
    const slots = run(8, '8', 2).map((s, i) => (i === 1 ? { ...s, beam: 'continue' as const } : s))
    const m = meter(4, 4)
    expect([0, 1, 2, 3, 4].map(i => beamRoleAt(slots, m, i))).toEqual(
      ['begin', 'continue', 'continue', 'end', 'begin'],
    )
  })

  it('an index outside the run is single, not a crash', () => {
    expect(beamRoleAt(run(4, '8', 2), meter(4, 4), 99)).toBe('single')
  })
})

describe('beaming — secondaryBreakIndices (subdividing a beam)', () => {
  /** Six sixteenths beamed as ONE group, with a secondary break in front of slot `at`. */
  const sixteenths = (at?: number) =>
    Array.from({ length: 6 }, (_, i) => {
      const slot = chord(i, 4, '16')
      return i === at && slot.type === 'chord' ? { ...slot, secondaryBreak: true } : slot
    })

  it('6 sixteenths subdivided 3+3: the flag on note 4 breaks the beam after note 3', () => {
    // Ours says "break IN FRONT of index 3"; VexFlow wants "the beam ends AFTER index 2".
    expect(secondaryBreakIndices(sixteenths(3))).toEqual([2])
  })

  it('no flags, no breaks — the group draws as one', () => {
    expect(secondaryBreakIndices(sixteenths())).toEqual([])
  })

  it('a flag on the FIRST note is dropped — nothing in front of it to break', () => {
    expect(secondaryBreakIndices(sixteenths(0))).toEqual([])
  })

  it('several breaks subdivide 2+2+2', () => {
    const slots = sixteenths().map((s, i) =>
      (i === 2 || i === 4) && s.type === 'chord' ? { ...s, secondaryBreak: true } : s)
    expect(secondaryBreakIndices(slots)).toEqual([1, 3])
  })

  it('is independent of the beam MODE — the group is auto and still subdivided', () => {
    // 6/8: a dotted-quarter beat group holds all six sixteenths, so the meter alone beams them as
    // one. Not one of them is authored, and the second beam still breaks 3+3 — the two axes are set
    // separately, which is why `secondaryBreak` is not a sixth BeamMode.
    const slots = sixteenths(3)
    expect(slots.every(s => s.type === 'chord' && s.beam === undefined)).toBe(true)
    expect(computeBeamGroups(slots, meter(6, 8))).toEqual([[0, 1, 2, 3, 4, 5]]) // ONE group of six
    expect(secondaryBreakIndices(slots)).toEqual([2])                           // …broken 3+3
  })
})

describe('a two-note tremolo pair is never in an automatic group', () => {
  /**
   * The pair owns its own beam or none (docs/two-note-tremolo-plan.md §2), and the exclusion belongs
   * HERE, in the pure grouper — the cross-barline planner feeds the renderer its own `inBarGroups`,
   * so a pair excluded only at the renderer would still be dragged across a barline by the plan.
   */
  const paired = (slots: ChordRest[], i: number): ChordRest[] =>
    slots.map((s, k) => (k === i && s.type === 'chord' ? { ...s, tremoloPair: true as const } : s))

  it('breaks the group at BOTH of its notes', () => {
    // Four eighths in 4/4 beam 2+2 by the meter.
    expect(computeBeamGroups(run(4, '8', 2), meter(4, 4))).toEqual([[0, 1], [2, 3]])
    // Pair the second and third: neither joins a group, and the outer two are left alone.
    expect(computeBeamGroups(paired(run(4, '8', 2), 1), meter(4, 4))).toEqual([])
  })

  it('leaves the notes around it beaming normally', () => {
    // Six eighths in 6/8 beam 3+3; pair the last two of the FIRST group.
    const slots = paired(run(6, '8', 2), 1)
    expect(computeBeamGroups(slots, meter(6, 8))).toEqual([[3, 4, 5]])
  })

  it('does not break on a STALE flag — a pair whose partner is no longer pairable', () => {
    // The partner is a sixteenth now: not a pair, so the meter beams all four as it always did.
    const slots = paired(run(4, '8', 2), 0)
    const broken = slots.map((s, k) => (k === 1 && s.type === 'chord' ? { ...s, duration: '16' as const } : s))
    expect(computeBeamGroups(broken, meter(4, 4))).toEqual([[0, 1], [2, 3]])
  })

  it('does not cross a BARLINE either — the plan cannot re-join what the grouper split', () => {
    const bars: BeamBar[] = [
      { slots: paired(run(2, '8', 2), 0), meter: meter(1, 4) },
      { slots: run(2, '8', 2), meter: meter(1, 4) },
    ]
    // Only the second bar's own pair-free notes beam.
    expect(computeCrossBarBeamGroups(bars)).toEqual([[{ bar: 1, slot: 0 }, { bar: 1, slot: 1 }]])
  })
})

describe('beamRoleAt on a two-note tremolo pair — the pair answers for itself', () => {
  /**
   * The grouper cannot see the pair's beam: the pair is excluded there on purpose and the `Beam` is
   * built by the renderer. So without this the Keypad's beam keys light `single` on a note the
   * reader can plainly see beamed.
   */
  const pairOf = (duration: NoteDuration, beam?: BeamMode): ChordRest[] => {
    const a = chord(0, 2, duration, beam)
    const b = chord(1, 2, duration)
    return [a.type === 'chord' ? { ...a, tremoloPair: true as const } : a, b]
  }

  it('BEAMED: the first note begins the beam, the second ends it', () => {
    const slots = pairOf('16')
    expect(beamRoleAt(slots, meter(4, 4), 0)).toBe('begin')
    expect(beamRoleAt(slots, meter(4, 4), 1)).toBe('end')
  })

  it('authored `single`: drawn apart, and the pad says so', () => {
    const slots = pairOf('16', 'single')
    expect(beamRoleAt(slots, meter(4, 4), 0)).toBe('single')
    expect(beamRoleAt(slots, meter(4, 4), 1)).toBe('single')
  })

  it('a drawn half or quarter has no beam to report', () => {
    for (const d of ['q', '8'] as NoteDuration[]) {
      expect(beamRoleAt(pairOf(d), meter(4, 4), 0)).toBe('single')
    }
  })

  it('a STALE flag falls back to the meter, like any other note', () => {
    const a = chord(0, 2, '8')
    const stale: ChordRest[] = [{ ...(a as never as { type: 'chord' }), tremoloPair: true } as ChordRest, chord(1, 2, '16')]
    // Not a pair (different values), so these two are just notes — and the meter beams them.
    expect(beamRoleAt(stale, meter(4, 4), 0)).toBe('begin')
    expect(beamRoleAt(stale, meter(4, 4), 1)).toBe('end')
  })
})
