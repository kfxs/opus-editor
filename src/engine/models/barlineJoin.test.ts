import { describe, it, expect } from 'vitest'
import { barlineJoinsBelow, setBarlineJoinBelow } from './barlineJoin'
import type { Score, StaffInfo } from '@/types/music'

/** A score that is nothing but its staff axis — the only thing this resolver reads. */
function scoreWith(...staves: StaffInfo[]): Score {
  return { id: 's', measures: [], staves }
}

const S = (id: string, barlineJoinBelow?: boolean): StaffInfo =>
  barlineJoinBelow === undefined ? { id } : { id, barlineJoinBelow }

describe('barlineJoinsBelow', () => {
  it('⭐ does NOT join by default — a fresh score has no ink in any gap', () => {
    const score = scoreWith(S('a'), S('b'))
    expect(barlineJoinsBelow(score, 'a', 1)).toBe(false)
  })

  it('a stored true joins that gap', () => {
    const score = scoreWith(S('a', true), S('b'))
    expect(barlineJoinsBelow(score, 'a', 1)).toBe(true)
  })

  it('a stored false is the default said out loud', () => {
    const score = scoreWith(S('a', false), S('b'))
    expect(barlineJoinsBelow(score, 'a', 1)).toBe(false)
  })

  it('⭐ the BOTTOM staff has no gap below it, so the answer is false even with the field set', () => {
    expect(barlineJoinsBelow(scoreWith(S('a'), S('b')), 'b', 1)).toBe(false)
    // The question is about a gap that does not exist.
    expect(barlineJoinsBelow(scoreWith(S('a'), S('b', true)), 'b', 1)).toBe(false)
  })

  it('a SINGLE staff has no gaps at all', () => {
    expect(barlineJoinsBelow(scoreWith(S('only')), 'only', 1)).toBe(false)
  })

  it('an unknown or absent staff id answers false rather than guessing a staff', () => {
    const score = scoreWith(S('a'), S('b'))
    expect(barlineJoinsBelow(score, 'nope', 1)).toBe(false)
    expect(barlineJoinsBelow(score, undefined, 1)).toBe(false)
  })

  it('⭐ each gap is its own fact — joining one does not join the one below it', () => {
    const score = scoreWith(S('a', true), S('b'), S('c'))
    expect(barlineJoinsBelow(score, 'a', 1)).toBe(true)
    expect(barlineJoinsBelow(score, 'b', 1)).toBe(false)
  })

  it('⭐⭐ the BOUNDARY is accepted and does not change the answer — yet', () => {
    const score = scoreWith(S('a', true), S('b'))
    // The whole of §2.4's promise, pinned: every bar answers the same today, and the day one does
    // not, this is the test that has to change and NOT a single caller.
    for (const bar of [1, 2, 17]) expect(barlineJoinsBelow(score, 'a', bar)).toBe(true)
    // …and it is optional, so a reader with no boundary in hand can still ask.
    expect(barlineJoinsBelow(score, 'a')).toBe(true)
  })
})

describe('setBarlineJoinBelow', () => {
  it('joins a gap, and the resolver agrees', () => {
    const score = scoreWith(S('a'), S('b'))
    expect(setBarlineJoinBelow(score, 'a', true)).toBe(true)
    expect(barlineJoinsBelow(score, 'a', 1)).toBe(true)
  })

  it('⭐ disjoining CLEARS the field rather than storing the default', () => {
    const score = scoreWith(S('a'), S('b'))
    setBarlineJoinBelow(score, 'a', true)
    expect(setBarlineJoinBelow(score, 'a', false)).toBe(true)
    // Joined and unjoined again is byte-identical to never having been touched.
    expect('barlineJoinBelow' in score.staves![0]).toBe(false)
    expect(JSON.parse(JSON.stringify(score)).staves[0]).toEqual({ id: 'a' })
  })

  it('says nothing changed when the write repeats what was already true', () => {
    const score = scoreWith(S('a'), S('b'))
    expect(setBarlineJoinBelow(score, 'a', false), 'already the default').toBe(false)
    expect(setBarlineJoinBelow(score, 'a', true)).toBe(true)
    expect(setBarlineJoinBelow(score, 'a', true), 'already joined').toBe(false)
  })

  it('⭐ refuses the BOTTOM staff — a fact about a gap that does not exist is not stored', () => {
    const score = scoreWith(S('a'), S('b'))
    expect(setBarlineJoinBelow(score, 'b', true)).toBe(false)
    expect('barlineJoinBelow' in score.staves![1]).toBe(false)
  })

  it('refuses an unknown staff without touching the score', () => {
    const score = scoreWith(S('a'), S('b'))
    expect(setBarlineJoinBelow(score, 'nope', true)).toBe(false)
    expect(score.staves).toEqual([{ id: 'a' }, { id: 'b' }])
  })
})
