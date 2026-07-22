import { describe, it, expect } from 'vitest'
import { ScoreModel } from '../models/ScoreModel'
import { barWidthKey, spacingPositionKey, BAR_STRETCH_MIN } from '../models/engravingOverrides'
import { calculateMeasureWidths } from './MeasureLayout'
import { LAYOUT_CONFIG } from './layoutConfig'
import { resolveStaffClefs, type StaffClefs } from '@/utils/clefUtils'
import { fracCreate } from '@/utils/fraction'
import type { Score, BarWidthOverride, NoteParams, Dynamic } from '@/types/music'

/**
 * The width and justification halves of bar width (docs/bar-width-plan.md §2–§3).
 *
 * Two sentences these all test. **The multiplier is on the MUSIC** — never on the bar's
 * clef/meter overhead, which is reflow-dependent, so the same stored stretch buys the same pixels
 * whether the bar opens a line or not. And **the stretch is reserved off the top, not fed through
 * the stretcher** — with the invariant the whole feature rests on: a line still lands exactly on
 * `availableWidth`.
 */
const AVAILABLE = LAYOUT_CONFIG.CONTAINER_WIDTH - LAYOUT_CONFIG.MARGIN * 2

function clefs(score: Score): Map<string | undefined, StaffClefs> {
  return new Map((score.staves ?? [{ id: undefined }]).map(s => [s.id, resolveStaffClefs(score, s.id)]))
}

/** `measureCount` bars, each holding four quarter notes. Bars WITH MUSIC — the reserved-space
 *  model. An empty bar takes the other branch (see the share-scaling block below), so a suite of
 *  empty bars would silently test neither. */
function scoreWith(measureCount: number) {
  const model = new ScoreModel()
  while (model.getScore().measures.length < measureCount) model.addMeasure()
  for (let m = 1; m <= measureCount; m++) {
    for (const beat of [0, 1, 2, 3]) {
      model.addNote({ step: 'C', octave: 4, duration: 'q', measure: m, beat: fracCreate(beat, 1) } as NoteParams)
    }
  }
  return model
}

/** `measureCount` bars nobody has written into — the auto-filled whole rest and nothing else. */
function emptyScore(measureCount: number) {
  const model = new ScoreModel()
  while (model.getScore().measures.length < measureCount) model.addMeasure()
  return model
}

/** Stretch bar `n` (1-based) by `stretch`×. */
function stretch(model: ScoreModel, n: number, factor: number) {
  const measure = model.getScore().measures[n - 1]
  model.setBarWidth(barWidthKey(measure.id), factor, BAR_STRETCH_MIN)
}

describe('bar width — width (§2)', () => {
  it('the bar grows by exactly the stretch it was given', () => {
    const model = scoreWith(4)
    const before = calculateMeasureWidths(model.getScore(), clefs(model.getScore()), 'linear')
    stretch(model, 2, 2)
    const after = calculateMeasureWidths(model.getScore(), clefs(model.getScore()), 'linear').get(2)!
    expect(after.stretchSpace).toBeGreaterThan(0)
    expect(after.minWidth - before.get(2)!.minWidth).toBeCloseTo(after.stretchSpace!, 6)
  })

  it('the multiplier is on the MUSIC, not on the overhead — so a re-wrap cannot change what it buys', () => {
    // Bar 1 opens the line and draws the meter (45 + 30px of overhead bar 2 does not pay). Identical
    // music, identical stretch ⇒ identical stretchSpace, even though the bars are different widths.
    const model = scoreWith(2)
    stretch(model, 1, 2)
    stretch(model, 2, 2)
    const widths = calculateMeasureWidths(model.getScore(), clefs(model.getScore()), 'linear')
    expect(widths.get(1)!.minWidth).not.toBeCloseTo(widths.get(2)!.minWidth, 6)
    expect(widths.get(1)!.stretchSpace).toBeCloseTo(widths.get(2)!.stretchSpace!, 6)
  })

  it('survives the MAX_MEASURE_WIDTH clamp — the cap is on the music, not on the stretch', () => {
    const model = scoreWith(2)
    stretch(model, 1, 8)
    const info = calculateMeasureWidths(model.getScore(), clefs(model.getScore()), 'linear').get(1)!
    expect(info.minWidth - info.stretchSpace!).toBeLessThanOrEqual(LAYOUT_CONFIG.MAX_MEASURE_WIDTH)
    expect(info.minWidth).toBeGreaterThan(LAYOUT_CONFIG.MAX_MEASURE_WIDTH)
  })

  it('a stretch below 1 is a NEGATIVE stretchSpace — the bar hands room back', () => {
    const model = scoreWith(3)
    const before = calculateMeasureWidths(model.getScore(), clefs(model.getScore()), 'linear')
    stretch(model, 2, 0.5)
    const after = calculateMeasureWidths(model.getScore(), clefs(model.getScore()), 'linear').get(2)!
    expect(after.stretchSpace).toBeLessThan(0)
    expect(after.minWidth).toBeLessThan(before.get(2)!.minWidth)
  })

  it('a bar nobody stretched carries no stretchSpace', () => {
    const model = scoreWith(2)
    stretch(model, 1, 2)
    expect(calculateMeasureWidths(model.getScore(), clefs(model.getScore()), 'linear').get(2)!.stretchSpace)
      .toBe(0)
  })

  it('reaches the break pass: enough stretch re-wraps the line', () => {
    const model = scoreWith(6)
    const linesBefore = new Set(
      [...calculateMeasureWidths(model.getScore(), clefs(model.getScore())).values()].map(i => i.lineNumber),
    ).size
    for (let n = 1; n <= 6; n++) stretch(model, n, 4)
    const linesAfter = new Set(
      [...calculateMeasureWidths(model.getScore(), clefs(model.getScore())).values()].map(i => i.lineNumber),
    ).size
    expect(linesAfter).toBeGreaterThan(linesBefore)
  })
})

describe('bar width — justification (§3)', () => {
  it('⭐ the line still lands exactly on the available width', () => {
    const model = scoreWith(4)
    stretch(model, 3, 2)
    const widths = calculateMeasureWidths(model.getScore(), clefs(model.getScore()))
    for (const line of new Set([...widths.values()].map(i => i.lineNumber))) {
      const total = [...widths.values()].filter(i => i.lineNumber === line).reduce((s, i) => s + i.finalWidth, 0)
      expect(total).toBeCloseTo(AVAILABLE, 6)
    }
  })

  it('…and still does with a leading space and a shrink on the same line', () => {
    const model = scoreWith(5)
    stretch(model, 2, 2.5)
    stretch(model, 4, 0.5)
    const m3 = model.getScore().measures[2]
    model.setNoteSpacing(spacingPositionKey(m3.id, fracCreate(1, 1)), 4, -100)
    const widths = calculateMeasureWidths(model.getScore(), clefs(model.getScore()))
    for (const line of new Set([...widths.values()].map(i => i.lineNumber))) {
      const total = [...widths.values()].filter(i => i.lineNumber === line).reduce((s, i) => s + i.finalWidth, 0)
      expect(total).toBeCloseTo(AVAILABLE, 6)
    }
  })

  it('the stretch is NOT diluted by the stretcher — it arrives whole, the neighbours pay', () => {
    const model = scoreWith(4)
    const before = calculateMeasureWidths(model.getScore(), clefs(model.getScore()))
    stretch(model, 2, 2)
    const after = calculateMeasureWidths(model.getScore(), clefs(model.getScore()))
    // The bar is wider; its own justified share is smaller (it paid its part of its own stretch).
    expect(after.get(2)!.finalWidth).toBeGreaterThan(before.get(2)!.finalWidth)
    expect(after.get(2)!.finalWidth - after.get(2)!.stretchSpace!).toBeLessThan(before.get(2)!.finalWidth)
    for (const n of [1, 3, 4]) {
      if (after.get(n)!.lineNumber !== after.get(2)!.lineNumber) continue
      expect(after.get(n)!.finalWidth).toBeLessThan(before.get(n)!.finalWidth)
    }
  })

  it('caps the line’s total authored width — no negative widths, nothing off the page', () => {
    const model = scoreWith(3)
    for (let n = 1; n <= 3; n++) stretch(model, n, 8)
    const widths = calculateMeasureWidths(model.getScore(), clefs(model.getScore()))
    for (const info of widths.values()) {
      expect(info.finalWidth).toBeGreaterThan(0)
      expect(info.finalWidth).toBeLessThanOrEqual(AVAILABLE + 1e-6)
    }
  })

  it('a hand-authored stretch of 0 cannot produce a negative width — the JSON path is bounded too', () => {
    // Import (and the P0 hand-edit) never passes through ScoreModel.setBarWidth, so the bounds have
    // to hold at the read as well. Written straight into the compartment, as a load would.
    const model = scoreWith(3)
    for (const m of model.getScore().measures) {
      model.setEngravingOverride(barWidthKey(m.id), { kind: 'barWidth', stretch: 0 } as BarWidthOverride)
    }
    const widths = calculateMeasureWidths(model.getScore(), clefs(model.getScore()))
    for (const info of widths.values()) expect(info.finalWidth).toBeGreaterThan(0)
    for (const line of new Set([...widths.values()].map(i => i.lineNumber))) {
      const total = [...widths.values()].filter(i => i.lineNumber === line).reduce((s, i) => s + i.finalWidth, 0)
      expect(total).toBeCloseTo(AVAILABLE, 6)
    }
  })

  it('linear view is already exact — nothing is justified, so the stretch is verbatim', () => {
    const model = scoreWith(3)
    stretch(model, 2, 3)
    const info = calculateMeasureWidths(model.getScore(), clefs(model.getScore()), 'linear').get(2)!
    expect(info.finalWidth).toBe(info.minWidth)
  })

  it('an unstretched score justifies exactly as before', () => {
    const model = scoreWith(5)
    const widths = calculateMeasureWidths(model.getScore(), clefs(model.getScore()))
    for (const info of widths.values()) expect(info.stretchSpace).toBe(0)
    for (const line of new Set([...widths.values()].map(i => i.lineNumber))) {
      const total = [...widths.values()].filter(i => i.lineNumber === line).reduce((s, i) => s + i.finalWidth, 0)
      expect(total).toBeCloseTo(AVAILABLE, 6)
    }
  })
})

/**
 * The EMPTY-bar branch (§2, corrected at P1 from use): a bar nobody has written into has no music
 * to set its claim on the line, so its stretch scales that claim instead of reserving space beside
 * it. Without this an empty bar could give back only its 40px note space and still sit there at
 * full width, unable to get out of a long neighbour's way.
 */
describe('bar width — an empty bar scales its SHARE (§2)', () => {
  it('reserves nothing and folds the stretch into the bar\u2019s own width', () => {
    const model = emptyScore(3)
    stretch(model, 2, 0.5)
    const info = calculateMeasureWidths(model.getScore(), clefs(model.getScore()), 'linear').get(2)!
    expect(info.stretchScalesShare).toBe(true)
    expect(info.stretchSpace).toBe(0)
  })

  it('⚠️ decides EMPTINESS from the content, never from a measured width', () => {
    // The first version compared the bar's note space to the empty-bar floor — a number the
    // FORMATTER produces. Stubbed text metrics made every empty bar match under test while a real
    // browser measured wider and took the other branch: green here, dead in the app. So the question
    // has to be structural, and these four cases pin it.
    const empty = emptyScore(4)
    empty.addNote({ step: 'C', octave: 4, duration: 'q', measure: 2, beat: fracCreate(0, 1) } as NoteParams)
    // …bar 3 gets authored rhythm (four rests), bar 4 a dynamic. Neither is "a bar nobody wrote in".
    for (const beat of [0, 1, 2, 3]) empty.addRest('q', 3, fracCreate(beat, 1))
    empty.addDynamic(4, { measure: 4, beat: fracCreate(0, 1), text: 'f' } as Omit<Dynamic, 'id'>)
    const widths = calculateMeasureWidths(empty.getScore(), clefs(empty.getScore()), 'linear')
    expect(widths.get(1)!.stretchScalesShare).toBe(true)  // untouched
    expect(widths.get(2)!.stretchScalesShare).toBe(false) // has a note
    expect(widths.get(3)!.stretchScalesShare).toBe(false) // authored rhythm
    expect(widths.get(4)!.stretchScalesShare).toBe(false) // has a dynamic to fit
  })

  it('a bar WITH music does the opposite — its music is what sets its claim', () => {
    const model = scoreWith(3)
    stretch(model, 2, 0.5)
    const info = calculateMeasureWidths(model.getScore(), clefs(model.getScore()), 'linear').get(2)!
    expect(info.stretchScalesShare).toBe(false)
    expect(info.stretchSpace).toBeLessThan(0)
  })

  it('⭐ the empty bar gets OUT OF THE WAY: its share drops and the line gives it to the others', () => {
    const model = emptyScore(3)
    const before = calculateMeasureWidths(model.getScore(), clefs(model.getScore()))
    stretch(model, 2, 0.3)
    const after = calculateMeasureWidths(model.getScore(), clefs(model.getScore()))
    // 0.75, not the old 0.6 — and NOT because the bar shrinks less. It lands on the same pixels it
    // always did; what moved is the BASELINE it is a fraction of. An unstretched empty bar used to
    // be inflated to `MIN_MEASURE_WIDTH`, so the old ratio was measured against fat that no longer
    // exists (see `calculateMinimumMeasureWidth`).
    expect(after.get(2)!.finalWidth).toBeLessThan(before.get(2)!.finalWidth * 0.75)
    for (const n of [1, 3]) {
      if (after.get(n)!.lineNumber !== after.get(2)!.lineNumber) continue
      expect(after.get(n)!.finalWidth).toBeGreaterThan(before.get(n)!.finalWidth)
    }
  })

  it('at stretch 1 an empty bar is byte-identical to an unstretched one — the branch is invisible at rest', () => {
    const plain = calculateMeasureWidths(emptyScore(4).getScore(), clefs(emptyScore(4).getScore()))
    const model = emptyScore(4)
    stretch(model, 2, 2)
    stretch(model, 2, 1) // …and back, which clears the override
    const same = calculateMeasureWidths(model.getScore(), clefs(model.getScore()))
    for (const n of [1, 2, 3, 4]) {
      expect(same.get(n)!.finalWidth).toBeCloseTo(plain.get(n)!.finalWidth, 6)
    }
  })

  it('keeps the bar\u2019s clef and meter room whatever the stretch — only the note area scales', () => {
    // Bar 1 opens the line and draws both. Shrunk hard, it must still be wider than the overhead
    // it has to draw, or the glyphs collide.
    const model = emptyScore(2)
    stretch(model, 1, 0.25)
    const info = calculateMeasureWidths(model.getScore(), clefs(model.getScore()), 'linear').get(1)!
    expect(info.minWidth).toBeGreaterThan(LAYOUT_CONFIG.CLEF_WIDTH + LAYOUT_CONFIG.TIME_SIG_WIDTH)
  })

  it('the line still lands exactly on the available width with a shrunken empty bar', () => {
    const model = emptyScore(5)
    stretch(model, 3, 0.3)
    stretch(model, 4, 2.5)
    const widths = calculateMeasureWidths(model.getScore(), clefs(model.getScore()))
    for (const line of new Set([...widths.values()].map(i => i.lineNumber))) {
      const total = [...widths.values()].filter(i => i.lineNumber === line).reduce((s, i) => s + i.finalWidth, 0)
      expect(total).toBeCloseTo(AVAILABLE, 6)
    }
  })
})

/**
 * The **two-number** width: what a bar asks for (`minWidth`, which drives the casting-off and so the
 * default look of the page) against how far it can be FORCED (`floorWidth`) when a bar on its line
 * is growing. Collapsing the two made every empty bar permanently narrow and packed the systems —
 * 14 bars to a line at 63px instead of 9 at 103 — which is what "the default width is like
 * maximum-shrinking" meant when it was reported.
 */
describe('bar width — asked-for vs forced (§3)', () => {
  const barsOnLine0 = (model: ScoreModel) =>
    [...calculateMeasureWidths(model.getScore(), clefs(model.getScore())).values()]
      .filter(i => i.lineNumber === 0)

  it('⭐ with nothing growing, the casting-off is untouched — no bar goes below what it asks for', () => {
    const line = barsOnLine0(emptyScore(24))
    expect(line.length).toBeGreaterThan(5) // a full line, or this asserts nothing
    for (const info of line) {
      expect(info.finalWidth).toBeGreaterThanOrEqual(LAYOUT_CONFIG.MIN_MEASURE_WIDTH)
    }
  })

  it('⭐ …and a growing bar squeezes them below it, rather than re-wrapping first', () => {
    const model = emptyScore(24)
    const before = barsOnLine0(model)
    stretch(model, 1, 3)
    const after = barsOnLine0(model)
    // The line KEEPS its bars — the room comes out of them before the system re-casts.
    expect(after.length).toBe(before.length)
    const squeezed = after.filter(i => i.measureNumber > 1)
    expect(squeezed.every(i => i.finalWidth < LAYOUT_CONFIG.MIN_MEASURE_WIDTH)).toBe(true)
    // …but never past the floor, which is what stops it collapsing to nothing.
    expect(squeezed.every(i => i.finalWidth >= i.floorWidth!)).toBe(true)
  })

  it('⭐ the squeeze lands on the SILENCE first — an empty bar pays more than a bar of music', () => {
    // ⚠️ A FULL line — eight bars, not four. With a short line there is surplus to hand round and
    // every bar sits above its natural width, so nothing is being taken from anyone and the tiers
    // never engage (measured: at four bars all three lose exactly the same 47px, which is correct
    // justification, not the bug). The ordering only exists once the line is genuinely short.
    const model = new ScoreModel()
    while (model.getScore().measures.length < 8) model.addMeasure()
    for (const m of [1, 4]) {
      for (const beat of [0, 1, 2, 3]) {
        model.addNote({ step: 'C', octave: 4, duration: 'q', measure: m, beat: fracCreate(beat, 1) } as NoteParams)
      }
    }
    const widthsOf = () => calculateMeasureWidths(model.getScore(), clefs(model.getScore()))
    const before = widthsOf()
    stretch(model, 1, 4)
    const after = widthsOf()
    const lost = (n: number) => before.get(n)!.finalWidth - after.get(n)!.finalWidth
    expect(lost(2)).toBeGreaterThan(0)
    expect(lost(4)).toBeGreaterThan(0)
    expect(lost(2)).toBeGreaterThan(lost(4) * 2) // silence pays first, and pays much more
  })

  it('an authored leading space is NOT a claim: it still re-wraps instead of squeezing', () => {
    // The other pool. A space is a dead gap that genuinely needs its room, and note spacing states
    // as a design property that it reaches the break pass — letting it squeeze would repeal that
    // silently. Guarded here because both features share this admission rule.
    const model = emptyScore(6)
    const linesBefore = new Set([...calculateMeasureWidths(model.getScore(), clefs(model.getScore())).values()].map(i => i.lineNumber)).size
    for (let n = 1; n <= 6; n++) {
      model.setNoteSpacing(spacingPositionKey(model.getScore().measures[n - 1].id, fracCreate(1, 1)), 8, -100)
    }
    const linesAfter = new Set([...calculateMeasureWidths(model.getScore(), clefs(model.getScore())).values()].map(i => i.lineNumber)).size
    expect(linesAfter).toBeGreaterThan(linesBefore)
  })
})
