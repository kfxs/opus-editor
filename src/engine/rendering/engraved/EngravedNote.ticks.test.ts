/**
 * The note's ticks and its tuplet stack (S12j-c) — VexFlow's `Tickable` bookkeeping, transcribed. ⚠️
 * That the page is unchanged was proved by the broad and the tuplet A/Bs (`docs/history/vexflow-removal-map.md`
 * S12j-c). Pinned here is the arithmetic, ⛔ unreduced.
 */
import { describe, it, expect } from 'vitest'
import { EngravedNote } from './EngravedNote'
import { ScoreTuplet } from './ScoreTuplet'

const ticksOf = (note: EngravedNote) => {
  const t = note.getTicks() as unknown as { numerator: number; denominator: number; value(): number }
  return [t.numerator, t.denominator, t.value()]
}

describe('EngravedNote — ticks (S12j-c)', () => {
  it('counts its duration and dots — a quarter is 4096, a dotted quarter 6144', () => {
    expect(ticksOf(new EngravedNote({ keys: ['c/5'], duration: 'q' }))).toEqual([4096, 1, 4096])
    expect(ticksOf(new EngravedNote({ keys: ['c/5'], duration: 'qd' }))).toEqual([6144, 1, 6144])
    expect(new EngravedNote({ keys: ['c/5'], duration: '8' }).getIntrinsicTicks()).toBe(2048)
  })

  it('⭐ a multiplier scales it UNREDUCED — a tremolo pair\'s half, then a triplet\'s two-thirds', () => {
    const note = new EngravedNote({ keys: ['c/5'], duration: 'q' })
    note.applyTickMultiplier(1, 2)
    expect(ticksOf(note)).toEqual([4096, 2, 2048])
    note.applyTickMultiplier(2, 3)
    expect(ticksOf(note)).toEqual([8192, 6, 8192 / 6])
  })

  it('⭐ a tuplet goes on its stack and scales it by notesOccupied / noteCount', () => {
    const notes = [0, 1, 2].map(() => new EngravedNote({ keys: ['c/5'], duration: '8' }))
    const tuplet = new ScoreTuplet(notes, { numNotes: 3, notesOccupied: 2 })
    expect(ticksOf(notes[0])).toEqual([4096, 3, 4096 / 3])
    expect(notes[0].getTuplet()).toBe(tuplet)
    expect(notes[0].getTupletStack()).toEqual([tuplet])
  })

  it('`resetTuplet` takes it off the stack and unscales it', () => {
    const notes = [0, 1, 2].map(() => new EngravedNote({ keys: ['c/5'], duration: '8' }))
    const tuplet = new ScoreTuplet(notes, { numNotes: 3, notesOccupied: 2 })
    notes[0].resetTuplet(tuplet as never)
    expect(notes[0].getTupletStack()).toEqual([])
    expect(ticksOf(notes[0])[2]).toBe(2048)
  })
})
