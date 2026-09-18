/**
 * Where a rest inside a beam sits. ⚠️ Exactness against `Formatter.AlignRestsToNotes` was proved once —
 * on 6,000 random bars in one process and on the rendered page of 60 random scores (S9h-a,
 * `docs/vexflow-removal-map.md` §5.2); pinned here is the rule, quirks included.
 */
import { describe, it, expect } from 'vitest'
import { type VoiceTickable, alignRestsToNotes } from './restAlign'

const note = (restLine: number, over: Partial<VoiceTickable> = {}): VoiceTickable => ({
  isStaveNote: true, isNote: true, isRest: false, ignoresTicks: false, inTuplet: false, beamed: true,
  restLine, ...over,
})
const rest = (line = 3, over: Partial<VoiceTickable> = {}) => note(line, { isRest: true, ...over })
const clef = (): VoiceTickable => note(0, { isStaveNote: false, ignoresTicks: true, beamed: false })

describe('alignRestsToNotes', () => {
  it('a beamed rest that OPENS the voice takes the next note’s line', () => {
    expect(alignRestsToNotes([rest(), note(6)])).toEqual([{ tickable: 0, line: 6 }])
  })

  it('⭐ a beamed rest after a note takes the midpoint of that note and the next', () => {
    expect(alignRestsToNotes([note(6), rest(), note(2)])).toEqual([{ tickable: 1, line: 4 }])
  })

  it('a beamed rest after a rest takes the line that rest was just given', () => {
    expect(alignRestsToNotes([rest(), rest(), note(5)]))
      .toEqual([{ tickable: 0, line: 5 }, { tickable: 1, line: 5 }])
  })

  it('leaves alone an unbeamed rest, a rest in a tuplet, and a rest off the middle line', () => {
    expect(alignRestsToNotes([note(6), rest(3, { beamed: false }), note(2)])).toEqual([])
    expect(alignRestsToNotes([note(6), rest(3, { inTuplet: true }), note(2)])).toEqual([])
    expect(alignRestsToNotes([note(6), rest(4), note(2)])).toEqual([])
  })

  it('⚠️ a rest after a CLEF keeps its line, but is still rewritten with it', () => {
    expect(alignRestsToNotes([note(6), clef(), rest(), note(2)])).toEqual([{ tickable: 2, line: 3 }])
  })

  it('"the next note" skips rests and a clef change', () => {
    expect(alignRestsToNotes([rest(), rest(4, { beamed: false }), clef(), note(1)]))
      .toEqual([{ tickable: 0, line: 1 }])
  })
})
