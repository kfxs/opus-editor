import { describe, it, expect } from 'vitest'
import { levelToGlyphString, dynamicLevelOf } from '@/utils/dynamics'
import { ScoreModel } from './ScoreModel'
import {
  staffContent,
  staffMeasureView,
  staffSlots,
  staffIndexOfId,
  staffIdAtIndex,
  firstStaffId,
  matchesStaff,
  DEFAULT_STAFF_INDEX,
} from './staffContent'
import { measureOpeningClef, measureEndingClef } from '@/utils/clefUtils'
import type { Score, Measure, Chord, Rest, ClefChange, Dynamic, Hairpin, Pedal, Tuplet } from '@/types/music'
import { fracCreate as frac } from '@/utils/fraction'

/**
 * Multi-staff Phase 0 (Option A — flat `staffId` discriminator). These pin the addressing
 * primitive under N>1 (a hand-built two-staff measure) even though the rest of the engine
 * is still N=1, plus the model-level scaffolding: a fresh score has one staff, `staves`
 * round-trips through JSON, absent `staves` defaults to one, and N=1 note projection is
 * unchanged (no `staff` field). See docs/multi-staff-plan.md §4.
 */

const S0 = 'staff-top'
const S1 = 'staff-bottom'

function chord(id: string, beat: number, staffId?: string): Chord {
  return { id, type: 'chord', beat: frac(beat, 4), duration: 'q', measure: 1, staffId, notes: [] }
}
function rest(id: string, beat: number, staffId?: string): Rest {
  return { id, type: 'rest', beat: frac(beat, 4), duration: 'q', measure: 1, staffId }
}

/** A two-staff score with a single measure whose content is split across both staves.
 *  Staff 0's content is left with absent `staffId` (the N=1 storage convention) to prove
 *  absent resolves to the first staff; staff 1's content is explicitly tagged. */
function twoStaffScore(): Score {
  const clefs: ClefChange[] = [
    { id: 'c0', beat: frac(0, 1), clef: 'treble' }, // absent staffId → staff 0
    { id: 'c1', beat: frac(0, 1), clef: 'bass', staffId: S1 },
  ]
  const dynamics: Dynamic[] = [
    { id: 'd0', beat: frac(0, 1), text: levelToGlyphString('mf') }, // → staff 0
    { id: 'd1', beat: frac(0, 1), text: levelToGlyphString('p'), staffId: S1 },
  ]
  const hairpins: Hairpin[] = [
    { id: 'h0', type: 'cresc', beat: frac(0, 1), length: frac(2, 1) }, // → staff 0
    { id: 'h1', type: 'dim', beat: frac(0, 1), length: frac(2, 1), staffId: S1 },
  ]
  const pedals: Pedal[] = [
    { id: 'pd0', beat: frac(0, 1), length: frac(4, 1) }, // → staff 0
    { id: 'pd1', beat: frac(0, 1), length: frac(4, 1), staffId: S1 },
  ]
  const tuplets: Tuplet[] = [
    { id: 't0', startBeat: frac(0, 1), baseDuration: 'q', numNotes: 3, notesOccupied: 2 }, // → staff 0
    { id: 't1', startBeat: frac(0, 1), baseDuration: 'q', numNotes: 3, notesOccupied: 2, staffId: S1 },
  ]
  const measure: Measure = {
    id: 'm1',
    number: 1,
    timeSignature: { numerator: 4, denominator: 4 },
    slots: [
      chord('a', 0), // absent → staff 0
      rest('b', 1, S0), // explicit staff 0 id (also resolves to index 0)
      chord('c', 0, S1),
      rest('d', 1, S1),
    ],
    clefs,
    dynamics,
    hairpins,
    pedals,
    tuplets,
  }
  return {
    id: 'sc',
    title: 't',
    measures: [measure],
    staves: [{ id: S0 }, { id: S1 }],
  }
}

describe('staffContent primitive (N>1 partitioning)', () => {
  const score = twoStaffScore()
  const measure = score.measures[0]

  it('partitions slots by staff, treating absent staffId as the first staff', () => {
    const top = staffSlots(measure, S0, score)
    const bottom = staffSlots(measure, S1, score)
    expect(top.map((s) => s.id)).toEqual(['a', 'b'])
    expect(bottom.map((s) => s.id)).toEqual(['c', 'd'])
  })

  it('partitions clefs / dynamics / tuplets by staff', () => {
    const top = staffContent(measure, S0, score)
    const bottom = staffContent(measure, S1, score)
    expect(top.clefs.map((c) => c.clef)).toEqual(['treble'])
    expect(bottom.clefs.map((c) => c.clef)).toEqual(['bass'])
    expect(top.dynamics.map((d) => dynamicLevelOf(d))).toEqual(['mf'])
    expect(bottom.dynamics.map((d) => dynamicLevelOf(d))).toEqual(['p'])
    expect(top.hairpins.map((h) => h.id)).toEqual(['h0'])
    expect(bottom.hairpins.map((h) => h.id)).toEqual(['h1'])
    expect(top.pedals.map((p) => p.id)).toEqual(['pd0'])
    expect(bottom.pedals.map((p) => p.id)).toEqual(['pd1'])
    expect(top.tuplets.map((t) => t.id)).toEqual(['t0'])
    expect(bottom.tuplets.map((t) => t.id)).toEqual(['t1'])
  })

  it('every slot lands in exactly one staff lane (partition is total + disjoint)', () => {
    const top = staffSlots(measure, S0, score)
    const bottom = staffSlots(measure, S1, score)
    expect(top.length + bottom.length).toBe(measure.slots.length)
  })

  it('resolves staffId ↔ index, with absent/unknown falling back to staff 0', () => {
    expect(staffIndexOfId(score, S0)).toBe(0)
    expect(staffIndexOfId(score, S1)).toBe(1)
    expect(staffIndexOfId(score, undefined)).toBe(DEFAULT_STAFF_INDEX)
    expect(staffIndexOfId(score, 'nope')).toBe(DEFAULT_STAFF_INDEX)
    expect(staffIdAtIndex(score, 0)).toBe(S0)
    expect(staffIdAtIndex(score, 1)).toBe(S1)
    expect(staffIdAtIndex(score, 5)).toBeUndefined()
    expect(firstStaffId(score)).toBe(S0)
  })

  it('matchesStaff is symmetric across absent/explicit first-staff id', () => {
    expect(matchesStaff(undefined, S0, score)).toBe(true) // absent element ~ first staff
    expect(matchesStaff(S0, undefined, score)).toBe(true) // first-staff query ~ absent element
    expect(matchesStaff(undefined, S1, score)).toBe(false)
    expect(matchesStaff(S1, S1, score)).toBe(true)
  })
})

describe('staffMeasureView (per-staff Measure narrowing — the render seam)', () => {
  const score = twoStaffScore()
  const measure = score.measures[0]

  it('narrows a measure to one staff while preserving shared barline/meter facts', () => {
    const top = staffMeasureView(measure, S0, score)
    const bottom = staffMeasureView(measure, S1, score)
    // Shared spine facts are untouched (so per-staff geometry still aligns).
    expect(top.id).toBe(measure.id)
    expect(top.number).toBe(measure.number)
    expect(top.timeSignature).toEqual(measure.timeSignature)
    // Content is filtered to the staff.
    expect(top.slots.map((s) => s.id)).toEqual(['a', 'b'])
    expect(bottom.slots.map((s) => s.id)).toEqual(['c', 'd'])
    expect((top.clefs ?? []).map((c) => c.clef)).toEqual(['treble'])
    expect((bottom.clefs ?? []).map((c) => c.clef)).toEqual(['bass'])
    expect((bottom.dynamics ?? []).map((d) => dynamicLevelOf(d))).toEqual(['p'])
    // ⚠️ The trap this line exists for: a measure-level array the view does not NAME rides the
    // object spread and lands unfiltered on EVERY staff's lane — silently. So assert the top
    // staff does NOT see the bottom's wedge, not merely that the bottom sees its own.
    expect((bottom.hairpins ?? []).map((h) => h.id)).toEqual(['h1'])
    expect((staffMeasureView(measure, S0, score).hairpins ?? []).map((h) => h.id)).toEqual(['h0'])
    // …and the same trap for the pedal, where riding the spread would draw one pedal under every
    // staff AND — once P1 lands — sustain a staff nobody put a foot on.
    expect((bottom.pedals ?? []).map((p) => p.id)).toEqual(['pd1'])
    expect((top.pedals ?? []).map((p) => p.id)).toEqual(['pd0'])
    expect(bottom.tuplets.map((t) => t.id)).toEqual(['t1'])
  })

  it('does not mutate the source measure', () => {
    staffMeasureView(measure, S1, score)
    expect(measure.slots.map((s) => s.id)).toEqual(['a', 'b', 'c', 'd'])
  })
})

describe('staff-aware clef resolution', () => {
  const score = twoStaffScore()

  it('resolves each staff to its own clef; absent staffId = first staff', () => {
    expect(measureOpeningClef(score, 1, S0)).toBe('treble')
    expect(measureOpeningClef(score, 1, S1)).toBe('bass')
    // Absent staffId behaves like the first staff (the N=1 convention).
    expect(measureOpeningClef(score, 1, undefined)).toBe('treble')
    expect(measureEndingClef(score, 1, S1)).toBe('bass')
  })
})

describe('staffContent on a single-staff (N=1) measure', () => {
  it('returns the whole measure for the only staff', () => {
    const model = new ScoreModel('t')
    model.addNote({ measure: 1, beat: frac(0, 4), duration: 'q', step: 'C', octave: 4, alter: 0 })
    const score = model.getScore()
    const measure = score.measures[0]
    const only = firstStaffId(score)
    expect(staffSlots(measure, only, score).length).toBe(measure.slots.length)
    expect(staffSlots(measure, undefined, score).length).toBe(measure.slots.length)
  })
})

describe('staff-aware rest fill (repairMeasureGaps partitions by staff)', () => {
  it('fills each staff’s own gap independently and does not pollute the other staff', () => {
    const model = new ScoreModel('t')
    // Add a second staff and give it a lone quarter note at beat 0 (leaving beats 1..4 open),
    // WITHOUT touching staff 0 (which holds its default whole-measure rest).
    const s2 = 'staff-2'
    const score = model.getScore()
    score.staves = [...(score.staves ?? []), { id: s2 }]
    const m1 = score.measures[0]
    m1.slots.push({
      id: 'n1', type: 'chord', beat: frac(0, 1), duration: 'q', measure: 1, staffId: s2,
      notes: [{ id: 'p1', step: 'C', alter: 0, octave: 3 }],
    })

    model.repairMeasureGaps(1)

    const staff0 = m1.slots.filter((s) => s.staffId === undefined)
    const staff2 = m1.slots.filter((s) => s.staffId === s2)
    // Staff 0 is untouched: still exactly its one measure-rest (staff-2's gap didn't leak in).
    expect(staff0.length).toBe(1)
    expect(staff0[0].type).toBe('rest')
    // Staff 2: the quarter + filler rests for beats 1..4, and every filler carries staffId=s2.
    expect(staff2.some((s) => s.type === 'chord')).toBe(true)
    const staff2Rests = staff2.filter((s) => s.type === 'rest')
    expect(staff2Rests.length).toBeGreaterThan(0)
    expect(staff2Rests.every((s) => s.staffId === s2)).toBe(true)
  })
})

describe('ScoreModel staff-axis scaffolding (N=1)', () => {
  it('a fresh score has exactly one staff', () => {
    const model = new ScoreModel('t')
    expect(model.getScore().staves).toHaveLength(1)
    expect(model.getScore().staves![0].id).toBeTruthy()
  })

  it('round-trips the staves array through JSON', () => {
    const model = new ScoreModel('t')
    const id = model.getScore().staves![0].id
    const reloaded = ScoreModel.fromJSON(model.toJSON())
    expect(reloaded.getScore().staves).toHaveLength(1)
    expect(reloaded.getScore().staves![0].id).toBe(id)
  })

  it('defaults staves to one staff when loading JSON that omits it (no migration)', () => {
    const legacy = {
      id: 'x',
      title: 't',
      measures: [
        { id: 'm1', number: 1, slots: [], timeSignature: { numerator: 4, denominator: 4 }, tuplets: [] },
      ],
    }
    const model = ScoreModel.fromJSON(JSON.stringify(legacy))
    expect(model.getScore().staves).toHaveLength(1)
  })

  it('N=1 note projection carries no staff field (byte-identical output)', () => {
    const model = new ScoreModel('t')
    model.addNote({ measure: 1, beat: frac(0, 4), duration: 'q', step: 'D', octave: 4, alter: 0 })
    for (const note of model.getAllNotes()) {
      expect(note.staff).toBeUndefined()
    }
  })
})
