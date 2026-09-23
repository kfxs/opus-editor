import { describe, it, expect } from 'vitest'
import { bracketedKey, bracketedOf, bracketedPitchesOf, cloneBracketedFresh } from './bracketedGraces'
import { cloneGraceFresh } from './graceNotes'
import { fracCreate } from './fraction'
import type { Chord, GraceNote } from '@/types/music'

/**
 * Subject: `./bracketedGraces` — the pure reads and the copy (docs/plans/bracketed-grace-plan.md §1).
 */
const pitch = (id: string, step: 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B', octave = 4) => ({ id, step, alter: 0 as const, octave })

const grace = (id: string, bracketId?: string): GraceNote => ({
  pitches: [pitch(id, 'D')], duration: '8',
  ...(bracketId && { bracketedBefore: [{ pitches: [pitch(bracketId, 'C')] }] }),
})

const chord = (): Chord => ({
  id: 'c', type: 'chord', beat: fracCreate(0, 1), duration: 'q', measure: 1,
  notes: [pitch('n', 'E')],
  graceBefore: { notes: [grace('g1', 'bg1'), grace('g2')] },
  bracketedBefore: [{ pitches: [pitch('b1', 'F')] }],
  bracketedAfter: [{ pitches: [pitch('a1', 'G'), pitch('a2', 'B')] }],
  graceAfter: { notes: [grace('g3', 'bg3')] },
})

describe('bracketedGraces', () => {
  it('bracketedKey spells the side as the field', () => {
    expect([bracketedKey('before'), bracketedKey('after')]).toEqual(['bracketedBefore', 'bracketedAfter'])
  })

  it('bracketedOf: a chord answers both sides, ⛔ a GRACE answers before only (B5)', () => {
    const c = chord()
    expect(bracketedOf(c, 'after')).toBe(c.bracketedAfter)
    const g = { ...grace('g', 'bg'), bracketedAfter: [{ pitches: [pitch('x', 'A')] }] } as GraceNote
    expect(bracketedOf(g, 'before')).toBe(g.bracketedBefore)
    expect(bracketedOf(g, 'after')).toBeUndefined()
  })

  it('bracketedPitchesOf: every one a chord carries, in the drawing\'s left-to-right order', () => {
    expect(bracketedPitchesOf(chord()).map(p => p.id)).toEqual(['bg1', 'b1', 'a1', 'a2', 'bg3'])
  })

  it('cloneBracketedFresh: the same heads, FRESH ids, the forced sign kept', () => {
    const src = [{ pitches: [{ ...pitch('p', 'C'), forceAccidental: true }] }]
    const copy = cloneBracketedFresh(src)
    expect(copy[0].pitches[0]).toMatchObject({ step: 'C', alter: 0, octave: 4, forceAccidental: true })
    expect(copy[0].pitches[0].id).not.toBe('p')
    expect(copy[0]).not.toBe(src[0])
  })

  it('⭐ a GRACE copied carries the bracketed graces bent into it, with fresh ids (`cloneGraceFresh`)', () => {
    const copy = cloneGraceFresh(chord().graceBefore!)
    expect(copy.notes[0].bracketedBefore![0].pitches[0]).toMatchObject({ step: 'C', octave: 4 })
    expect(copy.notes[0].bracketedBefore![0].pitches[0].id).not.toBe('bg1')
    expect('bracketedBefore' in copy.notes[1]).toBe(false)
  })
})
