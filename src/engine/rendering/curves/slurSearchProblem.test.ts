/**
 * The adapter's arithmetic and its table (`./slurSearchProblem`). ⚠️ What it READS off a drawn note is only
 * real in a browser — `e2e/slurSearch.e2e.ts` draws his examples through it.
 */
import { describe, it, expect } from 'vitest'
import { ARTICULATION_AVOID, fromSearch, toSearch } from './slurSearchProblem'

const frame = { originX: 120, middleY: 90, spacePx: 12 }

describe('LilyPond\'s space', () => {
  it('⭐ staff spaces from the origin, y UP from the middle line — and back', () => {
    expect(toSearch(frame, { x: 144, y: 66 })).toEqual({ x: 2, y: 2 })
    expect(fromSearch(frame, { x: 2, y: 2 })).toEqual({ x: 144, y: 66 })
    expect(fromSearch(frame, toSearch(frame, { x: 131.5, y: 101.25 }))).toEqual({ x: 131.5, y: 101.25 })
  })
})

describe('ARTICULATION_AVOID', () => {
  it('⭐ LilyPond\'s `avoid-slur` for each of our codes — staccato and tenuto inside, the accent around', () => {
    expect(ARTICULATION_AVOID).toEqual({ 'a.': 'inside', 'a-': 'inside', 'a>': 'around' })
  })
})
