import { describe, it, expect } from 'vitest'
import { graceBeam, graceBeamRuns, isBeamedGrace, type GraceBeamNote } from './graceBeam'

/** P2b — a grace group's beam, the page's own rule fed plain numbers. */
describe('graceBeamRuns', () => {
  const d = (...ds: ('8' | '16' | '32' | 'q' | 'h')[]) => ds.map(duration => ({ duration }))

  it('⭐ consecutive FLAGGED graces share a beam; a run of one keeps its flag', () => {
    expect(graceBeamRuns(d('8', '8', '8'))).toEqual([[0, 1, 2]])
    expect(graceBeamRuns(d('8'))).toEqual([])
    expect(graceBeamRuns(d('16', '8'))).toEqual([[0, 1]])
  })

  it('a quarter or half BREAKS the run', () => {
    expect(graceBeamRuns(d('8', 'q', '8'))).toEqual([])
    expect(graceBeamRuns(d('8', '8', 'h', '16', '16'))).toEqual([[0, 1], [3, 4]])
    expect(isBeamedGrace(d('8', '8', 'q'), 1)).toBe(true)
    expect(isBeamedGrace(d('8', '8', 'q'), 2)).toBe(false)
  })

  it('⭐ B4: a grace carrying a BRACKETED grace starts a new run — the split is drawn, not stored', () => {
    const notes = [{ duration: '8' as const }, { duration: '8' as const }, { duration: '8' as const, bracketedBefore: [{}] }, { duration: '8' as const }]
    expect(graceBeamRuns(notes)).toEqual([[0, 1], [2, 3]])
    // …a bracket on the FIRST grace breaks nothing; one leaving a single grace on its side unbeams it.
    expect(graceBeamRuns([{ duration: '8', bracketedBefore: [{}] }, { duration: '8' }])).toEqual([[0, 1]])
    expect(graceBeamRuns([{ duration: '8' }, { duration: '8', bracketedBefore: [{}] }])).toEqual([])
  })
})

describe('graceBeam', () => {
  const SPACE = 10
  const input = (notes: GraceBeamNote[]) =>
    ({ notes, space: SPACE, rule: 'vexflow' as const, beamWidth: 5, stemWidth: 1.5 })
  const note = (stemX: number, tipY: number, line: number, duration: '8' | '16' = '8'): GraceBeamNote =>
    ({ duration, stemX, tipY, beamSideLine: line })

  it('⭐ every stem ends ON one straight line', () => {
    const beam = graceBeam(input([note(0, 10, 4), note(20, 5, 4.5), note(40, 0, 5)]))
    const [a, b, c] = beam.tipYs
    expect((b - a) / 20).toBeCloseTo((c - b) / 20, 9)
  })

  it('a stem never ends BELOW its free tip — the beam only lengthens a short one (stems up)', () => {
    const notes = [note(0, 10, 4), note(20, 40, 1), note(40, 10, 4)]
    const beam = graceBeam(input(notes))
    beam.tipYs.forEach((y, i) => expect(y).toBeLessThanOrEqual(notes[i].tipY + 1e-9))
  })

  it('⭐ 8ths draw ONE line; an 8th + a 16th draws a full line and a FRACTIONAL one (the page\'s rule)', () => {
    expect(graceBeam(input([note(0, 0, 4), note(20, 0, 4)])).lines).toHaveLength(1)
    const mixed = graceBeam(input([note(0, 0, 4), note(20, 0, 4, '16')]))
    expect(mixed.lines).toHaveLength(2)
    const [primary, secondary] = mixed.lines
    expect(secondary.endX - secondary.startX).toBeLessThan(primary.endX - primary.startX)
  })

  it('the lines stack TOWARD the heads (stems up) by the page\'s stride', () => {
    const beam = graceBeam(input([note(0, 0, 4, '16'), note(20, 0, 4, '16')]))
    expect(beam.lines).toHaveLength(2)
    expect(beam.lines[1].startY - beam.lines[0].startY).toBeCloseTo(beam.thickness * 1.5, 9)
    expect(beam.thickness).toBeGreaterThan(0)
  })
})
