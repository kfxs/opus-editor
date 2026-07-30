import { describe, it, expect } from 'vitest'
import { beamLevelSpans } from './beamLevels'

/**
 * Which beam lines run where — pure arithmetic over per-note beam counts, so it is fully testable
 * here (the drawn picture is `e2e/fan.e2e.ts`'s).
 *
 * The case that made it exist is his: three sixteenths beamed to two thirty-seconds, where the
 * whole-group `Math.min` drew everything at 2 and the fusas came out as semicorcheas.
 */
describe('beamLevelSpans', () => {
  const eighths = [1, 1, 1]
  const sixteenths = [2, 2, 2]

  it('says nothing about the primary — level 0 is the group, not a span', () => {
    expect(beamLevelSpans(eighths)).toEqual([])
  })

  it('runs a shared level over every note that shares it', () => {
    expect(beamLevelSpans(sixteenths)).toEqual([{ level: 1, from: 0, to: 2 }])
  })

  it('⭐ HIS CASE: 16 16 16 32 32 — two lines over all five, a THIRD over the fusas alone', () => {
    const spans = beamLevelSpans([2, 2, 2, 3, 3])
    expect(spans).toEqual([
      { level: 1, from: 0, to: 4 }, // the second line, over the whole group
      { level: 2, from: 3, to: 4 }, // the third, over the two thirty-seconds
    ])
  })

  it('⭐ a level nobody shares is a STUB — a lone 32nd among 16ths keeps its third beam', () => {
    // 16 32 16: the third line exists on the middle note alone.
    expect(beamLevelSpans([2, 3, 2])).toEqual([
      { level: 1, from: 0, to: 2 },
      { level: 2, from: 1, to: 1 }, // from === to: a fractional beam
    ])
  })

  it('…and the stub is not claimed twice when a run already covers the note', () => {
    const spans = beamLevelSpans([3, 3, 2])
    expect(spans.filter(s => s.level === 2)).toEqual([{ level: 2, from: 0, to: 1 }])
  })

  it('breaks a level into SEVERAL runs when the group dips in the middle', () => {
    // 32 32 16 32 32 — the third line runs over the first pair and the last, not across the 16th.
    expect(beamLevelSpans([3, 3, 2, 3, 3]).filter(s => s.level === 2)).toEqual([
      { level: 2, from: 0, to: 1 },
      { level: 2, from: 3, to: 4 },
    ])
  })

  it('an eighth in the middle keeps the group to its primary there', () => {
    // 16 8 16 — the second line has no gap to run over, so both sixteenths get a stub.
    expect(beamLevelSpans([2, 1, 2])).toEqual([
      { level: 1, from: 0, to: 0 },
      { level: 1, from: 2, to: 2 },
    ])
  })

  it('a single note is all stubs, and an empty run is nothing at all', () => {
    expect(beamLevelSpans([3])).toEqual([
      { level: 1, from: 0, to: 0 },
      { level: 2, from: 0, to: 0 },
    ])
    expect(beamLevelSpans([])).toEqual([])
  })
})
