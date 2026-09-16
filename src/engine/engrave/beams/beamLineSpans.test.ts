/**
 * Which x's each beam line runs between — the walk, in jsdom.
 *
 * ⚠️ Exactness against `Beam.getBeamLines` was proved once, by a throwaway probe running both on the
 * same beams (S7d, `docs/vexflow-removal-map.md` §9). Pinned here: what a line joins, and where each
 * kind of fractional beam points.
 */
import { describe, it, expect } from 'vitest'
import { type BeamLevelInput, type BeamLevelNote, TICKS_PER_WHOLE, beamLineSpans } from './beamLineSpans'

const EIGHTH = TICKS_PER_WHOLE / 8
const SIXTEENTH = TICKS_PER_WHOLE / 16
const DOTTED_EIGHTH = EIGHTH * 1.5

const notes = (...lengths: number[]): BeamLevelNote[] =>
  lengths.map((t, i) => ({ lineX: i * 20, ticks: t, intrinsicTicks: t }))
const spans = (ns: BeamLevelNote[], levelDenominator: number, over: Partial<BeamLevelInput> = {}) =>
  beamLineSpans({ notes: ns, levelDenominator, breakIndexes: [], forcedSides: new Map(), fractionalLength: 10, ...over })

describe('beamLineSpans', () => {
  it('the primary beam joins the whole group, first stem to last', () => {
    expect(spans(notes(EIGHTH, EIGHTH, EIGHTH), 4)).toEqual([{ start: 0, end: 40 }])
  })

  it('a secondary beam joins only the notes short enough to carry it', () => {
    expect(spans(notes(EIGHTH, SIXTEENTH, SIXTEENTH), 8)).toEqual([{ start: 20, end: 40 }])
  })

  it('⭐ the first and last notes point their fractional beams INTO the group', () => {
    // ♬ ♪. — the semiquaver is first, so its stub points right…
    expect(spans(notes(SIXTEENTH, DOTTED_EIGHTH), 8)).toEqual([{ start: 0, end: 10 }])
    // …♪. ♬ — and last, so left.
    expect(spans(notes(DOTTED_EIGHTH, SIXTEENTH), 8)).toEqual([{ start: 20, end: 10 }])
  })

  it('⭐ an interior fractional beam points the way it was told', () => {
    const ns = notes(EIGHTH, SIXTEENTH, EIGHTH)
    expect(spans(ns, 8, { forcedSides: new Map([[1, 'R']]) })).toEqual([{ start: 20, end: 30 }])
    expect(spans(ns, 8, { forcedSides: new Map([[1, 'L']]) })).toEqual([{ start: 20, end: 10 }])
  })

  it('…and, untold, gives up LEFT at the primary', () => {
    expect(spans(notes(EIGHTH, SIXTEENTH, EIGHTH), 8)).toEqual([{ start: 20, end: 10 }])
  })

  it('a secondary break ends the line at that note — ⛔ never the primary', () => {
    const ns = notes(SIXTEENTH, SIXTEENTH, SIXTEENTH, SIXTEENTH)
    expect(spans(ns, 8, { breakIndexes: [1] })).toEqual([{ start: 0, end: 20 }, { start: 40, end: 60 }])
    expect(spans(ns, 4, { breakIndexes: [1] })).toEqual([{ start: 0, end: 60 }])
  })
})
