import { describe, it, expect } from 'vitest'
import { graceEnclosure, graceLayout, graceScale } from './graceRoom'
import { enclosureLayout } from './headEnclosure'
import type { GraceGroup, GraceNote, NotePitch } from '@/types/music'

/**
 * Subject: `./graceRoom` — a PARENTHESISED grace (docs/plans/parenthesised-note-plan.md P3): its brackets
 * are the note's own rule at the grace's size, and the group packs them as the grace's outermost ink.
 */
describe('graceRoom — a parenthesised grace', () => {
  const pitch = (id: string, enclosed: boolean): NotePitch =>
    ({ id, step: 'D', alter: 0, octave: 5, ...(enclosed && { enclosure: 'round' as const }) })
  const grace = (enclosed: boolean, id = 'g'): GraceNote => ({ pitches: [pitch(id, enclosed)], duration: '8' })
  const group = (...notes: GraceNote[]): GraceGroup => ({ notes })
  const none = () => null

  it('null for a bare grace', () => {
    expect(graceEnclosure(grace(false), false, false, none, 'treble')).toBeNull()
  })

  it('⭐ the note\'s own rule: a flagged grace\'s `)` stands past its flag; a BEAMED one\'s does not need to', () => {
    const flagged = graceEnclosure(grace(true), false, false, none, 'treble')!
    const beamed = graceEnclosure(grace(true), true, false, none, 'treble')!
    expect(flagged.right).toBeGreaterThan(beamed.right)
    expect(beamed.right).toBeCloseTo(enclosureLayout({ notes: [pitch('g', true)], dotReach: 0 }, none, 'treble')!.right, 9)
  })

  it('⭐ the group reaches further left by the brackets, at the grace\'s size', () => {
    const bare = graceLayout(group(grace(false)), none, 'treble', 0)
    const enclosed = graceLayout(group(grace(true)), none, 'treble', 0)
    const brackets = graceEnclosure(grace(true), false, false, none, 'treble')!
    // Its head stands further left (its `)` is now its right ink), and its `(` reaches past that.
    expect(enclosed.places[0].headX).toBeCloseTo(bare.places[0].headX - (brackets.right * graceScale() - bare.places[0].rightInk), 9)
    expect(enclosed.reach).toBeCloseTo(-enclosed.places[0].headX + brackets.left * graceScale(), 9)
  })

  it('⭐ two graces: the bracketed one\'s `)` keeps the grace gap from the next', () => {
    const plain = graceLayout(group(grace(false, 'a'), grace(false, 'b')), none, 'treble', 0)
    const first = graceLayout(group(grace(true, 'a'), grace(false, 'b')), none, 'treble', 0)
    expect(first.places[0].headX).toBeLessThan(plain.places[0].headX)
    expect(first.places[1].headX).toBeCloseTo(plain.places[1].headX, 9)
  })
})
