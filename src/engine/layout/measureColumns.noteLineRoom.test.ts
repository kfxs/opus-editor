/**
 * `measureColumns`' `lineRoom` — a line's request becomes a SOFT rod on the column it leaves, sized by the
 * two columns' own reach plus the line's gaps and length (docs/plans/glissando-plan.md P1b).
 */
import { describe, it, expect } from 'vitest'
import { ScoreModel } from '@/engine/models/ScoreModel'
import { measureColumns } from './measureColumns'
import { mergedReach } from './kerning'
import { naturalWidth } from './spacing'
import { fracCreate as frac } from '@/utils/fraction'
import type { LineRoom } from './noteLineRoom'

function bar() {
  const model = new ScoreModel()
  model.addNote({ step: 'C', alter: 0, octave: 4, duration: '16', measure: 1, beat: frac(0, 1) })
  model.addNote({ step: 'G', alter: 1, octave: 4, duration: '16', measure: 1, beat: frac(1, 4) })
  return model.getMeasure(1)!
}
const room = (to: LineRoom['to']): LineRoom =>
  ({ from: frac(0, 1), to, startGap: 0.2, endGap: 0.3, accidentalGap: 0.7, length: 1.2 })

describe('measureColumns — a line\'s room', () => {
  it('⭐ a soft rod on the column the line leaves: its reach + gaps + length + the target\'s reach (an ACCIDENTAL\'s gap)', () => {
    const plain = measureColumns(bar())
    const cols = measureColumns(bar(), undefined, undefined, undefined, [room(frac(1, 4))])
    const want = mergedReach(plain[0].ink).right + 0.2 + 1.2 + 0.7 + mergedReach(plain[1].ink).left
    expect(cols[0].softRods).toEqual([{ span: 1, length: want }])
    expect(plain[0].softRods).toBeUndefined()
  })

  it('it widens a cramped bar\'s natural width', () => {
    expect(naturalWidth(measureColumns(bar(), undefined, undefined, undefined, [room(frac(1, 4))])))
      .toBeGreaterThan(naturalWidth(measureColumns(bar())))
  })

  it('a target in a later bar: the rod runs to the BARLINE column, start + length only', () => {
    const plain = measureColumns(bar())
    const cols = measureColumns(bar(), undefined, undefined, undefined, [room(null)])
    expect(cols[0].softRods).toEqual([{ span: plain.length - 1, length: mergedReach(plain[0].ink).right + 0.2 + 1.2 }])
  })
})
