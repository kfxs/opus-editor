/**
 * Where each augmentation dot of a column stands. ⚠️ Exactness against `Dot.format` was proved once,
 * on 655 dots of random scores (S9c, `docs/history/vexflow-removal-map.md` §5.2); pinned here is the rule.
 */
import { describe, it, expect } from 'vitest'
import { type ColumnDot, UNISON_DOT_SPACING_PX, stackDots } from './dotStack'

const dot = (line: number, over: Partial<ColumnDot> = {}): ColumnDot => ({
  line, noteKey: 'n', isRest: false, firstDotPx: 0, width: 4, shiftY: 0, ...over,
})

describe('stackDots', () => {
  it('a note in a SPACE keeps its dot there', () => {
    expect(stackDots([dot(3.5)]).placed[0].shiftY).toBeCloseTo(0)
  })

  it('a note on a LINE lifts its dot half a space', () => {
    expect(stackDots([dot(3)]).placed[0].shiftY).toBe(-0.5)
  })

  it('⭐ a second: the lower note drops its dot, because the upper one took the space between', () => {
    const { placed } = stackDots([dot(3), dot(3.5)])
    expect(placed[1].shiftY, 'the upper, in a space').toBeCloseTo(0)
    expect(placed[0].shiftY, 'the lower, on a line — down').toBe(0.5)
  })

  it('a line note whose space above was just taken drops too', () => {
    // 4 lifts into 4.5; 3.5 sits in its space; 3 would lift into 3.5 — taken — so it drops.
    const { placed } = stackDots([dot(4), dot(3.5), dot(3)])
    expect(placed.map(p => p.shiftY)).toEqual([-0.5, -0, 0.5])
  })

  it('⚠️ a rest ADDS the lift the note walked before it took', () => {
    // The line-3 note lifts (−0.5), so the rest below it moves by −0.5 on top of the 1 it had.
    expect(stackDots([dot(3, { noteKey: 'a' }), dot(2.5, { noteKey: 'r', isRest: true, shiftY: 1 })]).placed[1].shiftY)
      .toBe(0.5)
  })

  it('dots start past a right-displaced head, and a unison dot stands to the right of the first', () => {
    const { placed, width } = stackDots([dot(3, { firstDotPx: 6 }), dot(3, { firstDotPx: 6 })])
    expect(placed.map(p => p.xShift)).toEqual([6, 6 + 4 + UNISON_DOT_SPACING_PX])
    expect(width).toBe(6 + 2 * (4 + UNISON_DOT_SPACING_PX))
  })

  it('no dots, no room', () => {
    expect(stackDots([])).toEqual({ placed: [], width: 0, dropped: [] })
  })
})

describe('stackDots — the TWO-PART rule (docs/plans/multiple-dots-plan.md P4d, `layout/dotVoice`)', () => {
  const GOULD = { downStemBelow: true, overlapLifts: true }
  // Treble: G4 is line 2, E4 line 1 — the stem-up G4 above, the stem-down E4 below.
  const upG4 = dot(2, { noteKey: 'up' })
  const downE4 = dot(1, { noteKey: 'down', stemDown: true })

  it('⭐ two parts: the stem-DOWN line note drops its dot BELOW; the stem-up one keeps the space above', () => {
    const { placed } = stackDots([upG4, downE4], { twoParts: true, upStemLines: [2], ...GOULD })
    expect(placed.map(p => p.shiftY)).toEqual([-0.5, 0.5])
  })

  it('no rule passed = VexFlow’s, which lifts both', () => {
    expect(stackDots([upG4, downE4]).placed.map(p => p.shiftY)).toEqual([-0.5, -0.5])
  })

  it('⛔ one part only: a stem-down line note keeps the space above', () => {
    const { placed } = stackDots([downE4], { twoParts: false, upStemLines: [], ...GOULD })
    expect(placed[0].shiftY).toBe(-0.5)
  })

  it('⭐ Gould p. 58: CROSSED parts — the stem-down head at or above a stem-up head — keep the space above', () => {
    const downG4 = dot(2, { noteKey: 'down', stemDown: true })
    const upE4 = dot(1, { noteKey: 'up' })
    const { placed } = stackDots([downG4, upE4], { twoParts: true, upStemLines: [1], ...GOULD })
    expect(placed[0].shiftY, 'lifted — the overlap exception').toBe(-0.5)
    const verovio = stackDots([downG4, upE4], { twoParts: true, upStemLines: [1], downStemBelow: true, overlapLifts: false })
    expect(verovio.placed[0].shiftY, '`verovio` has no exception').toBe(0.5)
  })
})

describe('stackDots — a chord whose dots COLLIDE (docs/plans/multiple-dots-plan.md P4e, `layout/chordDots`)', () => {
  // C5 D5 E5 F5 in treble: lines 3.5, 4, 4.5, 5 — VexFlow's walk puts D5's dot in C5's space.
  const cluster = [5, 4.5, 4, 3.5].map(line => dot(line, { noteKey: 'chord' }))
  const spaces = (placed: { shiftY: number }[]) => placed.map((p, i) => cluster[i].line - p.shiftY)

  it('`keep` (VexFlow’s, the default): two dots in ONE space — what we drew', () => {
    expect(spaces(stackDots(cluster).placed)).toEqual([5.5, 4.5, 3.5, 3.5])
  })

  it('⭐ `centre` (Gould): a space each, centred on the chord', () => {
    const { placed, dropped } = stackDots(cluster, undefined, 'centre')
    expect(spaces(placed)).toEqual([5.5, 4.5, 3.5, 2.5])
    expect(dropped.every(d => !d)).toBe(true)
  })

  it('`merge` (Verovio): the lower dot in a taken space is DROPPED', () => {
    const { dropped } = stackDots(cluster, undefined, 'merge')
    expect(dropped).toEqual([false, false, false, true])
  })

  it('`lilypond` / `musescore`: the ported engines seat the cluster their way', () => {
    expect(spaces(stackDots(cluster, undefined, 'lilypond').placed)).toEqual([5.5, 4.5, 3.5, 2.5])
    expect(spaces(stackDots(cluster, undefined, 'musescore').placed), 'one flip, never re-checked').toEqual([5.5, 4.5, 3.5, 3.5])
  })

  it('⛔ a chord with NO collision is left exactly as the walk placed it (a triad)', () => {
    const triad = [3, 2, 1].map(line => dot(line, { noteKey: 't' }))
    expect(stackDots(triad, undefined, 'centre').placed).toEqual(stackDots(triad).placed)
  })
})
