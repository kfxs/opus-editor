import { describe, it, expect, beforeEach } from 'vitest'
import { ScoreModel } from './ScoreModel'
import {
  canDisplayOn,
  crossPitch,
  crossPitches,
  crossStaffProblems,
  displayStaffIndex,
  hasCrossedHead,
  keepLegalCrossings,
} from './crossStaffOps'
import { findSlot } from './slotLookup'
import { fracCreate as frac } from '@/utils/fraction'
import type { Chord, NotePitch } from '@/types/music'

/** The pitch + chord behind an id, straight off the score — the field is not on the flat `Note`. */
function stored(model: ScoreModel, id: string): { chord: Chord; pitch: NotePitch } {
  const found = findSlot(model.getScore(), id)
  if (!found || found.type !== 'chord') throw new Error('not a chord pitch')
  return found
}

describe('crossStaffOps', () => {
  let model: ScoreModel
  /** Staves top→bottom: 0 · 1 · 2. */
  let staffIds: string[]

  beforeEach(() => {
    model = new ScoreModel()
    model.addStaffBelow(0)
    model.addStaffBelow(1)
    staffIds = model.getScore().staves!.map(s => s.id)
  })

  const add = (step: 'B' | 'D' | 'F', octave: number, staff: number, beat = 0) =>
    model.addNote({ step, alter: 0, octave, duration: 'h', measure: 1, beat: frac(beat, 1), staff })

  it('⭐ the Satie chord: two heads of a bass-staff chord cross, the third stays', () => {
    const b = add('B', 2, 1)
    const d = add('D', 4, 1)
    const f = add('F', 4, 1)
    const { chord } = stored(model, b.id)
    expect(chord.notes).toHaveLength(3)

    const { changed, outcomes } = crossPitches(model.getScore(), [d.id, f.id], -1)

    expect(changed).toBe(true)
    expect(outcomes.map(o => o.result)).toEqual(['crossed', 'crossed'])
    expect(stored(model, d.id).pitch.displayStaffId).toBe(staffIds[0])
    expect(stored(model, f.id).pitch.displayStaffId).toBe(staffIds[0])
    expect(stored(model, b.id).pitch.displayStaffId).toBeUndefined()
    expect(hasCrossedHead(chord)).toBe(true)
    expect(displayStaffIndex(model.getScore(), chord, d.id)).toBe(0)
    expect(displayStaffIndex(model.getScore(), chord, b.id)).toBe(1)
  })

  it('⛔ moves nothing but the field — the chord keeps its staff, voice and place', () => {
    const d = add('D', 4, 1)
    const before = structuredClone(stored(model, d.id).chord)
    crossPitch(model.getScore(), d.id, -1)
    const after = stored(model, d.id).chord
    expect(after.staffId).toBe(before.staffId)
    expect(after.voice).toBe(before.voice)
    expect(after.beat).toEqual(before.beat)
    expect(model.getNote(d.id)!.staff).toBe(1) // the flat Note still says HOME
  })

  it('🚨 a head written on the FIRST staff carries its REAL id — absent means home, not staff 0', () => {
    const d = add('D', 4, 1)
    crossPitch(model.getScore(), d.id, -1)
    expect(stored(model, d.id).pitch.displayStaffId).toBe(staffIds[0])
    expect(staffIds[0]).toBeTruthy()
  })

  it('coming home DELETES the field, from either side', () => {
    const d = add('D', 4, 1)
    crossPitch(model.getScore(), d.id, -1)
    expect(crossPitch(model.getScore(), d.id, 1)).toEqual({ pitchId: d.id, result: 'returned' })
    expect('displayStaffId' in stored(model, d.id).pitch).toBe(false)

    crossPitch(model.getScore(), d.id, 1)
    expect(stored(model, d.id).pitch.displayStaffId).toBe(staffIds[2])
    expect(crossPitch(model.getScore(), d.id, -1).result).toBe('returned')
    expect('displayStaffId' in stored(model, d.id).pitch).toBe(false)
  })

  it('refuses the edge of the score, and a second step away from home', () => {
    const top = add('D', 5, 0)
    expect(crossPitch(model.getScore(), top.id, -1)).toEqual({ pitchId: top.id, result: 'refused', why: 'no-staff' })

    crossPitch(model.getScore(), top.id, 1) // written on staff 1
    expect(crossPitch(model.getScore(), top.id, 1)).toEqual({ pitchId: top.id, result: 'refused', why: 'not-adjacent' })
    expect(stored(model, top.id).pitch.displayStaffId).toBe(staffIds[1]) // and nothing was written
  })

  it('a rest does not cross, and a press that refused everything reports no change', () => {
    const rest = model.getScore().measures[0].slots.find(s => s.type === 'rest')!
    const { changed, outcomes } = crossPitches(model.getScore(), [rest.id, 'no-such-id'], -1)
    expect(changed).toBe(false)
    expect(outcomes.map(o => o.result === 'refused' && o.why)).toEqual(['not-a-note', 'not-a-note'])
  })

  it('a single-staff score has nowhere to cross to', () => {
    const solo = new ScoreModel()
    const n = solo.addNote({ step: 'D', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    expect(crossPitch(solo.getScore(), n.id, -1).result).toBe('refused')
    expect(crossPitch(solo.getScore(), n.id, 1).result).toBe('refused')
  })

  it('canDisplayOn: adjacent and existing, never home', () => {
    const score = model.getScore()
    expect(canDisplayOn(score, 1, 0)).toBe(true)
    expect(canDisplayOn(score, 1, 2)).toBe(true)
    expect(canDisplayOn(score, 1, 1)).toBe(false)
    expect(canDisplayOn(score, 0, 2)).toBe(false)
    expect(canDisplayOn(score, 0, -1)).toBe(false)
    expect(canDisplayOn(score, 2, 3)).toBe(false)
  })

  describe('the crossing travels with the music', () => {
    it('⭐ survives a REBAR — the relay rebuilds every pitch', () => {
      const b = add('B', 2, 1, 1)
      const d = add('D', 4, 1, 1)
      crossPitch(model.getScore(), d.id, -1)
      void b

      model.setTimeSignature(1, { numerator: 3, denominator: 4 })

      const heads = model.getScore().measures
        .flatMap(m => m.slots)
        .filter((s): s is Chord => s.type === 'chord')
        .flatMap(c => c.notes)
      expect(heads.filter(p => p.step === 'D').every(p => p.displayStaffId === staffIds[0])).toBe(true)
      expect(heads.filter(p => p.step === 'D').length).toBeGreaterThan(0)
      expect(heads.filter(p => p.step === 'B').every(p => p.displayStaffId === undefined)).toBe(true)
    })

    it('keepLegalCrossings brings a head home when its chord lands somewhere the id cannot reach', () => {
      const d = add('D', 4, 1)
      crossPitch(model.getScore(), d.id, -1) // written on staff 0
      const { chord, pitch } = stored(model, d.id)

      keepLegalCrossings(model.getScore(), chord)
      expect(pitch.displayStaffId).toBe(staffIds[0]) // still legal from staff 1 — untouched

      chord.staffId = staffIds[2] // as a paste onto the bottom staff would leave it
      keepLegalCrossings(model.getScore(), chord)
      expect('displayStaffId' in pitch).toBe(false)
    })
  })

  describe('crossStaffProblems — report, never repair', () => {
    it('is silent for a legal score', () => {
      const d = add('D', 4, 1)
      crossPitch(model.getScore(), d.id, -1)
      expect(crossStaffProblems(model.getScore())).toEqual([])
    })

    it('names an unknown staff, the home staff, and a far staff — and changes none of them', () => {
      const a = add('B', 2, 0, 0)
      const b = add('D', 4, 1, 0)
      const c = add('F', 4, 0, 2)
      stored(model, a.id).pitch.displayStaffId = 'nobody'
      stored(model, b.id).pitch.displayStaffId = staffIds[1]
      stored(model, c.id).pitch.displayStaffId = staffIds[2]

      const problems = crossStaffProblems(model.getScore())

      expect(problems).toHaveLength(3)
      expect(problems.some(p => p.includes('names no staff'))).toBe(true)
      expect(problems.some(p => p.includes('own staff'))).toBe(true)
      expect(problems.some(p => p.includes('2 staves from home'))).toBe(true)
      expect(stored(model, a.id).pitch.displayStaffId).toBe('nobody')
      // …and a bad id is DRAWN at home, not on staff 0 by accident of a fallback.
      expect(displayStaffIndex(model.getScore(), stored(model, b.id).chord, b.id)).toBe(1)
    })
  })
})
