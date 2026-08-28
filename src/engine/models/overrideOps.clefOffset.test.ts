/**
 * ⭐⭐ **THE HAND-NUDGED INLINE CLEF** — his ask, 2026-08-28: *"when the clef is not in the beguining
 * of a line (i mean a header clef) i want to be able to offset it horizontally"*.
 *
 * Subject: {@link nudgeClefOffset} / {@link clearClefOffset}, a chapter beside `overrideOps.test.ts`.
 * The compartment rules this file exists to hold: it ACCUMULATES, returning to 0 CLEARS the entry
 * (so "absent = default" holds and the JSON stays clean), and the entry dies with its anchor — a clef
 * that is removed or dragged elsewhere takes its nudge with it.
 */
import { describe, it, expect } from 'vitest'
import { nudgeClefOffset, clearClefOffset } from './overrideOps'
import { clefOffsetOverrideOf } from './engravingOverrides'
import { removeClefAt, moveClef, clefChangeAt } from './clefOps'
import type { Score } from '@/types/music'

const frac = (num: number, den = 1) => ({ num, den })

/** Two bars; bar 2 carries an inline clef change at beat 2. */
function scoreWithClef(): Score {
  return {
    id: 's', title: '', measures: [
      { id: 'm1', number: 1, slots: [], timeSignature: { numerator: 4, denominator: 4 }, tuplets: [] },
      {
        id: 'm2', number: 2, slots: [], timeSignature: { numerator: 4, denominator: 4 }, tuplets: [],
        clefs: [{ id: 'c1', beat: frac(2), clef: 'bass' }],
      },
    ],
  } as unknown as Score
}

const offsetOf = (score: Score) => clefOffsetOverrideOf(score, 'c1')?.x

describe('an inline clef’s horizontal offset', () => {
  it('accumulates, press by press', () => {
    const score = scoreWithClef()
    nudgeClefOffset(score, 'c1', 0.25)
    nudgeClefOffset(score, 'c1', 0.25)
    expect(offsetOf(score)).toBe(0.5)
  })

  it('⭐ returning to 0 CLEARS the entry — "absent = default", and the JSON stays clean', () => {
    const score = scoreWithClef()
    nudgeClefOffset(score, 'c1', 1)
    nudgeClefOffset(score, 'c1', -1)
    expect(offsetOf(score)).toBeUndefined()
    expect(score.engravingOverrides?.c1 ?? []).toEqual([])
  })

  it('resets outright — the first-class reset every override client gets', () => {
    const score = scoreWithClef()
    nudgeClefOffset(score, 'c1', 1.5)
    expect(clearClefOffset(score, 'c1')).toBe(true)
    expect(offsetOf(score)).toBeUndefined()
    expect(clearClefOffset(score, 'c1'), 'nothing there to clear').toBe(false)
  })

  it('⛔ dies with its anchor: removing the clef sweeps the override', () => {
    // An override must not outlive the element it hangs off (`removeDynamic`'s rule).
    const score = scoreWithClef()
    nudgeClefOffset(score, 'c1', 1)
    expect(removeClefAt(score, 2, frac(2))).toBe(true)
    expect(offsetOf(score)).toBeUndefined()
  })

  it('⭐⭐ a RE-ANCHOR drops the nudge — the offset family’s standing rule', () => {
    // The nudge said "a little right of where the engraver put you HERE". Dragged to another slot it
    // is a sentence about a place the clef has left.
    const score = scoreWithClef()
    nudgeClefOffset(score, 'c1', 1)
    expect(moveClef(score, 2, frac(2), 2, frac(3))).toBe(true)
    expect(clefChangeAt(score, 2, frac(3))?.id, 'the same clef, moved').toBe('c1')
    expect(offsetOf(score)).toBeUndefined()
  })

  it('⭐ but CHANGING the clef at the same spot keeps it — an upsert preserves the id', () => {
    const score = scoreWithClef()
    nudgeClefOffset(score, 'c1', 1)
    const change = clefChangeAt(score, 2, frac(2))!
    change.clef = 'alto' // what `setClefAt`'s upsert does: the object stays, its clef changes
    expect(offsetOf(score)).toBe(1)
  })
})
