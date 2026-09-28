/**
 * {@link glyphMarksOnCopiedEvents} — a symbol travels because its EVENT was copied (docs/plans/symbol-plan.md P5).
 */
import { describe, it, expect } from 'vitest'
import { glyphMarksOnCopiedEvents } from './glyphMarkClip'
import { ScoreModel } from '@/engine/models/ScoreModel'
import { addGlyphMarkToEvent } from '@/engine/models/glyphMarkOps'
import { setEngravingOverride } from '@/engine/models/overrideOps'
import { fracCreate as frac } from '@/utils/fraction'
import type { EngravingOverride } from '@/types/music'

describe('glyphMarksOnCopiedEvents', () => {
  it('takes the symbols of the copied events only, re-based to the copy, with their overrides', () => {
    const model = new ScoreModel()
    model.addMeasure()
    const score = model.getScore()
    const a = model.addNote({ step: 'C', octave: 4, duration: 'q', measure: 2, beat: frac(0, 1) })
    const b = model.addNote({ step: 'D', octave: 4, duration: 'q', measure: 2, beat: frac(1, 1) })
    const onA = addGlyphMarkToEvent(score, a.id, 'fermataAbove')!
    addGlyphMarkToEvent(score, b.id, 'pictGlsp') // b is not copied
    const restId = score.measures[1].slots.find(s => s.type === 'rest')!.id
    addGlyphMarkToEvent(score, restId, 'coda')
    setEngravingOverride(score, onA.id, { kind: 'test' } as EngravingOverride)

    const clip = glyphMarksOnCopiedEvents(score, new Set([a.id, restId]), 0, frac(4, 1)) // bar 2 starts at 4
    expect(clip.map(g => [g.glyph, g.offset, g.staff, g.voice])).toEqual([
      ['fermataAbove', frac(0, 1), 0, 0],
      ['coda', frac(2, 1), 0, 0], // the rest filling beats 3–4
    ])
    expect(clip[0].engraving).toEqual([{ kind: 'test' }])
  })
})
