/**
 * A tuplet of ours (S12a): VexFlow's `Tuplet` constructor and the contract its notes read, transcribed.
 * ⚠️ Where the bracket and the mark land — and the ticks the notes scale by it — are proved on the page:
 * an A/B of 60 random scores (476 tuplets) against the previous commit, SVG and hit boxes byte-identical
 * (`docs/vexflow-removal-map.md` S12a). The rest alignment it runs is pinned in
 * `engrave/notes/restAlign.test.ts`.
 *
 * The notes here are STAND-INS carrying only what the tuplet asks of a note — whether it is beamed, and
 * its tuplet stack (`setTuplet` pushes, as VexFlow's `Tickable.setTuplet` does).
 */
import { describe, it, expect, vi } from 'vitest'
import { ScoreTuplet } from './ScoreTuplet'

type Notes = ConstructorParameters<typeof ScoreTuplet>[0]
type StandIn = { stack: unknown[]; hasBeam: () => boolean; setTuplet: (t: unknown) => void; getTupletStack: () => unknown[] }
const standIns = (n: number, beamed = false): Notes =>
  Array.from({ length: n }, () => {
    const note: StandIn & Record<string, unknown> = {
      stack: [],
      hasBeam: () => beamed,
      // What the rest rule reads of a tickable — a stand-in is not a note, so it moves nothing.
      shouldIgnoreTicks: () => false,
      getTuplet: () => undefined,
      setTuplet(t) { this.stack.push(t) },
      getTupletStack() { return this.stack },
    }
    return note as unknown as Notes[number]
  })

describe('ScoreTuplet', () => {
  it('takes VexFlow\'s defaults: bracketed when a note is unbeamed, above, 2 occupied, ratioed only past a gap of one', () => {
    const t = new ScoreTuplet(standIns(3))
    expect(t.options).toMatchObject({ bracketed: true, location: 1, notesOccupied: 2, numNotes: 3, ratioed: false, yOffset: 0, textYOffset: 2 })
    expect(new ScoreTuplet(standIns(3, true)).options.bracketed).toBe(false)
    expect(new ScoreTuplet(standIns(5), { notesOccupied: 3 }).options.ratioed).toBe(true)
  })

  it('refuses no notes, and an invalid location falls back to above', () => {
    expect(() => new ScoreTuplet([])).toThrow()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(new ScoreTuplet(standIns(3), { location: 7 }).options.location).toBe(1)
    warn.mockRestore()
  })

  it('⭐ tells every note it is in the group, and answers the counts its ticks are scaled by', () => {
    const notes = standIns(3)
    const t = new ScoreTuplet(notes, { numNotes: 3, notesOccupied: 2 })
    expect(notes.every(n => (n as unknown as StandIn).stack.includes(t))).toBe(true)
    expect([t.getNoteCount(), t.getNotesOccupied()]).toEqual([3, 2])
    expect(t.getNotes()).toBe(notes)
  })

  it('counts how unevenly the group is nested on its own side', () => {
    const notes = standIns(3)
    const outer = new ScoreTuplet(notes, { numNotes: 3 })
    expect(outer.getNestedTupletCount()).toBe(0)
    const inner = new ScoreTuplet(notes.slice(0, 2), { numNotes: 2, notesOccupied: 3 })
    expect(outer.getNestedTupletCount()).toBe(1) // two notes in two tuplets, one in one
    expect(inner.getNestedTupletCount()).toBe(0)
    // A tuplet on the OTHER side is not counted.
    new ScoreTuplet(notes.slice(0, 1), { location: -1 })
    expect(outer.getNestedTupletCount()).toBe(1)
  })
})
