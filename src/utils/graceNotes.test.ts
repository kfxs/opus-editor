import { describe, it, expect } from 'vitest'
import { cloneGraceFresh, graceGroupOf, gracePitchesOf } from './graceNotes'
import { fracCreate } from './fraction'
import type { Chord, GraceGroup } from '@/types/music'

/** Subject: `./graceNotes` — the pure reads and the copy (docs/plans/grace-notes-plan.md §1). */

const group = (): GraceGroup => ({
  notes: [
    { pitches: [{ id: 'g1', step: 'D', alter: 0, octave: 5, forceAccidental: true }], duration: '8', dots: 1, articulations: ['staccato'] },
    { pitches: [{ id: 'g2', step: 'E', alter: -1, octave: 5 }, { id: 'g3', step: 'G', alter: 0, octave: 5 }], duration: '16' },
  ],
  slash: true,
  stemDirection: 'down',
})

const chord = (extra: Partial<Chord> = {}): Chord => ({
  id: 'c', type: 'chord', beat: fracCreate(0, 1), duration: 'q', measure: 1,
  notes: [{ id: 'n', step: 'C', alter: 0, octave: 4 }], ...extra,
})

describe('cloneGraceFresh', () => {
  it('copies the music exactly, with a FRESH id on every pitch', () => {
    const src = group()
    const copy = cloneGraceFresh(src)
    const noIds = (g: GraceGroup) => JSON.parse(JSON.stringify(g, (k, v) => (k === 'id' ? undefined : v)))
    expect(noIds(copy)).toEqual(noIds(src))
    const ids = copy.notes.flatMap(n => n.pitches.map(p => p.id))
    expect(ids).toHaveLength(3)
    expect(ids.some(id => ['g1', 'g2', 'g3'].includes(id))).toBe(false)
  })

  it('shares no object with its source — a copied grace does not change when the source is edited', () => {
    const src = group()
    const copy = cloneGraceFresh(src)
    src.notes[0].pitches[0].step = 'A'
    src.notes[0].articulations!.push('accent')
    expect(copy.notes[0].pitches[0].step).toBe('D')
    expect(copy.notes[0].articulations).toEqual(['staccato'])
  })

  it('keeps every default ABSENT — no key the source did not have', () => {
    const copy = cloneGraceFresh({ notes: [{ pitches: [{ id: 'x', step: 'D', alter: 0, octave: 5 }], duration: '8' }] })
    expect(Object.keys(copy)).toEqual(['notes'])
    expect(Object.keys(copy.notes[0]).sort()).toEqual(['duration', 'pitches'])
  })
})

describe('gracePitchesOf', () => {
  it('every grace pitch, the group BEFORE first, left to right', () => {
    const c = chord({ graceBefore: group(), graceAfter: { notes: [{ pitches: [{ id: 'a1', step: 'B', alter: 0, octave: 4 }], duration: '16' }] } })
    expect(gracePitchesOf(c).map(p => p.id)).toEqual(['g1', 'g2', 'g3', 'a1'])
  })

  it('nothing for a chord with no graces — and never its own notes', () => {
    expect(gracePitchesOf(chord())).toEqual([])
  })
})

describe('graceGroupOf', () => {
  it('reads the side asked for', () => {
    const before = group()
    const c = chord({ graceBefore: before })
    expect(graceGroupOf(c, 'before')).toBe(before)
    expect(graceGroupOf(c, 'after')).toBeUndefined()
  })
})
