import { describe, it, expect } from 'vitest'
import { fanRampRoomSpaces } from './fanRampRoom'
import { plainColumn, type Column } from './spacing'
import { fracCreate as frac } from '@/utils/fraction'

/**
 * The room a bar's column solve gave a fan's own members.
 *
 * Subject: {@link fanRampRoom}, sitting beside this file. Pure arithmetic over columns and the x's
 * the solve produced — no glyphs, so jsdom is not lying to us here (the geometry that IS a drawn
 * position lives in `e2e/fan.e2e.ts`).
 */
describe('fanRampRoomSpaces', () => {
  /** A bar's worth of columns at whole beats, and where a solve put them. */
  const columns = (beats: number[]): Column[] => beats.map(b => plainColumn(frac(b, 1), frac(1, 1)))

  it('is the distance between the FIRST and LAST member columns', () => {
    const cols = columns([0, 1, 2, 3])
    const xs = [0, 5, 12, 20]
    expect(fanRampRoomSpaces(cols, xs, [frac(0, 1), frac(1, 1), frac(2, 1)])).toBe(12)
  })

  it('⭐ grows exactly as the solve grew — that IS the bar\'s force', () => {
    const cols = columns([0, 1, 2, 3])
    const natural = fanRampRoomSpaces(cols, [0, 5, 12, 20], [frac(0, 1), frac(2, 1)])!
    const stretched = fanRampRoomSpaces(cols, [0, 15, 36, 60], [frac(0, 1), frac(2, 1)])!
    expect(stretched / natural).toBe(3)
  })

  it('reads a member beat wherever it sits in the list, not by index', () => {
    // The fan does not have to start the bar: its members are columns among others.
    const cols = columns([0, 1, 2, 3])
    expect(fanRampRoomSpaces(cols, [0, 5, 12, 20], [frac(1, 1), frac(3, 1)])).toBe(15)
  })

  it('⚠️ answers UNDEFINED when a member has no column of its own — half a match is worse than none', () => {
    const cols = columns([0, 1, 2])
    expect(fanRampRoomSpaces(cols, [0, 5, 12], [frac(0, 1), frac(7, 2)])).toBeUndefined()
  })

  it('answers undefined for a solve that does not match the columns, or a fan of one', () => {
    const cols = columns([0, 1, 2])
    expect(fanRampRoomSpaces(cols, [0, 5], [frac(0, 1), frac(2, 1)]), 'xs and columns disagree').toBeUndefined()
    expect(fanRampRoomSpaces(cols, [0, 5, 12], [frac(0, 1)]), 'a single member is no ramp').toBeUndefined()
  })

  it('answers undefined for a collapsed span — a ramp with no room is not a narrow ramp', () => {
    const cols = columns([0, 1])
    expect(fanRampRoomSpaces(cols, [7, 7], [frac(0, 1), frac(1, 1)])).toBeUndefined()
  })
})
