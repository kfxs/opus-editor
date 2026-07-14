// @vitest-environment jsdom
/**
 * **Does a bar's note-space width depend on its CLEF?**
 *
 * The question decides where the last remaining cost in this editor gets fixed
 * (docs/render-performance-plan.md §9). `laneFingerprint` puts `clef` in the width cache's key, so
 * an alto clef at bar 40 mints a **new key for every one of the 260 bars after it** — and the census
 * measured the consequence: 1,175 formatter re-runs, 293 ms, **47% of all layout time**, almost all
 * of it earned by one clef change and the drag that moved it.
 *
 * Copy-on-write cannot help with that: a cache miss is a genuine miss. But the width may not depend
 * on the clef at all — a clef moves every notehead the same distance *vertically*, and note spacing
 * is driven by durations, notehead widths, and accidental stacking, none of which move with it.
 *
 * If the widths come out equal, `clef` does not belong in that key.
 */
import { describe, it, expect } from 'vitest'
import { ScoreModel } from '../models/ScoreModel'
import { calculateMeasureWidths } from './MeasureLayout'
import { laneFingerprint } from './MeasureWidthCache'
import { measureShapeKey } from './MeasureRedrawKey'
import { resolveStaffClefs, type StaffClefs } from '@/utils/clefUtils'
import type { Clef } from '@/types/music'
import { fracCreate as frac } from '@/utils/fraction'

const CLEFS: Clef[] = ['treble', 'bass', 'alto', 'tenor']

/**
 * Bars that exercise everything plausibly clef-sensitive: accidentals (which stack, and whose
 * stacking depends on the notes' relative vertical positions), a dense chord, notes far off the
 * staff in *some* clefs and on it in others (ledger lines), dots, and mixed durations.
 */
function buildScore(): ScoreModel {
  const model = new ScoreModel()
  model.addMeasure()
  model.addMeasure()

  // m1 — a chord with clustered accidentals (the case where stacking could bite).
  model.addNote({ step: 'C', alter: 1, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
  model.addNote({ step: 'D', alter: -1, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
  model.addNote({ step: 'E', alter: 1, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
  model.addNote({ step: 'F', octave: 5, duration: 'q', measure: 1, beat: frac(1, 1) })
  model.addNote({ step: 'G', alter: -1, octave: 3, duration: 'h', measure: 1, beat: frac(2, 1) })

  // m2 — extremes: high and low, so ledger lines appear in some clefs and not others.
  model.addNote({ step: 'C', octave: 6, duration: '8', measure: 2, beat: frac(0, 1) })
  model.addNote({ step: 'A', alter: 1, octave: 2, duration: '8', measure: 2, beat: frac(1, 2) })
  model.addNote({ step: 'B', octave: 4, duration: 'q', dots: 1, measure: 2, beat: frac(1, 1) })
  model.addNote({ step: 'G', octave: 4, duration: '16', measure: 2, beat: frac(7, 4) })
  model.addNote({ step: 'D', octave: 5, duration: 'h', measure: 2, beat: frac(2, 1) })
  return model
}

/** Every measure's minimum width, with the whole score in `clef`. */
function widthsUnder(clef: Clef): Map<number, number> {
  const score = buildScore().getScore()
  const staffId = score.staves?.[0]?.id
  // Force the clef by rewriting the resolved map — the same shape the renderer hands the layout.
  const resolved = resolveStaffClefs(score, staffId)
  const forced: StaffClefs = {
    opening: new Map([...resolved.opening].map(([m]) => [m, clef])),
    ending: new Map([...resolved.ending].map(([m]) => [m, clef])),
  }
  const widths = calculateMeasureWidths(score, new Map([[staffId, forced]]), 'wrapped')
  return new Map([...widths].map(([n, info]) => [n, info.minWidth]))
}

/** Width of one bar holding exactly these notes, under `clef`. The control's instrument. */
function widthOf(notes: Array<{ step: 'C' | 'D' | 'E'; alter?: -1 | 1; octave: number; duration: 'q' | 'h' }>, clef: Clef): number {
  const model = new ScoreModel()
  notes.forEach((n, i) =>
    model.addNote({ step: n.step, alter: n.alter, octave: n.octave, duration: n.duration, measure: 1, beat: frac(i, 1) }),
  )
  const score = model.getScore()
  const staffId = score.staves?.[0]?.id
  const resolved = resolveStaffClefs(score, staffId)
  const forced: StaffClefs = {
    opening: new Map([...resolved.opening].map(([m]) => [m, clef])),
    ending: new Map([...resolved.ending].map(([m]) => [m, clef])),
  }
  return calculateMeasureWidths(score, new Map([[staffId, forced]]), 'wrapped').get(1)!.minWidth
}

/**
 * ⚠️ **The control comes first, and it is not optional.** A test that cannot fail proves nothing,
 * and this one runs in jsdom, where VexFlow's glyph metrics are degraded (`getContext` is absent, so
 * text measurement returns empty). If the formatter were returning a constant here, the clef result
 * below would pass for the wrong reason and I would "prove" exactly the wrong thing.
 *
 * So: show that this harness *does* detect width differences that really exist.
 */
describe('control — the harness can actually see a width change', () => {
  it('more notes ⇒ a wider bar', () => {
    const two = widthOf([{ step: 'C', octave: 4, duration: 'h' }, { step: 'D', octave: 4, duration: 'h' }], 'treble')
    const four = widthOf(
      [
        { step: 'C', octave: 4, duration: 'q' },
        { step: 'D', octave: 4, duration: 'q' },
        { step: 'E', octave: 4, duration: 'q' },
        { step: 'D', octave: 4, duration: 'q' },
      ],
      'treble',
    )
    expect(four).toBeGreaterThan(two)
  })

  it('an ACCIDENTAL widens a bar — the glyph the clef question hinges on', () => {
    const plain = widthOf([{ step: 'C', octave: 4, duration: 'h' }, { step: 'D', octave: 4, duration: 'h' }], 'treble')
    const sharp = widthOf(
      [{ step: 'C', alter: 1, octave: 4, duration: 'h' }, { step: 'D', alter: -1, octave: 4, duration: 'h' }],
      'treble',
    )
    expect(sharp).toBeGreaterThan(plain)
  })
})

describe('is a measure’s width independent of its clef?', () => {
  it('every clef produces the SAME minimum width for the same music', () => {
    const byClef = new Map(CLEFS.map(c => [c, widthsUnder(c)]))
    const reference = byClef.get('treble')!

    for (const clef of CLEFS) {
      for (const [measure, width] of byClef.get(clef)!) {
        expect(width, `measure ${measure} in ${clef} vs treble`).toBeCloseTo(
          reference.get(measure)!,
          6,
        )
      }
    }
  })

  it('and the widths are real numbers, not a degenerate constant', () => {
    const widths = [...widthsUnder('treble').values()]
    expect(widths.every(w => w > 0)).toBe(true)
    // The two bars hold different music, so they must not come out identical.
    expect(widths[0]).not.toBeCloseTo(widths[1], 6)
  })
})

/**
 * ⚠️ **The trap this refactor set, and the reason this test exists.**
 *
 * The P5 *shape* key (`measureShapeKey` — "does this bar's picture need re-engraving?") reuses
 * `laneFingerprint` wholesale. Taking the clef out of the width key therefore took it out of the
 * shape key too, silently. The clef was put back into the shape key **explicitly**, and this pins it
 * there.
 *
 * Without it the bug is invisible until you look at the score: an alto clef at bar 40 leaves every
 * later bar's shape key unchanged, so P5 reuses their already-drawn groups — new clef on the stave,
 * old noteheads underneath, every pitch wrong, and no test red.
 *
 * **WIDTH is not PICTURE.** The clef belongs in exactly one of these two keys.
 */
describe('the clef must stay OUT of the width key and IN the shape key', () => {
  it('SHAPE key: a clef change re-engraves the bar', () => {
    // ONE bar, asked about under two clefs. (Two ScoreModels would mint different slot ids, which
    // ride in the width key — that would compare two different bars and prove nothing.)
    const model = new ScoreModel()
    model.addNote({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    const view = model.getScore().measures[0]

    // The width key cannot even ask the question any more: `laneFingerprint` takes no clef. That is
    // the 293 ms, and it is enforced by the type, not by a runtime assertion.
    expect(laneFingerprint(view)).toBe(laneFingerprint(view))

    const shape = (clef: Clef) =>
      measureShapeKey(
        {} as never,
        { view, clef, staffIndex: 0, width: 300, isFirstInLine: true, hasClefChange: false },
        null,
        null,
      )
    expect(shape('treble')).not.toBe(shape('bass'))
    expect(shape('alto')).not.toBe(shape('tenor'))
  })
})

/**
 * **Ids are canonicalized in the width key, and raw in the shape key.**
 *
 * The census after the clef fix: `format` was 74% of all layout, at an 8% miss rate. The misses were
 * not real music changes — adding a staff to a 300-bar score mints 300 whole-rest lanes that are
 * musically identical but each carry a fresh rest id, so each got its own key and VexFlow measured
 * 300 bars that all come out the same width. Paste does the same via the rebar renumber.
 *
 * Deleting ids outright would be wrong: `tupletId` is what says which slots share a tuplet, and two
 * different groupings of the same notes would collide and take each other's width. So ids are mapped
 * to first-appearance ordinals instead.
 */
describe('ids in the width key', () => {
  const restBar = () => new ScoreModel().getScore().measures[0] // one whole-rest bar, fresh ids

  it('two musically IDENTICAL bars share one width key, though every id differs', () => {
    const a = restBar()
    const b = restBar()
    expect(a.slots[0].id).not.toBe(b.slots[0].id) // the ids really are different…
    expect(laneFingerprint(a)).toBe(laneFingerprint(b)) // …and the key does not care.
  })

  it('but the SHAPE key does care — a renumbered bar must be re-engraved', () => {
    // Reusing a drawn group replays its ElementRegistry entries and staveNoteMap, both keyed by note
    // id. Reuse a renumbered bar and every note in it becomes unclickable.
    const shape = (view: ReturnType<typeof restBar>) =>
      measureShapeKey(
        {} as never,
        { view, clef: 'treble' as Clef, staffIndex: 0, width: 300, isFirstInLine: true, hasClefChange: false },
        null,
        null,
      )
    expect(shape(restBar())).not.toBe(shape(restBar()))
  })

  it('different music still gets a different width key (the canonicalizer is not a shredder)', () => {
    const plain = new ScoreModel()
    plain.addNote({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    const sharp = new ScoreModel()
    sharp.addNote({ step: 'C', alter: 1, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    expect(laneFingerprint(plain.getScore().measures[0])).not.toBe(
      laneFingerprint(sharp.getScore().measures[0]),
    )
  })
})

/**
 * ⚠️ **Why the ids are canonicalized and not simply deleted.**
 *
 * `tupletId` is not decoration — it is what says *which slots belong to the same tuplet*, and a
 * tuplet rewrites tick values before the formatter runs. Drop the ids and these two lanes — same
 * three notes, but one triplet vs. two separate groupings — become the same string, collide on one
 * cache entry, and take each other's width. Ordinals keep the structure.
 */
describe('id canonicalization preserves GROUPING', () => {
  const lane = (tupletIds: Array<string | undefined>) =>
    ({
      slots: tupletIds.map((tupletId, i) => ({
        id: `slot-${i}-${Math.abs(i * 7919)}`, // ids differ from the other lane's, by construction
        type: 'rest',
        duration: 'q',
        beat: { num: i, den: 1 },
        ...(tupletId ? { tupletId } : {}),
      })),
      tuplets: [],
      timeSignature: { numerator: 4, denominator: 4 },
    }) as never

  it('all three in ONE tuplet ≠ the first two in one and the third in another', () => {
    const together = lane(['t-aaa', 't-aaa', 't-aaa'])
    const split = lane(['t-bbb', 't-bbb', 't-ccc'])
    expect(laneFingerprint(together)).not.toBe(laneFingerprint(split))
  })

  it('the same grouping under different tuplet UUIDs is still ONE key', () => {
    expect(laneFingerprint(lane(['t-aaa', 't-aaa', 't-aaa']))).toBe(
      laneFingerprint(lane(['t-zzz', 't-zzz', 't-zzz'])),
    )
  })
})
