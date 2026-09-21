import { describe, it, expect } from 'vitest'
import { attachCrossStaffNeighbours, crossingResolver } from './crossStaff'
import type { CrossStaffNeighbour, MeasurePlacement } from './renderTypes'
import type { Chord, Measure, NotePitch } from '@/types/music'
import { fracCreate as frac } from '@/utils/fraction'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'

const pitch = (id: string, displayStaffId?: string): NotePitch =>
  ({ id, step: 'D', alter: 0, octave: 4, ...(displayStaffId ? { displayStaffId } : {}) })

const chord = (notes: NotePitch[], beat = 0): Chord =>
  ({ id: `c${beat}`, type: 'chord', beat: frac(beat, 1), duration: 'q', measure: 1, notes })

type Bar = Pick<MeasurePlacement, 'view' | 'y' | 'clef' | 'crossStaff'>
const bar = (y: number, clef: Bar['clef'], slots: Chord[], clefs: Measure['clefs'] = []): Bar =>
  ({ y, clef, view: { slots, clefs } as unknown as Measure })

describe('attachCrossStaffNeighbours', () => {
  it('tells only the bar holding a crossed head where the other staff stands', () => {
    const top = bar(100, 'treble', [chord([pitch('t')])])
    const bottom = bar(205, 'bass', [chord([pitch('b'), pitch('d', 'S0')])])
    attachCrossStaffNeighbours([top, bottom], ['S0', 'S1'])

    expect(top.crossStaff).toBeUndefined()
    expect(bottom.crossStaff).toEqual([{ staffId: 'S0', dy: -105, clef: 'treble', clefs: [] }])
  })

  it('an id naming no staff — or the bar’s own — attaches nothing: the head draws at home', () => {
    const top = bar(100, 'treble', [chord([pitch('a', 'nobody'), pitch('b', 'S0')])])
    attachCrossStaffNeighbours([top, bar(205, 'bass', [])], ['S0', 'S1'])
    expect(top.crossStaff).toBeUndefined()
  })
})

describe('crossingResolver', () => {
  const above: CrossStaffNeighbour = {
    staffId: 'S0', dy: -105, clef: 'treble', clefs: [{ id: 'k', beat: frac(2, 1), clef: 'alto' }] as CrossStaffNeighbour['clefs'],
  }

  it('is absent for a bar with no neighbours — the ordinary path pays nothing', () => {
    expect(crossingResolver(undefined, 1)).toBeUndefined()
    expect(crossingResolver([], 1)).toBeUndefined()
  })

  it('⭐ a staff ABOVE is a positive lift, in the home staff’s own spaces', () => {
    const resolve = crossingResolver([above], 1)!
    expect(resolve(chord([]), pitch('d', 'S0'))).toEqual({ clef: 'treble', lift: 105 / STAFF_SPACE_PX })
    expect(resolve(chord([]), pitch('home'))).toBeUndefined()
  })

  it('a staff BELOW is a negative lift, and a scaled home bar counts the distance in ITS spaces', () => {
    const below: CrossStaffNeighbour = { staffId: 'S2', dy: 105, clef: 'bass', clefs: [] }
    expect(crossingResolver([below], 1)!(chord([]), pitch('d', 'S2'))!.lift).toBe(-10.5)
    expect(crossingResolver([below], 0.5)!(chord([]), pitch('d', 'S2'))!.lift).toBe(-21)
  })

  it('reads the neighbour’s clef AT THE SLOT’S BEAT — a mid-bar change over there re-pitches the head', () => {
    const resolve = crossingResolver([above], 1)!
    expect(resolve(chord([], 1), pitch('d', 'S0'))!.clef).toBe('treble')
    expect(resolve(chord([], 2), pitch('d', 'S0'))!.clef).toBe('alto')
  })
})
