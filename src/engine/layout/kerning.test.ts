import { describe, it, expect } from 'vitest'
import { inkFloor, mergedReach, edgeKind, KERN_CLEARANCE, type InkBox } from './kerning'
import { INK, INK_HEIGHT, pairPadding, accidentalExtent } from './spacingPadding'

/**
 * KERNING — two inks only need horizontal clearance where they share a vertical band
 * (`docs/vexflow-boundary.md` §5 P1).
 *
 * ⚠️ These are all ALGEBRA tests, deliberately: they hand `inkFloor` boxes and check the number. Where
 * the boxes come FROM is `measureColumns`' job (and `measureColumns.test.ts`'s), and whether the
 * drawing agrees is `e2e/kerning.e2e.ts`'s — jsdom cannot measure a glyph, so a "did it look right"
 * assertion here would measure zeros and agree with itself.
 */

/** A box, with the boring fields defaulted — `y` is the band's centre in staff spaces below the top line. */
const box = (kind: InkBox['kind'], y: number, reach: { left?: number; right?: number; height?: number; staff?: string }): InkBox => ({
  left: reach.left ?? 0,
  right: reach.right ?? 0,
  top: y - (reach.height ?? INK_HEIGHT.notehead),
  bottom: y + (reach.height ?? INK_HEIGHT.notehead),
  kind,
  staff: reach.staff,
})

/** A bare notehead at line `y`, and a sharpened note whose sign reaches its measured 1.40 spaces. */
const head = (y: number, staff?: string) => box('note', y, { right: INK.notehead, staff })
const sharp = (y: number, staff?: string) => box('accidental', y, { left: accidentalExtent([{ position: 0, sign: '#' }]), height: 1.4, staff })

describe('inkFloor — the floor is a max over box PAIRS', () => {
  it('⭐ with nothing vertically clear it is EXACTLY the old merged expression', () => {
    // The property that makes kerning incapable of widening anything: two things at the same pitch
    // reach the same answer the horizontal-only model did — `right + padding + left`.
    const a = [head(2)]
    const b = [sharp(2), head(2)]
    const expected = INK.notehead + pairPadding('note', 'accidental') + accidentalExtent([{ position: 0, sign: '#' }])
    expect(inkFloor(a, b)).toBeCloseTo(expected, 10)
  })

  it('⭐⭐ a LOW accidental clears a HIGH notehead, and the pair stops being paid for', () => {
    // The whole feature. The accidental's band (±1.4 about its own line) is four spaces below the
    // notehead's, so that pair is skipped and what is left is the two HEADS — which never kern.
    const high = [head(-1)]
    const low = [sharp(4.5), head(4.5)]
    expect(inkFloor(high, low)).toBeCloseTo(INK.notehead + pairPadding('note', 'note'), 10)
  })

  it('…but a STEP away it does not: the bands touch, so the accidental buys its room', () => {
    const above = [head(2)]
    const below = [sharp(2.5), head(2.5)]
    const kerned = INK.notehead + pairPadding('note', 'note')
    expect(inkFloor(above, below)).toBeGreaterThan(kerned)
  })

  it('the clearance is a threshold, not a touch — a hair apart is still the same band', () => {
    const gap = INK_HEIGHT.notehead + 1.4 + KERN_CLEARANCE
    const clear = inkFloor([head(0)], [sharp(gap + 0.05), head(gap + 0.05)])
    const notClear = inkFloor([head(0)], [sharp(gap - 0.05), head(gap - 0.05)])
    expect(clear).toBeLessThan(notClear)
  })

  it('⛔ two NOTEHEADS never kern, however far apart they are', () => {
    // Not an ink question: heads that overlap horizontally read as SIMULTANEOUS. MuseScore's
    // `KerningType::NON_KERNING`, and the entry in `MAY_KERN` that says no.
    const far = inkFloor([head(-4)], [head(8)])
    expect(far).toBeCloseTo(INK.notehead + pairPadding('note', 'note'), 10)
  })

  it('⛔ nothing kerns through a BARLINE — its band is the whole staff', () => {
    const barline: InkBox = { left: 0, right: 0, top: 0, bottom: 4, kind: 'barline', staff: undefined }
    // A high note's run-out to the barline is the same whatever the pitch: `note↔barline`.
    for (const y of [-3, 2, 7]) {
      expect(inkFloor([head(y)], [barline])).toBeCloseTo(INK.notehead + pairPadding('note', 'barline'), 10)
    }
  })

  it('⭐⭐ ink on DIFFERENT STAVES is clear — the piano case', () => {
    // A left-hand accidental used to buy room in the right hand's gaps, because a column merges every
    // staff. Same pitch band, different staff: the ACCIDENTAL pair is skipped.
    const rightHand = [head(2, 'staff-1')]
    const leftHand = [sharp(2, 'staff-2'), head(2, 'staff-2')]
    const sameStaff = [sharp(2, 'staff-1'), head(2, 'staff-1')]
    expect(inkFloor(rightHand, leftHand)).toBeLessThan(inkFloor(rightHand, sameStaff))

    // ⛔ …and what is LEFT is still the two noteheads' own 1.43, across staves as within one. In a
    //    grand staff an x is a TIME, so a bass note drawn under a treble note reads as simultaneous
    //    with it — which is the same misreading `note↔note` refuses on one staff.
    expect(inkFloor(rightHand, leftHand)).toBeCloseTo(INK.notehead + pairPadding('note', 'note'), 10)
  })

  it('a STEM blocks what a notehead alone would not', () => {
    // A high note's DOWN stem hangs through the band a low accidental wants. Without the stem in the
    // model the accidental would tuck into ink that is really there.
    const withStem = [head(-1), box('stem', 0.5, { right: INK.notehead, height: 1.5 })]
    const low = [sharp(2.5), head(2.5)]
    expect(inkFloor(withStem, low)).toBeGreaterThan(inkFloor([head(-1)], low))
  })

  it('an empty column floors at nothing — a duration-only fixture leaves the rule in charge', () => {
    expect(inkFloor([], [head(2)])).toBe(0)
    expect(inkFloor([head(2)], [])).toBe(0)
  })
})

describe('mergedReach / edgeKind — the projection the rest of the model still speaks', () => {
  it('⭐ projects the boxes back to the reach the horizontal-only model computed', () => {
    const boxes = [sharp(2), head(2), box('dot', 2, { right: 2.1 })]
    expect(mergedReach(boxes)).toEqual({
      left: accidentalExtent([{ position: 0, sign: '#' }]),
      right: 2.1,
    })
  })

  it('names the WIDEST box at each edge — that is the key into the pair table', () => {
    const boxes = [sharp(2), head(2), box('dot', 2, { right: 2.1 })]
    expect(edgeKind(boxes, 'left')).toBe('accidental')
    expect(edgeKind(boxes, 'right')).toBe('dot')
  })

  it('⚠️ a box reaching NOWHERE names itself; one reaching only the other way leaves a BARE side', () => {
    // The barline is a marker: answer `note` for it and every bar's closing gap becomes `note↔note`
    // (0.3) instead of `note↔barline` (1.0) — the run-out at the end of each bar, deleted.
    const barline: InkBox = { left: 0, right: 0, top: 0, bottom: 4, kind: 'barline', staff: undefined }
    expect(edgeKind([barline], 'left')).toBe('barline')
    expect(edgeKind([barline], 'right')).toBe('barline')

    // ⏭️ A rest reaches RIGHT and not left, so its left side reads as bare — which is what the merged
    //    edges did before the ink was located, and it means `barline↔rest` has never applied to a bar
    //    that OPENS with a rest. Preserved on purpose: delivering it widens every such bar by 0.45
    //    spaces and moves the measure rest off centre. See `edgeKind`'s doc.
    const rest: InkBox = { left: 0, right: 1.2, top: 0, bottom: 4, kind: 'rest', staff: undefined }
    expect(edgeKind([rest], 'left')).toBe('note')
    expect(edgeKind([rest], 'right')).toBe('rest')
    expect(edgeKind([], 'left')).toBe('note')
  })
})
