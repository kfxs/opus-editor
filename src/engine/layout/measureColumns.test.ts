import { describe, it, expect } from 'vitest'
import { ScoreModel } from '@/engine/models/ScoreModel'
import { fracCreate as frac } from '@/utils/fraction'
import { followingSpace, naturalWidth } from './spacing'
import { measureColumns } from './measureColumns'
import { INK, MIN_COLUMN_GAP, pairPadding } from './spacingPadding'
import type { Measure, NoteParams } from '@/types/music'

/**
 * A measure's columns — the bridge from the music to the rule (docs/spacing-model-plan.md P2).
 *
 * ⭐ Everything here works headless *because* it is duration-only: the widths below are the rule's
 * answer, not the ink's, and the ink measures 0×0 in node (docs/spacing-model-research.md §5.4). The
 * real drawn gaps are pinned in `e2e/spacing.e2e.ts`.
 */

const bar = (model: ScoreModel, n = 1): Measure => model.getMeasure(n)!
const beats = (measure: Measure) => measureColumns(measure).map(c => c.beat.num / c.beat.den)
const spans = (measure: Measure) => measureColumns(measure).map(c => c.duration.num / c.duration.den)

/**
 * A bar of `n` notes of one duration, filling 4/4 — all on **B4, the middle line**.
 *
 * ⚠️ The pitch matters and used to be C4. In treble that is staff line 0, i.e. a note on a LEDGER
 * LINE, which is 0.67 spaces of ink wider than a bare notehead — so every "a plain note reaches
 * exactly one notehead" assertion here was quietly measuring a ledgered one.
 */
function evenBar(count: number, duration: NoteParams['duration']): ScoreModel {
  const model = new ScoreModel()
  for (let i = 0; i < count; i++) {
    model.addNote({ step: 'B', octave: 4, duration, measure: 1, beat: frac(i * 4, count) } as NoteParams)
  }
  return model
}

describe('measureColumns', () => {
  it('is one column per event, plus the BARLINE as the last one', () => {
    const model = evenBar(4, 'q')
    expect(beats(bar(model))).toEqual([0, 1, 2, 3, 4])
    // Each column's span is the distance to the NEXT — the barline's is zero, nothing follows it.
    expect(spans(bar(model))).toEqual([1, 1, 1, 1, 0])
  })

  it('⭐ TWO VOICES at one beat are ONE column — the change every piano score sees', () => {
    const model = evenBar(4, 'q')
    for (const beat of [0, 1, 2, 3]) {
      model.addNote({ step: 'G', octave: 4, duration: 'q', measure: 1, beat: frac(beat, 1), voice: 2 } as NoteParams)
    }
    expect(bar(model).slots.length, 'eight slots in the model').toBe(8)
    expect(beats(bar(model)), 'and four columns on the page').toEqual([0, 1, 2, 3, 4])
  })

  it('⚠️ a column\'s span is to the NEXT COLUMN, not the note\'s own written value', () => {
    // Voice 1 holds a whole note; voice 2 plays four quarters under it. The whole note's COLUMN is
    // followed a quarter later, so it earns a quarter's space — it is still a whole note, and is
    // still drawn as one.
    const model = new ScoreModel()
    model.addNote({ step: 'C', octave: 4, duration: 'w', measure: 1, beat: frac(0, 1) } as NoteParams)
    for (const beat of [0, 1, 2, 3]) {
      model.addNote({ step: 'G', octave: 4, duration: 'q', measure: 1, beat: frac(beat, 1), voice: 2 } as NoteParams)
    }
    expect(spans(bar(model))).toEqual([1, 1, 1, 1, 0])
  })

  it('merges the STAVES: a position is the system\'s, not one staff\'s', () => {
    const model = new ScoreModel()
    model.addStaffBelow(0)
    const [upper, lower] = model.getScore().staves!.map(s => s.id)
    for (const beat of [0, 1, 2, 3]) {
      model.addNote({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: frac(beat, 1), staffId: upper } as NoteParams)
    }
    for (const beat of [0, 2]) {
      model.addNote({ step: 'C', octave: 3, duration: 'h', measure: 1, beat: frac(beat, 1), staffId: lower } as NoteParams)
    }
    // Four columns, not six: the left hand's beat 2 IS the right hand's beat 2.
    expect(beats(bar(model))).toEqual([0, 1, 2, 3, 4])
  })

  it('a bar with nothing in it still has a column — something is drawn there', () => {
    const model = new ScoreModel()
    const empty: Measure = { ...bar(model), slots: [] }
    expect(beats(empty)).toEqual([0, 4])
    expect(spans(empty), 'and the gap before the barline is the whole bar').toEqual([4, 0])
  })

  it('takes a pickup bar\'s own capacity, so its barline is where the bar ends', () => {
    const model = new ScoreModel()
    model.addNote({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) } as NoteParams)
    const pickup: Measure = { ...bar(model), actualDurationOverride: frac(1, 1) }
    expect(beats(pickup)).toEqual([0, 1])
  })

  /**
   * ⭐⭐ HIS RULE, after the members spent a week as columns: *"the source of truth in the time space
   * is the staff below, not the staff above"*. A fan's members fall on accelerating rationals, and as
   * columns they were one x for the WHOLE SYSTEM — so sixteen even sixteenths on the other staff came
   * out at 21.5, 21.5, 36.3, 36.3, 21.5, … The owner stays a grid point; the members become its ink.
   */
  it('⭐ a FAN holds ONE column — its owner\'s — and its members are that column\'s INK', () => {
    const model = new ScoreModel()
    const note = model.addNote({ step: 'C', octave: 4, duration: 'h', measure: 1, beat: frac(0, 1) } as NoteParams)
    model.setFan(note.id, { direction: 'accel', count: 4, beams: 3 })

    const columns = measureColumns(bar(model))
    // The fan's own beat, the rest filling beats 2–4, and the barline. NOTHING at a member's beat.
    expect(columns.map(c => c.beat.num / c.beat.den)).toEqual([0, 2, 4])
    expect(columns[0].duration, 'the owner spans its own written value').toEqual(frac(2, 1))

    // …and the ramp is a ROD over the gaps its own time crosses (`Column.rod`), which is what makes
    // the bar reserve room for it without minting a column anyone else shares.
    const plain = new ScoreModel()
    plain.addNote({ step: 'C', octave: 4, duration: 'h', measure: 1, beat: frac(0, 1) } as NoteParams)
    expect(measureColumns(bar(plain))[0].rod, 'an ordinary note asks for no rod').toBe(0)
    expect(columns[0].rod, 'the fan rods the gap by its ramp').toBeGreaterThan(0)
    expect(columns[0].extent.right, 'and its INK is still one notehead — the members are not ink here')
      .toBe(measureColumns(bar(plain))[0].extent.right)

    // A denser fan asks for more, still without a column of its own.
    const dense = new ScoreModel()
    const denseNote = dense.addNote({ step: 'C', octave: 4, duration: 'h', measure: 1, beat: frac(0, 1) } as NoteParams)
    dense.setFan(denseNote.id, { direction: 'accel', count: 12, beams: 3 })
    const denseColumns = measureColumns(bar(dense))
    expect(denseColumns.map(c => c.beat.num / c.beat.den)).toEqual([0, 2, 4])
    expect(denseColumns[0].rod).toBeGreaterThan(columns[0].rod)
  })

  it('never mints a column at or past the barline', () => {
    const model = evenBar(4, 'q')
    const columns = measureColumns(bar(model))
    const barline = columns[columns.length - 1]
    expect(barline.beat).toEqual(frac(4, 1))
    expect(columns.filter(c => c.beat.num / c.beat.den >= 4)).toHaveLength(1)
  })

  it('carries each column\'s own INK and each gap\'s own PAIR padding', () => {
    const columns = measureColumns(bar(evenBar(4, 'q')))
    for (const column of columns.slice(0, 4)) {
      expect(column.extent, 'a bare notehead, and nothing to its left').toEqual({ left: 0, right: INK.notehead })
      expect(column.authored).toBe(0)
    }
    expect(columns.slice(0, 3).map(c => c.padding), 'note↔note').toEqual([0.3, 0.3, 0.3])
    expect(columns[3].padding, 'note↔barline is its own row').toBe(pairPadding('note', 'barline'))
    expect(columns[4].extent, 'and the barline draws no ink of its own').toEqual({ left: 0, right: 0 })
  })
})

describe('the width these columns ask for', () => {
  const asks = (model: ScoreModel) => naturalWidth(measureColumns(bar(model)))

  it('⭐⭐ sixteen 16ths ask for TWICE four quarters — not four times, which is what we did', () => {
    // THE headline of the whole model, and the one assertion that works headless because it is
    // duration-only. Before P2 a bar's room was ∝ its EVENT COUNT and this ratio was ~4
    // (docs/spacing-model-research.md §6, where it measured 3.9 on the page).
    const quarters = asks(evenBar(4, 'q'))
    const sixteenths = asks(evenBar(16, '16'))
    // LilyPond's quarter is 3.6 spaces (Gould's 3½ + 3%) — see `spacing.ts`'s LILYPOND_SPACING.
    expect(quarters, 'four quarters at LilyPond\'s 3.6 spaces each').toBeCloseTo(14.4, 6)
    // Fifteen gaps of the curve's 1.8, and then the BARLINE gap, which the ink wins: a notehead
    // plus note↔barline is 2.13, wider than a 16th earns. ⭐ That extra 0.38 is the whole point of
    // making the barline a column — it is what stops the last 16th of a dense bar sitting 0.6
    // spaces from the line, which is where `BARLINE_PADDING` used to leave it.
    expect(sixteenths).toBeCloseTo(15 * 1.8 + INK.notehead + 1.0, 6)
    expect(sixteenths / quarters).toBeCloseTo(2, 1)
  })

  it('⭐ and a QUARTER is wider than an EIGHTH — the inversion P0 measured, undone', () => {
    // On the page before P2: an eighth was drawn 3.36 staff spaces and a quarter 1.94, because an
    // unbeamed eighth carries a flag at width time and ink was the only quantity that varied.
    const perGap = (model: ScoreModel, gaps: number) => asks(model) / gaps
    expect(perGap(evenBar(4, 'q'), 4)).toBeCloseTo(3.6, 6)
    expect(perGap(evenBar(8, '8'), 8)).toBeCloseTo(2.4, 3)
    expect(perGap(evenBar(4, 'q'), 4)).toBeGreaterThan(perGap(evenBar(8, '8'), 8))
  })

  it('⭐ is METER-INDEPENDENT: the same four quarters ask the same in 4/4 and in 4/2', () => {
    // VexFlow's softmax spaces by the event's FRACTION OF THE BAR, so a quarter is 1.33× an eighth
    // in 4/4 and 1.78× in 2/4 (research §5.2). Nothing about the meter reaches this answer.
    const common = evenBar(4, 'q')
    const alla = evenBar(4, 'q')
    alla.setTimeSignature(1, { numerator: 4, denominator: 2 })
    // Same notes, different bar length — so the trailing gap to the barline changes and nothing else.
    const gaps = (model: ScoreModel) => measureColumns(bar(model)).slice(0, 3).map(c => c.duration.num / c.duration.den)
    expect(gaps(alla)).toEqual(gaps(common))
  })

  it('a two-voice bar asks for what its COLUMNS need, not what its slots do', () => {
    const single = asks(evenBar(4, 'q'))
    const doubled = evenBar(4, 'q')
    for (const beat of [0, 1, 2, 3]) {
      doubled.addNote({ step: 'G', octave: 4, duration: 'q', measure: 1, beat: frac(beat, 1), voice: 2 } as NoteParams)
    }
    expect(asks(doubled), 'a second voice on the same beats needs no more room').toBeCloseTo(single, 6)
  })
})

describe('the INK half (P3) — what an event draws buys its own minimum', () => {
  const columnsOf = (model: ScoreModel) => measureColumns(bar(model))
  const asks = (model: ScoreModel) => naturalWidth(columnsOf(model))

  it('⭐⭐ a FLAG is ink — an UNBEAMED short note reaches a space past its notehead', () => {
    // `docs/vexflow-boundary.md` §5 P2. A flag hangs off the stem TIP and the column never counted it:
    // measured in Chrome, an eighth's up-flag reaches **2.15** staff spaces past the head's anchor
    // against the head's own 1.13, so a bar of unbeamed 32nds — gap 1.50 by the rule — drew every flag
    // **0.65 spaces THROUGH** the next notehead. Seven collisions in one bar.
    const model = new ScoreModel()
    for (let i = 0; i < 8; i++) {
      model.addNote({ step: 'D', octave: 4, duration: '32', measure: 1, beat: frac(i, 8), beam: 'single' } as NoteParams)
    }
    const flags = columnsOf(model).flatMap(column => column.ink.filter(box => box.kind === 'flag'))
    expect(flags, 'every unbeamed 32nd draws one').toHaveLength(8)
    expect(flags[0].right, 'and it reaches a space past the notehead')
      .toBeCloseTo(INK.notehead + INK.flagReach, 6)
  })

  it('⛔ …and a BEAMED note has none, because none is DRAWN', () => {
    // The opposite error, and the one the old ink path actually made: VexFlow's
    // `preCalculateMinTotalWidth` counted a flag on every eighth including beamed ones, which is why an
    // eighth measured WIDER than a quarter (research §6). So this asks the BEAMING rule — `beamRoleAt`,
    // the same answer the drawing reaches — and not the duration.
    const beamed = new ScoreModel()
    for (let i = 0; i < 8; i++) {
      beamed.addNote({ step: 'D', octave: 4, duration: '32', measure: 1, beat: frac(i, 8) } as NoteParams)
    }
    expect(columnsOf(beamed).flatMap(c => c.ink.filter(b => b.kind === 'flag')), 'no flags under a beam')
      .toEqual([])

    const unbeamed = new ScoreModel()
    for (let i = 0; i < 8; i++) {
      unbeamed.addNote({ step: 'D', octave: 4, duration: '32', measure: 1, beat: frac(i, 8), beam: 'single' } as NoteParams)
    }
    expect(asks(unbeamed), 'so the unbeamed bar asks for more room than the beamed one')
      .toBeGreaterThan(asks(beamed))
  })

  it('a QUARTER never has one, flaggable or not', () => {
    expect(columnsOf(evenBar(4, 'q')).flatMap(c => c.ink.filter(b => b.kind === 'flag'))).toEqual([])
  })

  it('a sharp reaches left of its notehead, and the gap in front of it is note↔accidental', () => {
    const model = evenBar(4, 'q')
    const note = model.getNotesInMeasure(1)[1]
    model.updateNote(note.id, { alter: 1, forceAccidental: true })

    const columns = columnsOf(model)
    expect(columns[1].extent.left, 'a sharp is 1.4 spaces of ink').toBeCloseTo(1.4, 6)
    expect(columns[0].padding, 'and the gap before it is the accidental\'s own row').toBe(0.35)
    expect(columns[0].extent.left, 'the note that has no sign reaches nowhere left').toBe(0)
  })

  it('⚠️ …but only where a sign is actually DRAWN — the running-accidental rule, not `alter`', () => {
    // Four C♯s in one bar draw ONE sharp; the other three inherit it. Reserving room for four
    // accidentals that never appear is the mistake this guards.
    const model = new ScoreModel()
    for (const beat of [0, 1, 2, 3]) {
      // ⚠️ No `forceAccidental` — that flag means "draw it anyway", so it would defeat the rule
      //    this test is about. A plain F♯ shows its sign the first time and inherits it after.
      model.addNote({ step: 'F', octave: 5, duration: 'q', measure: 1, beat: frac(beat, 1), alter: 1 } as NoteParams)
    }
    const columns = columnsOf(model)
    expect(columns[0].extent.left, 'the first one shows its sign').toBeCloseTo(1.4, 6)
    for (const column of columns.slice(1, 4)) {
      expect(column.extent.left, '…and the rest of the bar inherits it').toBe(0)
    }
  })

  it('stacked accidentals reach further, and share a column at a SEVENTH', () => {
    const stack = (pitches: [step: 'D' | 'F' | 'C', octave: number][]) => {
      const model = new ScoreModel()
      for (const [step, octave] of pitches) {
        model.addNote({ step, octave, duration: 'q', measure: 1, beat: frac(0, 1), alter: 1, forceAccidental: true } as NoteParams)
      }
      return columnsOf(model)[0].extent.left
    }
    expect(stack([['D', 5]]), 'one sign').toBeCloseTo(1.4, 6)
    expect(stack([['D', 5], ['F', 5]]), 'a third stacks into two columns').toBeCloseTo(2.7, 6)
    expect(stack([['D', 5], ['C', 6]]), 'a seventh shares one').toBeCloseTo(1.4, 6)
  })

  it('a dot reaches right of the notehead, and the gap after it is dot↔note', () => {
    const model = new ScoreModel()
    model.addNote({ step: 'B', octave: 4, duration: 'q', measure: 1, beat: frac(0, 1), dots: 1 } as NoteParams)
    const columns = columnsOf(model)
    expect(columns[0].extent.right, 'past the head, to the far side of the dot').toBeCloseTo(2.1, 6)
    expect(columns[0].padding, 'and a dot asks for more room after it than a head does').toBe(0.5)
  })

  it('a SECOND displaces a head, so the chord is two noteheads wide', () => {
    const model = new ScoreModel()
    model.addNote({ step: 'B', octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) } as NoteParams)
    model.addNote({ step: 'A', octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) } as NoteParams)
    expect(columnsOf(model)[0].extent.right).toBeCloseTo(2 * INK.notehead, 6)
  })

  it('⭐ the BARLINE is a column, and a REST stands further off it than a note', () => {
    const withNote = new ScoreModel()
    withNote.addNote({ step: 'B', octave: 4, duration: 'w', measure: 1, beat: frac(0, 1) } as NoteParams)
    const withRest = new ScoreModel()
    withRest.addNote({ isRest: true, duration: 'w', measure: 1, beat: frac(0, 1) } as NoteParams)

    expect(columnsOf(withNote)[0].padding, 'note↔barline').toBe(1.0)
    expect(columnsOf(withRest)[0].padding, 'rest↔barline — a rest hangs closer to the line').toBe(1.65)
  })

  it('⭐ the ink is a MINIMUM under the rule, never a replacement for it', () => {
    // Four quarters ask 4 × 3.5 = 14 whatever they carry: the rule is far wider than a notehead and
    // a sharp put together, so the ink is invisible here. That is the `max`, and it is what stops a
    // bar of accidentals being spaced by its accidentals (which is what the OLD ink path did — a
    // sharpened quarter came out at 3.75 spaces and a bare one at 1.94).
    const plain = evenBar(4, 'q')
    const sharpened = evenBar(4, 'q')
    for (const note of sharpened.getNotesInMeasure(1)) {
      sharpened.updateNote(note.id, { alter: 1, forceAccidental: true })
    }
    expect(asks(sharpened)).toBeCloseTo(asks(plain), 6)
    expect(asks(plain)).toBeCloseTo(14.4, 6)
  })

  it('…and it BINDS only below the 32nd — LilyPond\'s curve holds the short end open', () => {
    // ⭐ The floor used to bite AT the 32nd: the √2 curve gives one 1.24 spaces, under the 1.43 two
    //   noteheads need. LilyPond's linear branch gives it **1.50**, so the curve wins and the ink
    //   sits underneath — which is exactly the change he asked for by eye. A 64th, at 1.35, is where
    //   the notehead starts showing through instead.
    const gaps = columnsOf(evenBar(32, '32'))
    for (const [i, column] of gaps.slice(0, 31).entries()) {
      expect(naturalWidth([column, gaps[i + 1]]), 'the curve, not the floor').toBeCloseTo(1.5, 6)
    }
    expect(MIN_COLUMN_GAP, 'the floor is still there, just no longer the binding term')
      .toBeCloseTo(1.43, 6)
    expect(followingSpace(frac(1, 16)), 'a 64th is where it takes over').toBeLessThan(MIN_COLUMN_GAP)
  })
})

describe('LEDGER LINES (P3.1) — ink that depends on where a note SITS', () => {
  const columnsOf = (model: ScoreModel) => measureColumns(bar(model), () => 'treble')

  /** `count` 32nds on one pitch — dense enough that the ink, not the rule, decides the gaps. */
  function run(step: 'B' | 'C', octave: number, count = 8): ScoreModel {
    const model = new ScoreModel()
    for (let i = 0; i < count; i++) {
      model.addNote({ step, octave, duration: '32', measure: 1, beat: frac(i, 8) } as NoteParams)
    }
    return model
  }

  it('a ledgered note is 0.67 spaces wider than a bare one, and overhangs it BOTH sides', () => {
    const bare = columnsOf(run('B', 4))[0].extent
    const ledgered = columnsOf(run('C', 4))[0].extent // C4 in treble is staff line 0 — one ledger

    expect(bare).toEqual({ left: 0, right: INK.notehead })
    expect(ledgered.left, 'the ledger reaches left of the head too').toBeCloseTo(0.3, 6)
    expect(ledgered.right).toBeCloseTo(1.5, 6)
    expect(ledgered.right - bare.right + ledgered.left).toBeCloseTo(0.67, 6)
  })

  it('⭐⭐ so a dense run of ledgered notes stops drawing its ledgers on top of each other', () => {
    // The measured bug: consecutive 32nd gaps came out at 1.64 spaces while a ledger line is 1.80
    // wide, so each one overlapped the next by 0.16. The floor now covers the ink.
    const gap = (model: ScoreModel) => {
      const columns = columnsOf(model)
      return naturalWidth([columns[0], columns[1]])
    }
    const LEDGER_WIDTH = 1.8
    expect(gap(run('C', 4)), 'wider than the ledger line itself').toBeGreaterThan(LEDGER_WIDTH)
    expect(gap(run('C', 4)), 'a ledger, its pair padding, and the next ledger\'s overhang')
      .toBeCloseTo(1.5 + 0.35 + 0.3, 6)
    expect(gap(run('B', 4)), 'a bare run is unaffected — it stays on the curve')
      .toBeCloseTo(1.5, 6)
  })

  it('⚠️ the CLEF decides it — the same notes, read differently, need different room', () => {
    const notes = run('C', 4)
    const inTreble = measureColumns(bar(notes), () => 'treble')[0].extent.right
    const inAlto = measureColumns(bar(notes), () => 'alto')[0].extent.right
    const inBass = measureColumns(bar(notes), () => 'bass')[0].extent.right
    // Middle C is one ledger BELOW a treble staff, one ledger ABOVE a bass staff, and sits on the
    // middle line of an alto staff — which is the whole point of the alto clef.
    expect(inTreble, 'ledgered below').toBeCloseTo(1.5, 6)
    expect(inBass, 'ledgered above — same ink, other side').toBeCloseTo(1.5, 6)
    expect(inAlto, 'and on the staff, so a bare notehead').toBeCloseTo(INK.notehead, 6)
  })

  it('a rest\'s width is its OWN — the short ones are the wide ones', () => {
    const restBar = (duration: NoteParams['duration']) => {
      const model = new ScoreModel()
      model.addNote({ isRest: true, duration, measure: 1, beat: frac(0, 1) } as NoteParams)
      return columnsOf(model)[0].extent.right
    }
    expect(restBar('8'), 'an eighth rest is the narrowest').toBeCloseTo(1.0, 6)
    expect(restBar('q')).toBeCloseTo(1.1, 6)
    expect(restBar('16')).toBeCloseTo(1.3, 6)
    expect(restBar('32'), 'and a 32nd rest the widest — each flag leans further right')
      .toBeCloseTo(1.5, 6)
    expect(restBar('32')).toBeGreaterThan(restBar('q'))
  })
})
