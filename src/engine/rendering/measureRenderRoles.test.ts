// @vitest-environment jsdom
/**
 * **The guard that stops the next person repeating this session.**
 *
 * `MEASURE_RENDER_ROLE` claims, for every field of `Measure`, which render cache it belongs to. The
 * compiler already forces a *new* field to be classified (`Record<keyof Measure, …>` will not
 * typecheck otherwise). This file forces the classification to be **true**: it perturbs each field
 * in turn and asserts the width key and the shape key respond exactly the way the role says.
 *
 * So the two ways to get this wrong are both caught:
 *
 *  - **Forget your new element entirely** → `measureRenderRoles.ts` fails to compile.
 *  - **Classify it wrongly** → this test fails.
 *
 * Both of those beat the real failure mode, which is silent: a hairpin that never redraws, or bars
 * rendering at a stale width, with no test red and nothing thrown.
 */
import { describe, it, expect } from 'vitest'
import { ScoreModel } from '../models/ScoreModel'
import { laneFingerprint } from './MeasureWidthCache'
import { measureShapeKey } from './MeasureRedrawKey'
import { MEASURE_RENDER_ROLE } from './measureRenderRoles'
import type { Clef, Measure, Score } from '@/types/music'
import { fracCreate as frac } from '@/utils/fraction'

/** A score whose measure 1 holds notes AND an engraving override anchored to it (so the `id` field
 *  is actually load-bearing — an override-free bar would make `id` look irrelevant). */
function fixture(): { score: Score; view: Measure } {
  const model = new ScoreModel()
  model.addNote({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
  model.addNote({ step: 'E', octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
  const score = model.getScore()
  const view = score.measures[0]
  score.engravingOverrides = { [`${view.id}:v0:b1/1`]: { restLineShift: 2 } } as never
  return { score, view }
}

const widthKey = (view: Measure) => laneFingerprint(view)

const shapeKey = (score: Score, view: Measure) =>
  measureShapeKey(
    score,
    { view, clef: 'treble' as Clef, staffIndex: 0, width: 300, isFirstInLine: true, scale: 1, hasClefChange: false },
    null,
    null,
  )

/**
 * How to make each field *different*. Also `Record<keyof Measure, …>`, so a new field must be given
 * a perturbation here too — you cannot add a field and leave it untested.
 */
const PERTURB: Record<keyof Measure, (m: Measure) => void> = {
  id: m => { m.id = `${m.id}-perturbed` },
  number: m => { m.number = m.number + 1 },
  slots: m => { m.slots = m.slots.slice(0, 1) },
  timeSignature: m => { m.timeSignature = { numerator: 3, denominator: 4 } },
  timeSignatureChange: m => { m.timeSignatureChange = !m.timeSignatureChange },
  timeSignatureHidden: m => { m.timeSignatureHidden = !m.timeSignatureHidden },
  actualDurationOverride: m => { m.actualDurationOverride = frac(3, 1) },
  clefs: m => { m.clefs = [{ id: 'c1', beat: frac(2, 1), clef: 'bass' }] },
  dynamics: m => { m.dynamics = [{ id: 'd1', beat: frac(0, 1), level: 'f', voice: 0 }] as never },
  tempos: m => { m.tempos = [{ id: 't1', beat: frac(0, 1), text: 'Allegro' }] as never },
  hairpins: m => { m.hairpins = [{ id: 'h1', type: 'cresc', beat: frac(0, 1), length: frac(2, 1) }] },
  ottavas: m => { m.ottavas = [{ id: 'o1', beat: frac(0, 1), length: frac(2, 1), shift: 1 }] },
  pedals: m => { m.pedals = [{ id: 'pd1', beat: frac(0, 1), length: frac(2, 1) }] },
  tuplets: m => { m.tuplets = [{ id: 'tp1', numNotes: 3, notesOccupied: 2 }] as never },
}

describe('every Measure field is classified, and the classification is TRUE', () => {
  for (const field of Object.keys(MEASURE_RENDER_ROLE) as Array<keyof Measure>) {
    const role = MEASURE_RENDER_ROLE[field]

    it(`${field} — declared "${role}"`, () => {
      // ⚠️ CLONE, never build a second fixture. Two `ScoreModel`s mint different note ids, and the
      // shape key carries the raw ids — so every field would look like it changed the picture and
      // the whole suite would pass for the wrong reason. (It did, until this line.)
      const before = fixture()
      const score: Score = structuredClone(before.score)
      const after = { score, view: score.measures[0] }
      PERTURB[field](after.view)

      const widthChanged = widthKey(before.view) !== widthKey(after.view)
      const shapeChanged = shapeKey(before.score, before.view) !== shapeKey(after.score, after.view)

      switch (role) {
        case 'width':
          // Takes horizontal space ⇒ must move the width key. The shape key embeds the width key,
          // so it must move too — a bar whose notes are spaced differently is a different picture.
          expect(widthChanged, `${field} is declared 'width' but the WIDTH key ignored it`).toBe(true)
          expect(shapeChanged, `${field} is declared 'width' but the SHAPE key ignored it`).toBe(true)
          break

        case 'shape':
          // Drawn but weightless. In the width key it would only cost time (that is the clef's 293 ms);
          // missing from the shape key it would never redraw, which is the silent one.
          expect(widthChanged, `${field} is declared 'shape' but it is in the WIDTH key — pure waste`).toBe(false)
          expect(shapeChanged, `${field} is declared 'shape' but the SHAPE key ignored it — it will never redraw`).toBe(true)
          break

        case 'identity':
        case 'ignored':
          expect(widthChanged, `${field} is in the WIDTH key but declared '${role}'`).toBe(false)
          expect(shapeChanged, `${field} is in the SHAPE key but declared '${role}'`).toBe(false)
          break
      }
    })
  }
})
